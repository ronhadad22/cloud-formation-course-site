"""
Lab 2: LangGraph Agent with Tools
Demonstrates tool calling with LangGraph.

WHAT IS THIS?
This lab shows how agents can use "tools" - functions the AI can call to do things
like search databases, calculate shipping, or check inventory.

THE AGENT-TOOL LOOP:
1. User asks a question
2. Agent (LLM) decides: "I need to call a tool"
3. Tool executes and returns data
4. Agent uses that data to answer the user
5. Repeat until done

FLOW DIAGRAM:
User → Agent decides → Tool needed? → Yes: Call Tool → Get result → Agent answers
                          ↓
                        No: Answer directly

KEY CONCEPTS:
- @tool decorator: Marks Python functions as callable by the AI
- bind_tools(): Tells the LLM which tools it can use
- ToolNode: LangGraph helper that executes tools
- tool_calls: When LLM requests a tool, it puts the request here
"""

from typing import TypedDict, Annotated
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode  # Prebuilt node that runs tools
from langchain_aws import ChatBedrockConverse
from langchain_core.tools import tool  # Decorator to mark functions as tools
import json

# ============================================================================
# STEP 1: DEFINE THE STATE
# ============================================================================
# Same as Lab 1 - holds conversation history
# The AI needs to see the full conversation to make decisions

class AgentState(TypedDict):
    messages: Annotated[list, add_messages]  # Chat history + tool results

# ============================================================================
# STEP 2: DEFINE TOOLS (Functions the AI can call)
# ============================================================================
# The @tool decorator tells LangGraph: "This function is available to the AI"
# The AI will see the function name, docstring, and parameters.
# When the AI wants to call a tool, it outputs a "tool_call" request.

@tool
def search_products(query: str, category: str = "all") -> str:
    """
    Search for products in the catalog.
    
    Args:
        query: Search terms (e.g., "laptop", "wireless mouse")
        category: Product category (electronics, clothing, home, all)
    
    Returns:
        JSON string with matching products
    """
    # Simulated product database
    products = [
        {"id": "P001", "name": "MacBook Pro 14", "category": "electronics", "price": 1999},
        {"id": "P002", "name": "Wireless Mouse", "category": "electronics", "price": 29},
        {"id": "P003", "name": "Running Shoes", "category": "clothing", "price": 89},
        {"id": "P004", "name": "Coffee Maker", "category": "home", "price": 79},
    ]
    
    results = [p for p in products if query.lower() in p["name"].lower()]
    if category != "all":
        results = [p for p in results if p["category"] == category]
    
    return json.dumps(results, indent=2)

@tool
def calculate_shipping(weight_kg: float, destination: str) -> str:
    """
    Calculate shipping cost.
    
    Args:
        weight_kg: Package weight in kilograms
        destination: City name (e.g., "Tel Aviv", "Jerusalem")
    
    Returns:
        Shipping cost in USD
    """
    base_rate = 5.0
    per_kg_rate = 2.0
    cost = base_rate + (weight_kg * per_kg_rate)
    return f"${cost:.2f}"

@tool
def check_inventory(product_id: str) -> str:
    """
    Check product availability.
    
    Args:
        product_id: Product identifier (e.g., "P001")
    
    Returns:
        Stock quantity or "Out of stock"
    """
    inventory = {"P001": 15, "P002": 50, "P003": 8, "P004": 0}
    stock = inventory.get(product_id, 0)
    return f"{stock} units available" if stock > 0 else "Out of stock"

# List of all available tools
# The AI will only know about tools in this list
tools = [search_products, calculate_shipping, check_inventory]

# ============================================================================
# STEP 3: BIND TOOLS TO THE LLM
# ============================================================================
# bind_tools() tells the LLM: "You can use these 3 tools"
# Now when we call the LLM, it can either:
# - Respond directly (no tools needed)
# - Request a tool call (puts request in response.tool_calls)

llm = ChatBedrockConverse(
    model_id="eu.anthropic.claude-sonnet-4-6",
    region_name="eu-central-1"
).bind_tools(tools)

# ============================================================================
# STEP 4: DEFINE NODES
# ============================================================================

def agent(state: AgentState):
    """
    The 'agent' node: Decides what to do and may call tools.

    When the LLM is invoked with bind_tools(), it can respond two ways:
    1. Normal text response - if no tools needed
    2. Tool call request - if it wants to use a tool (stored in response.tool_calls)
    """
    messages = state["messages"]

    # Tell the AI what tools it has available
    system = """You are a helpful e-commerce assistant.
    You have access to product search, shipping calculation, and inventory tools.
    Use tools when needed to help customers."""

    # Call the LLM (it may or may not request tools)
    response = llm.invoke([
        {"role": "system", "content": system},
        *messages
    ])

    # Return the response (may contain tool_calls or just text)
    return {"messages": [response]}

# ============================================================================
# STEP 5: TOOL EXECUTION NODE
# ============================================================================
# ToolNode is a prebuilt LangGraph component that:
# 1. Looks at the last message for tool_calls
# 2. Executes the requested tool(s)
# 3. Returns the results as new messages

tool_node = ToolNode(tools)

# ============================================================================
# STEP 6: CONDITIONAL LOGIC (Router)
# ============================================================================
# This function decides: after the agent runs, what happens next?
# - If agent requested tools → go to tool_node
# - If no tools needed → end the conversation

def should_use_tools(state: AgentState):
    """
    Check if the agent requested any tool calls.

    When an LLM wants to use a tool, it creates a special message
    with tool_calls - a list of tools to execute.
    """
    messages = state["messages"]
    last_message = messages[-1]

    # If tool_calls exists and is not empty, go to tools node
    if last_message.tool_calls:
        return "tools"

    # Otherwise, end the conversation
    return END

# ============================================================================
# STEP 7: BUILD THE GRAPH
# ============================================================================
# Flow:
# User → agent (decides) → has tool_calls?
#                               ↓
#                         Yes → tools (execute) → back to agent
#                               ↓
#                         No → END

workflow = StateGraph(AgentState)

# Add nodes
workflow.add_node("agent", agent)      # The AI that decides
workflow.add_node("tools", tool_node)  # The tool executor

# Set entry point
workflow.set_entry_point("agent")

# After agent runs, check if we need tools
workflow.add_conditional_edges(
    "agent",
    should_use_tools,           # Router function
    {
        "tools": "tools",       # Yes, call tools
        END: END                # No, we're done
    }
)

# After tools execute, ALWAYS go back to agent for the final answer
workflow.add_edge("tools", "agent")

app = workflow.compile()

# ============================================================================
# STEP 8: RUN TESTS
# ============================================================================
if __name__ == "__main__":
    print("🤖 E-commerce Agent with Tools - Lab 2\n")
    print("Watch how the agent decides when to call tools!")
    print("-" * 50)
    
    # Test 1: Product search
    print("Test 1: Searching for laptops...")
    result = app.invoke({
        "messages": [{"role": "user", "content": "Find me a laptop"}]
    })
    print(f"Response: {result['messages'][-1].content}\n")
    
    # Test 2: Multi-tool workflow
    print("Test 2: Complete order workflow...")
    result = app.invoke({
        "messages": [{"role": "user", "content": "I want to buy P001. Check if it's in stock and calculate shipping to Tel Aviv (weight 2kg)"}]
    })
    print(f"Response: {result['messages'][-1].content}\n")
    
    # Test 3: Out of stock
    print("Test 3: Checking unavailable product...")
    result = app.invoke({
        "messages": [{"role": "user", "content": "Is P004 available?"}]
    })
    print(f"Response: {result['messages'][-1].content}\n")
    
    print("✅ Lab 2 complete!")
