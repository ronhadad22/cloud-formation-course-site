# AWS Bedrock AgentCore Lab — LangGraph + LangSmith

Learn to build, deploy, and validate AI agents using **LangGraph**, **AWS Bedrock AgentCore**, and **LangSmith**.

---

## What You Will Build

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  Local Development                      Production (AgentCore Runtime)  │
│  ─────────────────                      ─────────────────────────────  │
│                                                                         │
│  ┌─────────────┐                        ┌─────────────┐                │
│  │ LangGraph   │ ──deploy─────────────▶ │ AgentCore   │                │
│  │ Agent Code  │   (agentcore CLI)      │ Runtime     │                │
│  └─────────────┘                        └─────────────┘                │
│        │                                        │                       │
│        │ traces                                 │ traces                │
│        ▼                                        ▼                       │
│  ┌─────────────┐                        ┌─────────────┐                │
│  │ LangSmith   │ ◀───────────────────── │ LangSmith   │                │
│  │ (local)     │                        │ (production)│                │
│  │ Validation  │                        │ Monitoring  │                │
│  └─────────────┘                        └─────────────┘                │
│                                                                         │
│  Key Features:                                                          │
│  • Graph-based agent workflows (LangGraph)                             │
│  • Serverless deployment (AgentCore Runtime)                           │
│  • Full observability (LangSmith traces)                               │
│  • Tool integration (LangGraph tools)                                  │
│  • Memory persistence (AgentCore Memory)                                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Lab Overview

| Lab | Topic | What You Learn |
|-----|-------|----------------|
| **Lab 1** | LangGraph Basics | Build a simple state machine agent locally |
| **Lab 2** | Tools & Actions | Add tool calling with LangGraph tools   |
| **Lab 3** | Memory & State | Implement conversation memory |
| **Lab 4** | LangSmith Integration | Trace and validate agent behavior |
| **Lab 5** | Deploy to AgentCore | Production deployment with CLI |
| **Lab 6** | Production Monitoring | Full observability stack |

---

## Prerequisites

```bash
# Python 3.10+
python --version

# AWS CLI configured
aws configure

# Install AgentCore CLI
pip install amazon-bedrock-agentcore

# Install LangGraph and LangSmith
pip install langgraph langsmith langchain-aws

# Verify installations
agentcore --version
```

---

## Lab 1: Build Your First LangGraph Agent (Local)

### What is LangGraph?

LangGraph is a framework for building agent workflows as **graphs**. Unlike simple prompt-chains, LangGraph agents can:
- Loop (agent thinks → acts → observes → repeats)
- Branch (different paths based on conditions)
- Maintain state across steps

```
┌─────────────────────────────────────────────────────────────┐
│  Simple Chain (NOT an agent)                                │
│  Input → LLM → Output                                       │
│  One pass, no iteration                                       │
├─────────────────────────────────────────────────────────────┤
│  LangGraph Agent (IS an agent)                              │
│                                                             │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐               │
│  │  Start  │───▶│  LLM    │───▶│ Decision│               │
│  └─────────┘    └─────────┘    └────┬────┘               │
│                                      │                      │
│                    ┌─────────────────┼─────────────────┐   │
│                    │                 │                 │   │
│                    ▼                 ▼                 ▼   │
│               ┌─────────┐      ┌─────────┐      ┌────────┐ │
│               │ Tool A  │      │ Tool B  │      │  End   │ │
│               └────┬────┘      └────┬────┘      └────────┘ │
│                    │                 │                      │
│                    └─────────────────┘                      │
│                           │                                 │
│                           ▼                                 │
│                    ┌────────────┐                          │
│                    │ Observation│                          │
│                    └─────┬──────┘                          │
│                          │                                  │
│                          └────────────────▶ (back to LLM)  │
│                                                             │
│  Loops until task complete!                                 │
└─────────────────────────────────────────────────────────────┘
```

### Step 1: Create the Basic Agent

Create `lab1_basic_agent.py`:

```python
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
    model_id="anthropic.claude-3-sonnet-20240229-v1:0",
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
    
    # Stream the execution
    for event in app.stream(inputs):
        for key, value in event.items():
            print(f"\n=== Node: {key} ===")
            if "messages" in value:
                print(value["messages"][-1].content if hasattr(value["messages"][-1], 'content') else value["messages"][-1]["content"])
```

### Step 2: Run Locally

```bash
cd lab1
python lab1_basic_agent.py
```

Expected output:
```
=== Node: think ===
I need to calculate 23 * 47.

Let me break this down:
23 * 47 = 23 * (40 + 7)
        = (23 * 40) + (23 * 7)
        = 920 + 161
        = 1081

FINISHED

=== Node: __end__ ===
```

---

## Lab 2: Add Tools with LangGraph

### Understanding Tools in LangGraph

Tools give your agent the ability to interact with the outside world:
- Call APIs
- Query databases
- Send emails
- Book meetings

```
┌─────────────────────────────────────────────────────────────┐
│  Agent with Tools                                           │
│                                                             │
│  User: "What's the weather in Tel Aviv?"                   │
│                                                             │
│  ┌─────────┐                                               │
│  │  LLM    │ ──▶ "I need to call the weather API"         │
│  └────┬────┘                                               │
│       │                                                     │
│       ▼                                                     │
│  ┌─────────────┐                                            │
│  │ Weather Tool│ ──▶ API call ──▶ {temp: 25, sunny: true} │
│  │  (Gateway)  │                                            │
│  └────┬────────┘                                            │
│       │                                                     │
│       ▼                                                     │
│  ┌─────────┐                                               │
│  │  LLM    │ ──▶ "It's 25°C and sunny in Tel Aviv!"       │
│  └─────────┘                                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Step 1: Create Tool Definitions

Create `lab2_tools.py`:

```python
"""
Lab 2: LangGraph Agent with Tools
Demonstrates tool calling with LangGraph tools.
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
    inventory = {"P001": 15, "P002": 50, "P003": 8}
    stock = inventory.get(product_id, 0)
    return f"{stock} units available" if stock > 0 else "Out of stock"

# Tool list
tools = [search_products, calculate_shipping, check_inventory]

# Bind tools to LLM
llm = ChatBedrock(
    model_id="anthropic.claude-3-sonnet-20240229-v1:0",
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
    print("🤖 E-commerce Agent with Tools\n")
    
    # Test 1: Product search
    print("Test 1: Searching for laptops...")
    result = app.invoke({
        "messages": [{"role": "user", "content": "Find me a laptop"}]
    })
    print(result["messages"][-1].content)
    print()
    
    # Test 2: Multi-tool workflow
    print("Test 2: Complete order workflow...")
    result = app.invoke({
        "messages": [{"role": "user", "content": "I want to buy P001. Check if it's in stock and calculate shipping to Tel Aviv (weight 2kg)"}]
    })
    print(result["messages"][-1].content)
```

### Step 2: Test Tool Calling

```bash
cd lab2
python lab2_tools.py
```

---

## Lab 3: Add Memory with LangGraph

### Why Memory Matters

Without memory, every conversation starts fresh:
```
User: "My name is David"
Agent: "Nice to meet you, David!"
User: "What's my name?"
Agent: "I'm not sure, could you tell me?" ❌
```

With memory:
```
User: "My name is David"
Agent: "Nice to meet you, David!"
User: "What's my name?"
Agent: "Your name is David!" ✅
```

### Step 1: Implement Memory

Create `lab3_memory.py`:

```python
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

# State definition
class AgentState(TypedDict):
    messages: Annotated[list, add_messages]
    user_preferences: dict  # Persistent memory

# Initialize LLM
llm = ChatBedrock(
    model_id="anthropic.claude-3-sonnet-20240229-v1:0",
    region_name="us-east-1"
)

def agent_with_memory(state: AgentState):
    """Agent that uses both conversation history and persistent memory."""
    messages = state["messages"]
    prefs = state.get("user_preferences", {})
    
    # Build context from memory
    memory_context = ""
    if prefs:
        memory_context = "Known user preferences:\n"
        for key, value in prefs.items():
            memory_context += f"- {key}: {value}\n"
    
    system_prompt = f"""You are a helpful assistant with memory.
    
{memory_context}

Remember user preferences when they mention them (favorite color, name, etc).
If they ask about something you should remember, use the preferences above."""
    
    response = llm.invoke([
        {"role": "system", "content": system_prompt},
        *messages
    ])
    
    # Extract new preferences from conversation
    # (In production, use a separate extraction step)
    content = response.content.lower()
    new_prefs = {}
    
    if "my name is" in content:
        # Extract name (simplified)
        pass
    
    updated_prefs = {**prefs, **new_prefs}
    
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
    
    print(f"🧠 Agent with Memory (Thread: {thread_id[:8]})\n")
    
    # Conversation 1
    print("User: My name is Sarah and I love Python")
    result = app.invoke(
        {"messages": [{"role": "user", "content": "My name is Sarah and I love Python"}], "user_preferences": {}},
        config
    )
    print(f"Agent: {result['messages'][-1].content}\n")
    
    # Conversation 2 (same thread - should remember!)
    print("User: What's my favorite programming language?")
    result = app.invoke(
        {"messages": [{"role": "user", "content": "What's my favorite programming language?"}]},
        config
    )
    print(f"Agent: {result['messages'][-1].content}\n")
    
    # Conversation 3 (same thread - should remember name!)
    print("User: What did I tell you my name was?")
    result = app.invoke(
        {"messages": [{"role": "user", "content": "What did I tell you my name was?"}]},
        config
    )
    print(f"Agent: {result['messages'][-1].content}")
```

---

## Lab 4: LangSmith Integration for Validation

### What is LangSmith?

LangSmith is an observability platform for LLM applications:
- **Tracing**: See every step of your agent's execution
- **Evaluation**: Test your agent against expected outputs
- **Monitoring**: Track performance in production

```
┌─────────────────────────────────────────────────────────────┐
│  LangSmith Dashboard                                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Traces                                                     │
│  ├── Trace #1: "What's the weather?"                       │
│  │   ├── LLM Call (2.3s, 1,240 tokens)                     │
│  │   ├── Tool Call: weather_api (0.8s)                     │
│  │   └── LLM Call (1.1s, 890 tokens)                      │
│  │                                                          │
│  ├── Trace #2: "Book a meeting"                            │
│  │   ├── LLM Call (1.9s, 980 tokens)                       │
│  │   └── Tool Call: calendar_api (1.2s)                   │
│  │                                                          │
│  Evaluations                                                │
│  ├── Correctness: 94% ✅                                   │
│  ├── Helpfulness: 91% ✅                                   │
│  └── Latency: 2.1s avg ⚠️                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Step 1: Setup LangSmith

```bash
# Sign up at https://smith.langchain.com
# Get API key from settings

export LANGSMITH_API_KEY="ls-..."
export LANGSMITH_PROJECT="aws-agentcore-lab"
export LANGSMITH_TRACING_V2="true"
```

### Step 2: Add LangSmith Tracing

Create `lab4_langsmith.py`:

```python
"""
Lab 4: LangGraph Agent with LangSmith Tracing
Full observability for validation and debugging.
"""

import os
from typing import TypedDict, Annotated
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langchain_aws import ChatBedrock
from langchain_core.tools import tool
from langsmith import Client
from langsmith.evaluation import evaluate

# Set LangSmith environment variables
os.environ["LANGSMITH_TRACING_V2"] = "true"
os.environ["LANGSMITH_PROJECT"] = "aws-agentcore-lab"
# os.environ["LANGSMITH_API_KEY"] = "your-api-key"  # Set this!

# State
class AgentState(TypedDict):
    messages: Annotated[list, add_messages]

# Tool
@tool
def calculator(expression: str) -> str:
    """Calculate mathematical expressions."""
    try:
        result = eval(expression)  # Safe in controlled environments
        return str(result)
    except:
        return "Error: Invalid expression"

# LLM with tools
llm = ChatBedrock(
    model_id="anthropic.claude-3-sonnet-20240229-v1:0",
    region_name="us-east-1"
).bind_tools([calculator])

def agent_node(state: AgentState):
    """Agent with automatic LangSmith tracing."""
    messages = state["messages"]
    
    response = llm.invoke(messages)
    return {"messages": [response]}

# Build graph
workflow = StateGraph(AgentState)
workflow.add_node("agent", agent_node)
workflow.set_entry_point("agent")
workflow.add_edge("agent", END)

app = workflow.compile()

# Run with tracing
if __name__ == "__main__":
    print("🔍 Running with LangSmith Tracing\n")
    
    # This will automatically create a trace in LangSmith
    result = app.invoke({
        "messages": [{"role": "user", "content": "What is 15 * 24 + 100?"}]
    })
    
    print(f"Response: {result['messages'][-1].content}")
    print("\n✅ Check LangSmith dashboard for the trace!")
    print("   https://smith.langchain.com")

# Evaluation function
def run_evaluation():
    """Run automated evaluation on test cases."""
    
    test_cases = [
        {
            "input": "What is 10 + 20?",
            "expected": "30"
        },
        {
            "input": "Calculate 5 * 8",
            "expected": "40"
        }
    ]
    
    def target_fn(inputs):
        result = app.invoke({"messages": [{"role": "user", "content": inputs["input"]}]})
        return {"output": result["messages"][-1].content}
    
    # Run evaluation
    results = evaluate(
        target_fn,
        data=test_cases,
        evaluators=["criteria"]  # Use built-in evaluators
    )
    
    return results

if __name__ == "__main__" and "--eval" in os.sys.argv:
    print("Running evaluation...")
    run_evaluation()
```

### Step 3: View Traces

```bash
# Run the agent
python lab4_langsmith.py

# View in browser
open https://smith.langchain.com
```

---

## Lab 5: Deploy to AgentCore Runtime

### Understanding AgentCore Runtime

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Local Development                    AgentCore Runtime         │
│  ─────────────────                    ─────────────────         │
│                                                                 │
│  python agent.py                      agentcore deploy          │
│       │                                    │                    │
│       ▼                                    ▼                    │
│  ┌──────────┐                      ┌──────────────┐            │
│  │ Your     │                      │ Serverless   │            │
│  │ Laptop   │                      │ Environment  │            │
│  └──────────┘                      ├──────────────┤            │
│                                    │ • Auto-scale │            │
│                                    │ • Isolation  │            │
│                                    │ • No servers │            │
│                                    │ • Pay per use│            │
│                                    └──────────────┘            │
│                                                                 │
│  Access via:                        Access via:                 │
│  localhost                          HTTPS endpoint              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Step 1: Create AgentCore Configuration

Create `agentcore.yaml`:

```yaml
# AgentCore Runtime Configuration
name: my-langgraph-agent
description: A LangGraph agent deployed on AWS Bedrock AgentCore

# Runtime settings
runtime:
  type: python
  entrypoint: agent.py
  
# Environment variables
environment:
  AWS_REGION: us-east-1
  MODEL_ID: anthropic.claude-3-sonnet-20240229-v1:0
  
# Resources
resources:
  memory: 512MB
  timeout: 300  # 5 minutes
  
# Integrations
integrations:
  # Connect to AgentCore Gateway for tools
  gateway:
    enabled: true
    
  # Connect to AgentCore Memory
  memory:
    enabled: true
    
  # Connect to LangSmith for tracing
  tracing:
    provider: langsmith
    api_key: ${LANGSMITH_API_KEY}
```

### Step 2: Prepare Deployment Package

Create `agent.py` (production version):

```python
"""
Production LangGraph Agent for AgentCore Runtime.
This is the entrypoint for the deployed agent.
"""

import json
import os
from typing import TypedDict, Annotated
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langchain_aws import ChatBedrock
from langchain_core.tools import tool

# State
class AgentState(TypedDict):
    messages: Annotated[list, add_messages]

# Tools (connected via Gateway in production)
@tool
def search_knowledge(query: str) -> str:
    """Search internal knowledge base."""
    # In production, this calls your API via Gateway
    return f"Results for '{query}': [Mock data]"

# Initialize
llm = ChatBedrock(
    model_id=os.environ.get("MODEL_ID", "anthropic.claude-3-sonnet-20240229-v1:0"),
    region_name=os.environ.get("AWS_REGION", "us-east-1")
).bind_tools([search_knowledge])

def agent_node(state: AgentState):
    messages = state["messages"]
    
    system = """You are a helpful AI assistant running on AWS Bedrock AgentCore.
    You have access to tools via the AgentCore Gateway.
    Be concise and helpful."""
    
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

# AgentCore Runtime handler
def lambda_handler(event, context):
    """
    Lambda handler for AgentCore Runtime.
    This is invoked when the agent receives a request.
    """
    try:
        # Parse input
        body = json.loads(event.get("body", "{}"))
        user_message = body.get("message", "")
        thread_id = body.get("thread_id", "default")
        
        # Run agent
        result = app.invoke(
            {"messages": [{"role": "user", "content": user_message}]},
            config={"configurable": {"thread_id": thread_id}}
        )
        
        # Return response
        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({
                "response": result["messages"][-1].content,
                "thread_id": thread_id
            })
        }
    
    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)})
        }

# For local testing
if __name__ == "__main__":
    # Simulate an event
    test_event = {
        "body": json.dumps({
            "message": "Hello, what can you do?",
            "thread_id": "test-123"
        })
    }
    result = lambda_handler(test_event, None)
    print(json.dumps(result, indent=2))
```

### Step 3: Deploy with AgentCore CLI

**Prerequisites:**
- AWS credentials configured (`aws configure` or environment variables)
- AgentCore CLI installed: `pip install bedrock-agentcore-starter-toolkit`

**Deploy:**

```bash
# Deploy (uses your AWS credentials - no separate login needed)
agentcore deploy \
  --name my-langgraph-agent \
  --file agentcore.yaml \
  --region us-east-1

# Check deployment status
agentcore status --name my-langgraph-agent

# The CLI will output the endpoint URL after successful deployment
# Test the deployed agent
curl -X POST https://<endpoint>/invoke \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello!", "thread_id": "test-1"}'
```

**Note:** The CLI automatically packages your code, uploads to S3, and deploys to AgentCore Runtime. No manual S3 upload needed!

---

## Lab 6: Production Monitoring with LangSmith + CloudWatch

### Full Observability Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                     Production Environment                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │          AWS Bedrock AgentCore Runtime                   │  │
│   │  ┌─────────────────────────────────────────────────┐    │  │
│   │  │         Your LangGraph Agent                     │    │  │
│   │  │                                                  │    │  │
│   │  │  ┌────────┐    ┌────────┐    ┌────────┐       │    │  │
│   │  │  │ Node 1 │───▶│ Node 2 │───▶│ Node 3 │       │    │  │
│   │  │  └────────┘    └────────┘    └────────┘       │    │  │
│   │  │       │            │            │              │    │  │
│   │  │       └────────────┴────────────┘              │    │  │
│   │  │                  │                              │    │  │
│   │  │                  ▼                              │    │  │
│   │  │         ┌─────────────┐                       │    │  │
│   │  │         │  Traces     │───────────────────────┼────┼──┼────▶
│   │  │         │  (internal) │                       │    │  │      │
│   │  │         └─────────────┘                       │    │  │      │
│   │  └─────────────────────────────────────────────────┘    │  │      │
│   └─────────────────────────────────────────────────────────┘  │      │
│                              │                                 │      │
│                              │ Traces                          │      │
│                              ▼                                 │      │
│   ┌─────────────────────────────────────────────────────────┐  │      │
│   │                   LangSmith                              │  │      │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │  │      │
│   │  │   Traces    │  │  Metrics    │  │Evaluations  │      │  │      │
│   │  │  (detailed) │  │  (latency,  │  │  (quality)   │      │  │      │
│   │  │             │  │   tokens)   │  │              │      │  │      │
│   │  └─────────────┘  └─────────────┘  └─────────────┘      │  │      │
│   └─────────────────────────────────────────────────────────┘  │      │
│                              │                                 │      │
│                              │ Metrics                         │      │
│                              ▼                                 │      │
│   ┌─────────────────────────────────────────────────────────┐  │      │
│   │              Amazon CloudWatch                           │◀─┘      │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│   │  │  Dashboards │  │  Alarms    │  │   Logs      │              │
│   │  │             │  │  (latency) │  │  (errors)   │              │
│   │  └─────────────┘  └─────────────┘  └─────────────┘              │
│   └─────────────────────────────────────────────────────────┘        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Step 1: Configure Production Monitoring

Create `monitoring.py`:

```python
"""
Lab 6: Production Monitoring Setup
Configure LangSmith and CloudWatch for production observability.
"""

import os
from langsmith import Client
import boto3

# Configuration
LANGSMITH_PROJECT = "agentcore-production"
CLOUDWATCH_NAMESPACE = "AgentCore/LangGraph"

def setup_langsmith_project():
    """Create a dedicated production project in LangSmith."""
    client = Client()
    
    # Create project if it doesn't exist
    try:
        project = client.create_project(
            project_name=LANGSMITH_PROJECT,
            description="Production monitoring for AgentCore LangGraph agents"
        )
        print(f"✅ Created LangSmith project: {LANGSMITH_PROJECT}")
        return project
    except Exception as e:
        print(f"ℹ️ Project may already exist: {e}")
        return None

def create_cloudwatch_dashboard():
    """Create a CloudWatch dashboard for agent metrics."""
    cloudwatch = boto3.client('cloudwatch', region_name='us-east-1')
    
    dashboard_body = {
        "widgets": [
            {
                "type": "metric",
                "properties": {
                    "title": "Agent Latency",
                    "metrics": [
                        [CLOUDWATCH_NAMESPACE, "ResponseTime", "Agent", "my-langgraph-agent"]
                    ],
                    "period": 60,
                    "stat": "Average"
                }
            },
            {
                "type": "metric",
                "properties": {
                    "title": "Token Usage",
                    "metrics": [
                        [CLOUDWATCH_NAMESPACE, "InputTokens", "Agent", "my-langgraph-agent"],
                        [CLOUDWATCH_NAMESPACE, "OutputTokens", "Agent", "my-langgraph-agent"]
                    ],
                    "period": 300
                }
            },
            {
                "type": "metric",
                "properties": {
                    "title": "Error Rate",
                    "metrics": [
                        [CLOUDWATCH_NAMESPACE, "Errors", "Agent", "my-langgraph-agent"]
                    ],
                    "period": 60
                }
            }
        ]
    }
    
    cloudwatch.put_dashboard(
        DashboardName="AgentCore-LangGraph-Production",
        DashboardBody=str(dashboard_body).replace("'", '"')
    )
    print("✅ Created CloudWatch dashboard")

def setup_alarms():
    """Set up CloudWatch alarms for critical metrics."""
    cloudwatch = boto3.client('cloudwatch', region_name='us-east-1')
    
    # High latency alarm
    cloudwatch.put_metric_alarm(
        AlarmName="AgentCore-HighLatency",
        ComparisonOperator="GreaterThanThreshold",
        EvaluationPeriods=2,
        MetricName="ResponseTime",
        Namespace=CLOUDWATCH_NAMESPACE,
        Period=60,
        Statistic="Average",
        Threshold=5.0,  # 5 seconds
        ActionsEnabled=True,
        AlarmDescription="Alert when agent response time exceeds 5 seconds"
    )
    print("✅ Created latency alarm")

if __name__ == "__main__":
    print("🔧 Setting up production monitoring...\n")
    
    setup_langsmith_project()
    create_cloudwatch_dashboard()
    setup_alarms()
    
    print("\n✅ Production monitoring configured!")
    print("\n📊 Dashboard URLs:")
    print("   LangSmith: https://smith.langchain.com")
    print("   CloudWatch: https://console.aws.amazon.com/cloudwatch")
```

---

## Summary: Complete Learning Path

```
┌─────────────────────────────────────────────────────────────────┐
│                    Learning Path                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1️⃣  LangGraph Basics                                          │
│      └── StateGraph, nodes, edges                              │
│                                                                 │
│  2️⃣  Tools & Gateway                                           │
│      └── ToolNode, API integration, MCP                         │
│                                                                 │
│  3️⃣  Memory & State                                            │
│      └── Checkpointer, persistent storage                       │
│                                                                 │
│  4️⃣  LangSmith Tracing                                         │
│      └── Traces, evaluation, debugging                          │
│                                                                 │
│  5️⃣  AgentCore Deployment                                      │
│      └── Runtime, serverless, scaling                           │
│                                                                 │
│  6️⃣  Production Monitoring                                     │
│      └── CloudWatch, dashboards, alarms                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Next Steps

1. **Complete Labs 1-4 locally** to understand LangGraph fundamentals
2. **Deploy Lab 5 to AgentCore** for production experience
3. **Set up monitoring (Lab 6)** for real-world observability
4. **Experiment** with your own use cases!

## Resources

- **LangGraph Docs**: https://langchain-ai.github.io/langgraph/
- **LangSmith**: https://smith.langchain.com
- **AgentCore Docs**: https://docs.aws.amazon.com/bedrock-agentcore/
- **LangChain AWS**: https://python.langchain.com/docs/integrations/providers/aws/

---

*Happy building! 🚀*
