"""
Lab 2: LangGraph Agent with Tools
Demonstrates tool calling through AgentCore Gateway.
"""

from typing import TypedDict, Annotated
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode
from langchain_aws import ChatBedrock
from langchain_core.tools import tool
import json

# Define state
class AgentState(TypedDict):
    messages: Annotated[list, add_messages]

# Define tools
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

# Tool list
tools = [search_products, calculate_shipping, check_inventory]

# Bind tools to LLM
llm = ChatBedrock(
    model_id="anthropic.claude-3-5-sonnet-20241022-v2:0",
    region_name="us-east-1"
).bind_tools(tools)

# Define nodes
def agent(state: AgentState):
    """Agent decides what to do next."""
    messages = state["messages"]
    
    system = """You are a helpful e-commerce assistant.
    You have access to product search, shipping calculation, and inventory tools.
    Use tools when needed to help customers."""
    
    response = llm.invoke([
        {"role": "system", "content": system},
        *messages
    ])
    
    return {"messages": [response]}

# Tool execution node
tool_node = ToolNode(tools)

# Conditional logic: should we call tools?
def should_use_tools(state: AgentState):
    """Check if the last message has tool calls."""
    messages = state["messages"]
    last_message = messages[-1]
    
    if last_message.tool_calls:
        return "tools"
    return END

# Build graph
workflow = StateGraph(AgentState)
workflow.add_node("agent", agent)
workflow.add_node("tools", tool_node)

workflow.set_entry_point("agent")
workflow.add_conditional_edges(
    "agent",
    should_use_tools,
    {
        "tools": "tools",
        END: END
    }
)
workflow.add_edge("tools", "agent")

app = workflow.compile()

# Test
if __name__ == "__main__":
    print("🤖 E-commerce Agent with Tools - Lab 2\n")
    
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
