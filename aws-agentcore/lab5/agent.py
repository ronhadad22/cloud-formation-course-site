"""
Production LangGraph Agent for AgentCore Runtime.
This is the entrypoint for the deployed agent on AWS Bedrock AgentCore.
"""

import json
import os
import logging
from typing import TypedDict, Annotated, Dict, Any
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langchain_aws import ChatBedrockConverse
from langchain_core.tools import tool

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# State definition
class AgentState(TypedDict):
    messages: Annotated[list, add_messages]
    metadata: dict  # Additional metadata

# Tools (connected via Gateway in production)
@tool
def search_knowledge(query: str) -> str:
    """
    Search internal knowledge base.
    In production, this calls your API via AgentCore Gateway.
    """
    logger.info(f"Searching knowledge base for: {query}")
    # Mock response for demo
    return f"Knowledge base results for '{query}': [Found 3 relevant documents]"

@tool
def get_user_profile(user_id: str) -> str:
    """
    Get user profile information.
    """
    logger.info(f"Fetching profile for user: {user_id}")
    # Mock user data
    return json.dumps({
        "user_id": user_id,
        "tier": "premium",
        "preferences": ["technology", "aws", "ai"]
    })

# Initialize LLM with error handling
try:
    llm = ChatBedrockConverse(
        model_id=os.environ.get("MODEL_ID", "eu.anthropic.claude-sonnet-4-6"),
        region_name=os.environ.get("AWS_REGION", "eu-central-1"),
        model_kwargs={
            "temperature": 0.7,
            "max_tokens": 2048
        }
    ).bind_tools([search_knowledge, get_user_profile])
    logger.info("✅ LLM initialized successfully")
except Exception as e:
    logger.error(f"❌ Failed to initialize LLM: {e}")
    raise

def agent_node(state: AgentState):
    """
    Main agent node that processes user input and decides next steps.
    """
    messages = state["messages"]
    
    system_prompt = """You are a helpful AI assistant running on AWS Bedrock AgentCore.
    
Capabilities:
- You have access to a knowledge base search tool
- You can retrieve user profiles when needed
- You maintain conversation context

Guidelines:
- Be concise and helpful
- Use tools when they will improve the answer
- Remember context from earlier in the conversation
- If you're unsure, say so rather than making things up

Current time: You are operating in a serverless environment on AWS."""
    
    try:
        response = llm.invoke([
            {"role": "system", "content": system_prompt},
            *messages
        ])
        
        return {
            "messages": [response],
            "metadata": {"status": "success"}
        }
    except Exception as e:
        logger.error(f"Error in agent_node: {e}")
        return {
            "messages": [{"role": "assistant", "content": "I encountered an error processing your request."}],
            "metadata": {"status": "error", "error": str(e)}
        }

# Build the graph
workflow = StateGraph(AgentState)
workflow.add_node("agent", agent_node)
workflow.set_entry_point("agent")
workflow.add_edge("agent", END)

# Compile the application
app = workflow.compile()

# AgentCore Runtime handler
def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for AgentCore Runtime.
    This is invoked when the agent receives a request via HTTPS.
    
    Expected event format:
    {
        "body": "{\"message\": \"Hello\", \"thread_id\": \"user-123\", \"user_id\": \"u-456\"}"
    }
    """
    logger.info(f"Received event: {json.dumps(event, default=str)[:200]}...")
    
    try:
        # Parse input
        if isinstance(event.get("body"), str):
            body = json.loads(event["body"])
        else:
            body = event.get("body", {})
        
        user_message = body.get("message", "")
        thread_id = body.get("thread_id", "default")
        user_id = body.get("user_id", "anonymous")
        metadata = body.get("metadata", {})
        
        if not user_message:
            return {
                "statusCode": 400,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                },
                "body": json.dumps({"error": "No message provided"})
            }
        
        logger.info(f"Processing message from thread {thread_id}: {user_message[:50]}...")
        
        # Run the agent
        result = app.invoke(
            {
                "messages": [{"role": "user", "content": user_message}],
                "metadata": {"user_id": user_id, **metadata}
            },
            config={"configurable": {"thread_id": thread_id}}
        )
        
        # Extract response
        last_message = result["messages"][-1]
        response_content = last_message.content if hasattr(last_message, 'content') else last_message["content"]
        
        logger.info(f"Generated response: {response_content[:50]}...")
        
        # Return formatted response
        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            "body": json.dumps({
                "response": response_content,
                "thread_id": thread_id,
                "user_id": user_id,
                "metadata": {
                    "message_count": len(result["messages"]),
                    "status": result["metadata"].get("status", "unknown")
                }
            })
        }
    
    except json.JSONDecodeError as e:
        logger.error(f"JSON decode error: {e}")
        return {
            "statusCode": 400,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": "Invalid JSON in request body"})
        }
    
    except Exception as e:
        logger.error(f"Unhandled error: {e}", exc_info=True)
        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            "body": json.dumps({
                "error": "Internal server error",
                "details": str(e)
            })
        }

# For local testing
if __name__ == "__main__":
    print("🚀 Testing AgentCore Runtime Handler Locally\n")
    
    # Test 1: Simple message
    print("Test 1: Simple greeting")
    test_event = {
        "body": json.dumps({
            "message": "Hello! What can you do?",
            "thread_id": "test-123",
            "user_id": "user-456"
        })
    }
    result = lambda_handler(test_event, None)
    print(f"Status: {result['statusCode']}")
    print(f"Response: {json.loads(result['body'])['response'][:100]}...\n")
    
    # Test 2: Knowledge search
    print("Test 2: Knowledge search")
    test_event = {
        "body": json.dumps({
            "message": "Search the knowledge base for AWS Lambda best practices",
            "thread_id": "test-124",
            "user_id": "user-789"
        })
    }
    result = lambda_handler(test_event, None)
    print(f"Status: {result['statusCode']}")
    print(f"Response: {json.loads(result['body'])['response'][:150]}...\n")
    
    # Test 3: Error case (empty message)
    print("Test 3: Error handling (empty message)")
    test_event = {
        "body": json.dumps({
            "message": "",
            "thread_id": "test-125"
        })
    }
    result = lambda_handler(test_event, None)
    print(f"Status: {result['statusCode']}")
    print(f"Error: {json.loads(result['body']).get('error')}\n")
    
    print("✅ Local tests complete!")
    print("\nTo deploy to AgentCore:")
    print("  1. agentcore login")
    print("  2. agentcore deploy --name my-langgraph-agent")
