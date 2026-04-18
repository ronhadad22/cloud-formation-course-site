"""
Lab 3: LangGraph Agent with AgentCore Memory
Persistent conversation memory across sessions.
"""

from typing import TypedDict, Annotated
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langgraph.checkpoint.memory import MemorySaver
from langchain_aws import ChatBedrock
import uuid
import re

# State definition
class AgentState(TypedDict):
    messages: Annotated[list, add_messages]
    user_preferences: dict  # Persistent memory

# Initialize LLM
llm = ChatBedrock(
    model_id="anthropic.claude-3-5-sonnet-20241022-v2:0",
    region_name="us-east-1"
)

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
    """Agent that uses both conversation history and persistent memory."""
    messages = state["messages"]
    prefs = state.get("user_preferences", {})
    
    # Build context from memory
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
    
    # Extract new preferences from the user's last message
    last_user_msg = None
    for msg in reversed(messages):
        if msg.get("role") == "user":
            last_user_msg = msg.get("content", "")
            break
    
    new_prefs = {}
    if last_user_msg:
        new_prefs = extract_preferences(last_user_msg)
    
    # Merge with existing preferences
    updated_prefs = prefs.copy()
    for key, value in new_prefs.items():
        if key in updated_prefs and isinstance(updated_prefs[key], list) and isinstance(value, list):
            updated_prefs[key] = list(set(updated_prefs[key] + value))
        else:
            updated_prefs[key] = value
    
    return {
        "messages": [{"role": "assistant", "content": response.content}],
        "user_preferences": updated_prefs
    }

def should_end(state: AgentState):
    """Simple end condition."""
    return END

# Build graph with memory
workflow = StateGraph(AgentState)
workflow.add_node("agent", agent_with_memory)
workflow.set_entry_point("agent")
workflow.add_edge("agent", END)

# Add checkpointing (in-memory for local, AgentCore Memory for production)
checkpointer = MemorySaver()
app = workflow.compile(checkpointer=checkpointer)

# Test with memory
if __name__ == "__main__":
    # Generate a thread ID (like a session ID)
    thread_id = str(uuid.uuid4())
    config = {"configurable": {"thread_id": thread_id}}
    
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
