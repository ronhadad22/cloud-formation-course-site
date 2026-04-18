"""
Lab 1: Basic LangGraph Agent
A simple agent that can answer questions and reason step-by-step.

WHAT IS THIS?
This is a LangGraph agent - think of it like a flowchart where each box (node)
is a step the AI takes. The agent moves between steps based on rules you define.

KEY CONCEPTS:
- State: A shared data structure that holds conversation history and decisions
- Nodes: Functions that do work (like calling the AI, processing data)
- Edges: Paths between nodes (determines what happens next)
- Graph: The complete flowchart connecting all nodes and edges

HOW IT WORKS:
1. User sends a message → goes to "think" node
2. "think" node calls Bedrock LLM to generate a response
3. Agent checks if response contains "FINISHED" → decides next step
4. If "FINISHED": end the conversation
5. If not: loop back and think again (for multi-step reasoning)
"""

from typing import TypedDict, Annotated
from langgraph.graph import StateGraph, END  # END = special node to stop the graph
from langgraph.graph.message import add_messages  # Helper to manage chat history
from langchain_aws import ChatBedrockConverse  # AWS Bedrock LLM wrapper
import json

# ============================================================================
# STEP 1: DEFINE THE STATE (Shared Data)
# ============================================================================
# The State is like a shared notebook that all nodes can read and write to.
# It carries information as the agent moves through the flowchart.
# 
# In this case, our state holds:
# - messages: The full conversation history (so the AI remembers context)
# - next_step: A flag telling us where to go next in the graph

class AgentState(TypedDict):
    """State that persists across graph nodes."""
    # Annotated tells LangGraph how to update this field
    # add_messages means: append new messages to the list, don't replace
    messages: Annotated[list, add_messages]  # Conversation history
    next_step: str  # What to do next ("continue" or "end")

# ============================================================================
# STEP 2: INITIALIZE THE LLM (The AI Brain)
# ============================================================================
# ChatBedrockConverse connects to AWS Bedrock's Claude model.
# This is the AI that will generate responses.
# 
# - model_id: Which Claude version to use (this is an EU inference profile)
# - region_name: AWS region where Bedrock is available

llm = ChatBedrockConverse(
    model_id="eu.anthropic.claude-sonnet-4-6",  # EU inference profile for Claude
    region_name="eu-central-1"  # Frankfurt region
)

# ============================================================================
# STEP 3: DEFINE NODES (The Steps in Our Flowchart)
# ============================================================================
# Nodes are Python functions that receive the current state and return updates.
# Each node does one specific job.

def think(state: AgentState):
    """
    The "think" node: Calls the AI to generate a response.
    
    This node:
    1. Takes the conversation history from state
    2. Sends it to the LLM (Bedrock/Claude)
    3. Gets the AI's response
    4. Decides whether we're done or need more thinking
    5. Returns updates to the state
    """
    # Get the current conversation history from state
    messages = state["messages"]
    
    # The system prompt tells the AI how to behave
    # It's like giving the AI instructions before the conversation starts
    system_prompt = """You are a helpful AI assistant. Think step by step.
    If you need to calculate something, show your work.
    If you're done, say "FINISHED" at the end."""
    
    # Call the LLM with:
    # - system prompt (instructions for behavior)
    # - all previous messages (conversation history)
    response = llm.invoke([
        {"role": "system", "content": system_prompt},
        *messages  # The * spreads the list so all messages are included
    ])
    
    # Check if the AI is done by looking for "FINISHED" in the response
    # This is a simple way to signal completion
    content = response.content
    if "FINISHED" in content:
        next_step = "end"  # Signal to end the conversation
    else:
        next_step = "continue"  # Signal to keep going
    
    # Return updates to the state
    # LangGraph will merge these updates with the existing state
    return {
        "messages": [{"role": "assistant", "content": content}],  # Add AI's response
        "next_step": next_step  # Tell the graph where to go next
    }

def should_continue(state: AgentState):
    """
    The "router" function: Decides which path to take in the graph.
    
    This is called a "conditional edge" - it looks at the state
    and returns which path to follow next.
    
    Returns:
        - "continue": Go back to the "think" node for more reasoning
        - "end": Stop the graph (END special node)
    """
    return state["next_step"]

# ============================================================================
# STEP 4: BUILD THE GRAPH (Connect Everything Together)
# ============================================================================
# Think of this like drawing a flowchart:
# - Boxes = nodes (functions)
# - Arrows = edges (transitions between nodes)

# Create a new graph with our AgentState as the data structure
workflow = StateGraph(AgentState)

# Add nodes to the graph
# "think" is the name, think is the function that runs
workflow.add_node("think", think)

# Set where the graph starts when a user sends a message
workflow.set_entry_point("think")

# Add conditional edges from the "think" node
# After "think" runs, should_continue() decides where to go:
# - If it returns "continue": go back to "think" (loop)
# - If it returns "end": go to END (stop)
workflow.add_conditional_edges(
    "think",           # From this node
    should_continue,   # Use this function to decide
    {
        "continue": "think",  # Loop back for more thinking
        "end": END            # Stop the graph
    }
)

# Compile the graph into a runnable application
# This prepares the graph for execution
app = workflow.compile()

# ============================================================================
# STEP 5: RUN THE AGENT
# ============================================================================
if __name__ == "__main__":
    # Create the initial state with the user's question
    # This is the starting point - like entering the flowchart at the top
    inputs = {
        "messages": [{"role": "user", "content": "What is 23 * 47?"}],
        "next_step": "continue"  # Start with the intention to continue
    }
    
    print("🤖 Running LangGraph Agent - Lab 1\n")
    print("=" * 60)
    print("Flow: User → think → check 'FINISHED'? → Yes: END / No: think again")
    print("=" * 60)
    print()
    
    # Stream runs the graph and shows each step as it happens
    # app.stream() yields events as each node completes
    for event in app.stream(inputs):
        for key, value in event.items():
            # key = name of the node that just ran
            print(f"=== Node: {key} ===")
            if "messages" in value:
                # Get the last message (the one just added)
                msg = value["messages"][-1]
                # Handle both object-style and dict-style messages
                content = msg.content if hasattr(msg, 'content') else msg["content"]
                print(content)
            print()
    
    print("✅ Agent completed!")
