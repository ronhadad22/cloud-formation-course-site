"""
Lab 4: LangGraph Agent with LangSmith Tracing
Full observability for validation and debugging.
"""

import os
import sys
from typing import TypedDict, Annotated
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langchain_aws import ChatBedrock
from langchain_core.tools import tool
from langsmith import Client

# Set LangSmith environment variables (configure these!)
# export LANGSMITH_API_KEY="ls-..."
# export LANGSMITH_ENDPOINT="https://api.smith.langchain.com"
os.environ.setdefault("LANGSMITH_TRACING_V2", "true")
os.environ.setdefault("LANGSMITH_PROJECT", "aws-agentcore-lab")

# Verify LangSmith is configured
def check_langsmith_config():
    """Check if LangSmith is properly configured."""
    api_key = os.environ.get("LANGSMITH_API_KEY")
    if not api_key:
        print("⚠️  LANGSMITH_API_KEY not set!")
        print("Please set it: export LANGSMITH_API_KEY='ls-your-key'")
        print("Get your key from: https://smith.langchain.com")
        return False
    return True

# State
class AgentState(TypedDict):
    messages: Annotated[list, add_messages]

# Tool with tracing
@tool
def calculator(expression: str) -> str:
    """
    Calculate mathematical expressions safely.
    
    Args:
        expression: A mathematical expression like "10 + 20" or "5 * 8"
    """
    try:
        # Safe evaluation with limited operations
        allowed_ops = {"__builtins__": {}}
        result = eval(expression, allowed_ops, {})
        return f"Result: {result}"
    except Exception as e:
        return f"Error: {str(e)}"

@tool
def weather_lookup(city: str) -> str:
    """
    Look up weather for a city (mock data).
    
    Args:
        city: City name
    """
    # Mock weather data
    weather_db = {
        "tel aviv": {"temp": 25, "condition": "Sunny"},
        "new york": {"temp": 15, "condition": "Cloudy"},
        "london": {"temp": 12, "condition": "Rainy"},
        "tokyo": {"temp": 20, "condition": "Clear"},
    }
    
    city_lower = city.lower()
    if city_lower in weather_db:
        w = weather_db[city_lower]
        return f"Weather in {city}: {w['temp']}°C, {w['condition']}"
    return f"No weather data available for {city}"

# LLM with tools
try:
    llm = ChatBedrock(
        model_id="anthropic.claude-3-5-sonnet-20241022-v2:0",
        region_name="us-east-1"
    ).bind_tools([calculator, weather_lookup])
except Exception as e:
    print(f"❌ Failed to initialize LLM: {e}")
    print("Make sure AWS credentials are configured")
    sys.exit(1)

def agent_node(state: AgentState):
    """Agent with automatic LangSmith tracing."""
    messages = state["messages"]
    
    system = """You are a helpful AI assistant with calculator and weather tools.
    Use the calculator for math problems.
    Use the weather tool when users ask about weather.
    Explain your reasoning step by step."""
    
    response = llm.invoke([
        {"role": "system", "content": system},
        *messages
    ])
    
    return {"messages": [response]}

# Build graph
workflow = StateGraph(AgentState)
workflow.add_node("agent", agent_node)
workflow.set_entry_point("agent")
workflow.add_edge("agent", END)

app = workflow.compile()

def run_with_tracing(test_inputs):
    """Run agent and create LangSmith traces."""
    results = []
    
    for i, inputs in enumerate(test_inputs, 1):
        print(f"\n📝 Test {i}: {inputs['description']}")
        print(f"Input: {inputs['message']}")
        
        result = app.invoke({
            "messages": [{"role": "user", "content": inputs["message"]}]
        })
        
        response = result["messages"][-1].content
        print(f"Response: {response[:100]}..." if len(response) > 100 else f"Response: {response}")
        
        results.append({
            "test": i,
            "input": inputs["message"],
            "output": response
        })
    
    return results

def run_evaluation_test():
    """Run a simple evaluation test."""
    print("\n" + "=" * 50)
    print("🔍 Running Evaluation Tests")
    print("=" * 50)
    
    test_cases = [
        {
            "description": "Math calculation",
            "message": "What is 15 * 24 + 100?",
            "expected_contains": ["460", "calculation"]
        },
        {
            "description": "Weather lookup",
            "message": "What's the weather like in Tel Aviv?",
            "expected_contains": ["25", "Sunny"]
        },
        {
            "description": "Simple greeting",
            "message": "Hello! Can you help me?",
            "expected_contains": ["help", "assist"]
        }
    ]
    
    results = run_with_tracing(test_cases)
    
    # Simple evaluation
    print("\n" + "=" * 50)
    print("📊 Evaluation Results")
    print("=" * 50)
    
    for i, (test, result) in enumerate(zip(test_cases, results)):
        score = 0
        for expected in test["expected_contains"]:
            if expected.lower() in result["output"].lower():
                score += 1
        
        passed = score >= len(test["expected_contains"]) / 2
        status = "✅ PASS" if passed else "⚠️  PARTIAL"
        
        print(f"\nTest {i+1}: {test['description']} - {status}")
        print(f"  Score: {score}/{len(test['expected_contains'])}")
    
    return results

# Main execution
if __name__ == "__main__":
    print("🔍 LangSmith Tracing Lab - Lab 4")
    print("=" * 50)
    
    # Check configuration
    if not check_langsmith_config():
        response = input("\nContinue without LangSmith? (y/n): ")
        if response.lower() != 'y':
            sys.exit(1)
        print("\n⚠️  Running without LangSmith tracing...")
    else:
        print("✅ LangSmith configured!")
        print(f"Project: {os.environ.get('LANGSMITH_PROJECT', 'default')}")
        print("\n🌐 Dashboard: https://smith.langchain.com")
    
    # Run tests
    results = run_evaluation_test()
    
    print("\n" + "=" * 50)
    print("✅ Lab 4 complete!")
    print("\nView your traces at:")
    print("  https://smith.langchain.com")
    print("\nNext steps:")
    print("  1. Open the LangSmith dashboard")
    print("  2. Find your project: aws-agentcore-lab")
    print("  3. Explore the traces and feedback")
