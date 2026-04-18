"""
Lab 1: Basic LangGraph Agent
A simple agent that can answer questions and reason step-by-step.
"""

from typing import TypedDict, Annotated
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langchain_aws import ChatBedrock
import json

# Define the state schema
class AgentState(TypedDict):
    """State that persists across graph nodes."""
    messages: Annotated[list, add_messages]  # Conversation history
    next_step: str  # What to do next

# Initialize LLM
llm = ChatBedrock(
    model_id="anthropic.claude-3-5-sonnet-20241022-v2:0",
    region_name="us-east-1"
)

# Define nodes (agent steps)
def think(state: AgentState):
    """Agent thinks about what to do."""
    messages = state["messages"]
    
    # System prompt defines agent behavior
    system_prompt = """You are a helpful AI assistant. Think step by step.
    If you need to calculate something, show your work.
    If you're done, say "FINISHED" at the end."""
    
    response = llm.invoke([
        {"role": "system", "content": system_prompt},
        *messages
    ])
    
    # Determine next step based on response
    content = response.content
    if "FINISHED" in content:
        next_step = "end"
    else:
        next_step = "continue"
    
    return {
        "messages": [{"role": "assistant", "content": content}],
        "next_step": next_step
    }

def should_continue(state: AgentState):
    """Conditional edge: decide whether to loop or end."""
    return state["next_step"]

# Build the graph
workflow = StateGraph(AgentState)

# Add nodes
workflow.add_node("think", think)

# Set entry point
workflow.set_entry_point("think")

# Add conditional edges
workflow.add_conditional_edges(
    "think",
    should_continue,
    {
        "continue": "think",  # Loop back to think
        "end": END  # End the workflow
    }
)

# Compile the graph
app = workflow.compile()

# Run the agent
if __name__ == "__main__":
    # Initial user message
    inputs = {
        "messages": [{"role": "user", "content": "What is 23 * 47?"}],
        "next_step": "continue"
    }
    
    print("🤖 Running LangGraph Agent - Lab 1\n")
    
    # Stream the execution
    for event in app.stream(inputs):
        for key, value in event.items():
            print(f"=== Node: {key} ===")
            if "messages" in value:
                msg = value["messages"][-1]
                content = msg.content if hasattr(msg, 'content') else msg["content"]
                print(content)
            print()
    
    print("✅ Agent completed!")
