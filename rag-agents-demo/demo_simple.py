#!/usr/bin/env python3
"""
Simple 5-minute demo script for quick presentation.
Shows both RAG and Agent capabilities in one script.
"""

import boto3
import json
import numpy as np
from typing import List

print("=" * 70)
print("RAG & AGENTS DEMO - AWS Bedrock")
print("=" * 70)

# Initialize Bedrock client
bedrock = boto3.client('bedrock-runtime', region_name='us-east-1')

# ============================================================================
# PART 1: RAG DEMO (Retrieval-Augmented Generation)
# ============================================================================

print("\n" + "=" * 70)
print("PART 1: RAG - Answering Questions from Documents")
print("=" * 70)

# Sample documents (in real scenario, these would be your company docs)
documents = {
    "AWS Lambda": """
    AWS Lambda is a serverless compute service that lets you run code without 
    provisioning or managing servers. You pay only for the compute time you consume. 
    Lambda automatically scales your application by running code in response to 
    triggers such as HTTP requests, database changes, or file uploads to S3.
    """,
    "Amazon S3": """
    Amazon S3 (Simple Storage Service) is an object storage service offering 
    industry-leading scalability, data availability, security, and performance. 
    S3 is designed for 99.999999999% durability and stores data for millions of 
    applications. It can be used for backup, archiving, and static website hosting.
    """,
    "Amazon Bedrock": """
    Amazon Bedrock is a fully managed service that makes foundation models from 
    leading AI companies available through an API. With Bedrock, you can experiment 
    with and evaluate top FMs, customize them with your data using techniques like 
    fine-tuning and RAG, and build agents that execute tasks.
    """
}

def get_embedding(text: str) -> np.ndarray:
    """Get embedding vector from Bedrock."""
    body = json.dumps({"inputText": text})
    response = bedrock.invoke_model(
        modelId="amazon.titan-embed-text-v1",
        body=body
    )
    return np.array(json.loads(response['body'].read())['embedding'])

def cosine_similarity(vec1: np.ndarray, vec2: np.ndarray) -> float:
    """Calculate similarity between vectors."""
    return np.dot(vec1, vec2) / (np.linalg.norm(vec1) * np.linalg.norm(vec2))

def rag_query(question: str) -> str:
    """Simple RAG: Retrieve relevant doc and generate answer."""
    print(f"\n📝 Question: {question}")
    print("🔍 Searching documents...")
    
    # Get query embedding
    query_embedding = get_embedding(question)
    
    # Find most relevant document
    best_doc = None
    best_score = -1
    
    for title, content in documents.items():
        doc_embedding = get_embedding(content)
        score = cosine_similarity(query_embedding, doc_embedding)
        
        if score > best_score:
            best_score = score
            best_doc = (title, content)
    
    print(f"✓ Found relevant document: '{best_doc[0]}' (similarity: {best_score:.3f})")
    
    # Generate answer using Claude with retrieved context
    prompt = f"""Based on this context, answer the question.

Context: {best_doc[1]}

Question: {question}

Answer concisely:"""
    
    body = json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 200,
        "messages": [{"role": "user", "content": prompt}]
    })
    
    response = bedrock.invoke_model(
        modelId="anthropic.claude-3-sonnet-20240229-v1:0",
        body=body
    )
    
    answer = json.loads(response['body'].read())['content'][0]['text']
    print(f"🤖 Answer: {answer}")
    return answer

# Demo RAG with 2 questions
rag_query("What is AWS Lambda?")
print("\n" + "-" * 70)
rag_query("Tell me about Amazon Bedrock")

# ============================================================================
# PART 2: AGENT DEMO (Tool Use)
# ============================================================================

print("\n\n" + "=" * 70)
print("PART 2: AGENT - Using Tools to Solve Tasks")
print("=" * 70)

# Define tools the agent can use
tools = [
    {
        "name": "calculator",
        "description": "Perform mathematical calculations",
        "input_schema": {
            "type": "object",
            "properties": {
                "expression": {
                    "type": "string",
                    "description": "Math expression to evaluate (e.g., 'sqrt(144) + 10')"
                }
            },
            "required": ["expression"]
        }
    },
    {
        "name": "get_time",
        "description": "Get the current date and time",
        "input_schema": {
            "type": "object",
            "properties": {}
        }
    }
]

def execute_tool(tool_name: str, tool_input: dict) -> str:
    """Execute a tool and return result."""
    if tool_name == "calculator":
        import math
        try:
            result = eval(tool_input["expression"], {"__builtins__": {}}, {
                "sqrt": math.sqrt, "pow": math.pow, "pi": math.pi, "e": math.e
            })
            return f"Result: {result}"
        except Exception as e:
            return f"Error: {str(e)}"
    
    elif tool_name == "get_time":
        from datetime import datetime
        return f"Current time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
    
    return "Tool not found"

def agent_task(task: str) -> str:
    """Agent that can use tools to complete tasks."""
    print(f"\n🤖 Task: {task}")
    
    messages = [{"role": "user", "content": task}]
    
    # Agent loop (max 5 iterations)
    for iteration in range(5):
        print(f"\n--- Iteration {iteration + 1} ---")
        
        body = json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 1000,
            "messages": messages,
            "tools": tools
        })
        
        response = bedrock.invoke_model(
            modelId="anthropic.claude-3-sonnet-20240229-v1:0",
            body=body
        )
        
        response_body = json.loads(response['body'].read())
        stop_reason = response_body['stop_reason']
        content = response_body['content']
        
        # Add assistant message
        messages.append({"role": "assistant", "content": content})
        
        if stop_reason == 'end_turn':
            # Task complete
            final_text = ""
            for block in content:
                if block.get('type') == 'text':
                    final_text += block['text']
            print(f"✓ Task completed!")
            print(f"📊 Final answer: {final_text}")
            return final_text
        
        elif stop_reason == 'tool_use':
            # Agent wants to use a tool
            tool_results = []
            
            for block in content:
                if block.get('type') == 'tool_use':
                    tool_name = block['name']
                    tool_input = block['input']
                    tool_id = block['id']
                    
                    print(f"🔧 Using tool: {tool_name}")
                    print(f"   Input: {tool_input}")
                    
                    # Execute tool
                    result = execute_tool(tool_name, tool_input)
                    print(f"   ✓ Result: {result}")
                    
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": tool_id,
                        "content": result
                    })
            
            # Send tool results back to agent
            messages.append({"role": "user", "content": tool_results})
    
    return "Max iterations reached"

# Demo agent with 2 tasks
agent_task("What is the square root of 144 plus 10?")
print("\n" + "-" * 70)
agent_task("What time is it now? Then calculate 100 divided by 4.")

# ============================================================================
# SUMMARY
# ============================================================================

print("\n\n" + "=" * 70)
print("DEMO COMPLETE!")
print("=" * 70)
print("""
KEY TAKEAWAYS:

1. RAG (Retrieval-Augmented Generation):
   ✓ Answers questions from YOUR documents
   ✓ No hallucinations - grounded in facts
   ✓ No retraining needed

2. AGENTS (Tool Use):
   ✓ Can DO things, not just generate text
   ✓ Uses tools autonomously
   ✓ Plans and reasons through tasks

3. AWS Bedrock:
   ✓ Fully managed AI service
   ✓ Multiple models available
   ✓ Enterprise-ready

NEXT STEPS:
- Exercise 1: Build your own RAG system
- Exercise 2: Build your own agent with custom tools
- Final project: Combine both for real-world application
""")
print("=" * 70)
