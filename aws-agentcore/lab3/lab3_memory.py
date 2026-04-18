"""
Lab 3: LangGraph Agent with Memory
Persistent conversation memory across sessions.

WHAT IS THIS?
This lab shows how agents remember things across multiple conversations.
Without memory, every chat starts fresh. With memory, the agent remembers
your name, preferences, and past conversations.

TWO TYPES OF MEMORY:
1. Conversation History (messages): Automatically tracked by LangGraph
2. Custom Memory (user_preferences): We extract and store specific facts

HOW CHECKPOINTING WORKS:
- MemorySaver: Saves state after each step
- thread_id: A unique session identifier (like a cookie)
- When you pass the same thread_id, the agent loads previous state

FLOW:
Conversation 1: "My name is David" → Agent extracts name → Saves state
Conversation 2: (same thread_id) → Loads state → "Hi David!"
"""

from typing import TypedDict, Annotated
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langgraph.checkpoint.memory import MemorySaver  # Saves state to memory
from langchain_aws import ChatBedrockConverse
import uuid  # For generating unique session IDs
import re  # For extracting preferences from text

# ============================================================================
# STEP 1: DEFINE THE STATE (with memory fields)
# ============================================================================
# This state has TWO memory fields:
# - messages: Auto-managed by LangGraph (conversation history)
# - user_preferences: Custom field we extract and manage manually

class AgentState(TypedDict):
    messages: Annotated[list, add_messages]  # Auto-saved by checkpointing
    user_preferences: dict  # Custom facts we extract (name, likes, etc.)

# ============================================================================
# STEP 2: INITIALIZE THE LLM
# ============================================================================
llm = ChatBedrockConverse(
    model_id="eu.anthropic.claude-sonnet-4-6",
    region_name="eu-central-1"
)

# ============================================================================
# STEP 3: PREFERENCE EXTRACTION (Custom Memory Logic)
# ============================================================================
# This function parses user messages to extract facts about the user.
# It's a simple rule-based extractor - in production you might use NLP.

def extract_preferences(text: str) -> dict:
    """Extract user preferences from text."""
    prefs = {}
    
    # Extract name
    name_match = re.search(r"my name is (\w+)", text, re.IGNORECASE)
    if name_match:
        prefs["name"] = name_match.group(1)
    
    # Extract favorite color
    color_match = re.search(r"(favorite|favourite) color is (\w+)", text, re.IGNORECASE)
    if color_match:
        prefs["favorite_color"] = color_match.group(2)
    
    # Extract likes
    like_match = re.search(r"i (?:love|like) (\w+(?:\s+\w+)*)", text, re.IGNORECASE)
    if like_match:
        likes = prefs.get("likes", [])
        likes.append(like_match.group(1))
        prefs["likes"] = likes
    
    return prefs

def agent_with_memory(state: AgentState):
    """
    Agent that uses BOTH conversation history AND persistent memory.
    
    The agent:
    1. Gets stored preferences from state
    2. Includes them in the system prompt (so AI "remembers")
    3. Extracts NEW preferences from the user's message
    4. Returns updated preferences to be saved
    """
    messages = state["messages"]
    
    # Load previously saved preferences (may be empty on first message)
    prefs = state.get("user_preferences", {})
    
    # Build memory context for the AI
    # This is how we "tell" the AI what it should remember
    memory_context = ""
    if prefs:
        memory_context = "Known user preferences:\n"
        for key, value in prefs.items():
            if isinstance(value, list):
                memory_context += f"- {key}: {', '.join(value)}\n"
            else:
                memory_context += f"- {key}: {value}\n"
    
    system_prompt = f"""You are a helpful assistant with memory.

{memory_context}

Remember user preferences when they mention them (name, likes, etc).
If they ask about something you should remember, use the preferences above.
Be warm and personal - use their name if you know it!"""
    
    response = llm.invoke([
        {"role": "system", "content": system_prompt},
        *messages
    ])
    
    # Extract NEW preferences from the user's latest message
    # We scan backwards through messages to find the most recent user message
    last_user_msg = None
    for msg in reversed(messages):
        if msg.get("role") == "user":
            last_user_msg = msg.get("content", "")
            break
    
    # Parse the message for new facts
    new_prefs = {}
    if last_user_msg:
        new_prefs = extract_preferences(last_user_msg)
    
    # Merge new preferences with existing ones
    # Lists (like "likes") get combined; single values get replaced
    updated_prefs = prefs.copy()
    for key, value in new_prefs.items():
        if key in updated_prefs and isinstance(updated_prefs[key], list) and isinstance(value, list):
            # Combine lists and remove duplicates
            updated_prefs[key] = list(set(updated_prefs[key] + value))
        else:
            updated_prefs[key] = value
    
    # Return everything - LangGraph will save it via checkpointing
    return {
        "messages": [{"role": "assistant", "content": response.content}],
        "user_preferences": updated_prefs  # This gets saved to memory!
    }

def should_end(state: AgentState):
    """Simple end condition."""
    return END

# ============================================================================
# STEP 5: BUILD THE GRAPH WITH MEMORY
# ============================================================================

workflow = StateGraph(AgentState)
workflow.add_node("agent", agent_with_memory)
workflow.set_entry_point("agent")
workflow.add_edge("agent", END)

# ============================================================================
# STEP 6: ADD CHECKPOINTING (The Magic That Enables Memory)
# ============================================================================
# MemorySaver = saves state after every step to an in-memory store
# thread_id = identifies which conversation/session this is
# 
# When you pass config={"configurable": {"thread_id": "abc123"}}:
# - First time: Creates new checkpoint
# - Later times: Loads existing checkpoint (restores memory!)

checkpointer = MemorySaver()  # In-memory storage (resets when script ends)
# For production: Use persistent storage like Redis or AgentCore Memory

app = workflow.compile(checkpointer=checkpointer)

# ============================================================================
# STEP 7: RUN TESTS (Demonstrating Memory Across Conversations)
# ============================================================================
if __name__ == "__main__":
    # Create a unique session ID (thread_id)
    # All messages with this ID will share the same memory
    thread_id = str(uuid.uuid4())
    config = {"configurable": {"thread_id": thread_id}}
    
    print("💡 TIP: All 4 conversations use the same thread_id")
    print("       So the agent remembers across all of them!")
    
    print(f"🧠 Agent with Memory - Lab 3")
    print(f"Thread ID: {thread_id[:8]}\n")
    print("=" * 50)
    
    # Conversation 1
    print("\n💬 Conversation 1:")
    print("User: My name is Sarah and I love Python")
    result = app.invoke(
        {"messages": [{"role": "user", "content": "My name is Sarah and I love Python"}], "user_preferences": {}},
        config
    )
    print(f"Agent: {result['messages'][-1].content}")
    print(f"[Memory: {result['user_preferences']}]")
    
    # Conversation 2 (same thread - should remember!)
    print("\n💬 Conversation 2 (same session):")
    print("User: What's my favorite programming language?")
    result = app.invoke(
        {"messages": [{"role": "user", "content": "What's my favorite programming language?"}]},
        config
    )
    print(f"Agent: {result['messages'][-1].content}")
    
    # Conversation 3 (same thread - should remember name!)
    print("\n💬 Conversation 3 (same session):")
    print("User: What did I tell you my name was?")
    result = app.invoke(
        {"messages": [{"role": "user", "content": "What did I tell you my name was?"}]},
        config
    )
    print(f"Agent: {result['messages'][-1].content}")
    
    # Conversation 4 (add more preferences)
    print("\n💬 Conversation 4 (adding more preferences):")
    print("User: My favorite color is blue and I also like AWS")
    result = app.invoke(
        {"messages": [{"role": "user", "content": "My favorite color is blue and I also like AWS"}]},
        config
    )
    print(f"Agent: {result['messages'][-1].content}")
    print(f"[Memory: {result['user_preferences']}]")
    
    print("\n" + "=" * 50)
    print("✅ Lab 3 complete!")
    print(f"\nFinal memory for session {thread_id[:8]}:")
    print(f"{result['user_preferences']}")
