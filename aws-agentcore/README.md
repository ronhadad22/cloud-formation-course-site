# Amazon Bedrock AgentCore — Learning Guide

## What is Amazon Bedrock AgentCore?

Amazon Bedrock AgentCore is an **agentic platform** for building, deploying, and operating AI agents securely at scale — **without managing infrastructure**.

Think of it this way:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│   Traditional AI App                    With AgentCore                  │
│   ─────────────────                     ──────────────                  │
│                                                                         │
│   You build the agent  ✅               You build the agent  ✅        │
│   You build the infra  😫               AgentCore handles it  ✅       │
│   You handle scaling   😫               AgentCore handles it  ✅       │
│   You manage security  😫               AgentCore handles it  ✅       │
│   You build monitoring 😫               AgentCore handles it  ✅       │
│   You manage memory    😫               AgentCore handles it  ✅       │
│                                                                         │
│   Focus: 30% agent, 70% infra          Focus: 90% agent, 10% config   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**In one sentence**: AgentCore lets you focus on building your AI agent's logic while AWS handles the deployment, scaling, security, memory, and monitoring.

---

## What Problem Does It Solve?

Building an AI agent is easy. **Running it in production is hard.**

| Challenge | Without AgentCore | With AgentCore |
|-----------|-------------------|----------------|
| Where does the agent run? | You set up EC2/ECS/Lambda, configure networking, handle cold starts | **Serverless runtime** — just upload your code |
| How does it scale? | You configure auto-scaling, load balancers, capacity planning | **Auto-scales** from 0 to thousands of sessions |
| How does it remember users? | You build a database layer for conversation history | **Built-in memory** — short-term and long-term |
| How does it call APIs/tools? | You write custom integrations for each tool | **Gateway** — converts APIs into agent-compatible tools |
| How do you control what it does? | You write custom guardrails in your code | **Policy engine** — natural language rules enforced in real-time |
| How do you know if it's working? | You build custom logging and dashboards | **Observability** — CloudWatch dashboards + OpenTelemetry |
| How do you handle auth? | You build OAuth flows, token management | **Identity service** — integrates with existing IdPs |
| How do you test quality? | Manual testing, hope for the best | **Evaluations** — automated scoring of agent interactions |

---

## The 9 Services of AgentCore

AgentCore is **modular** — you can use all services together or pick only what you need.

```
┌───────────────────────────────────────────────────────────────────┐
│                     Amazon Bedrock AgentCore                       │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│   BUILD                          DEPLOY                           │
│   ─────                          ──────                           │
│   ┌──────────┐ ┌──────────┐     ┌──────────┐ ┌──────────┐       │
│   │ Gateway  │ │ Memory   │     │ Runtime  │ │ Identity │       │
│   │ (Tools)  │ │ (Context)│     │ (Run)    │ │ (Auth)   │       │
│   └──────────┘ └──────────┘     └──────────┘ └──────────┘       │
│   ┌──────────┐ ┌──────────┐     ┌──────────┐                     │
│   │ Code     │ │ Browser  │     │ Policy   │                     │
│   │Interpret.│ │ (Web)    │     │ (Rules)  │                     │
│   └──────────┘ └──────────┘     └──────────┘                     │
│                                                                   │
│   MONITOR                                                         │
│   ───────                                                         │
│   ┌──────────────┐ ┌──────────────┐                               │
│   │Observability │ │ Evaluations  │                               │
│   │ (Dashboards) │ │ (Quality)    │                               │
│   └──────────────┘ └──────────────┘                               │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

---

### 1. Runtime — Where Your Agent Runs

**What it is**: A serverless environment that runs your AI agent code. You upload code or a container, and AgentCore handles everything else.

**Real-world analogy**: Like AWS Lambda, but purpose-built for AI agents. It understands that agents need longer execution times, conversation sessions, and multi-step reasoning.

```
┌─────────────────────────────────────────────────────┐
│  Without Runtime:                                    │
│                                                     │
│  You → EC2 instance → install Python → install deps │
│      → configure networking → set up auto-scaling   │
│      → handle cold starts → manage sessions         │
│      → monitor memory usage → patch OS              │
│                                                     │
│  With Runtime:                                       │
│                                                     │
│  You → upload agent code → done ✅                  │
└─────────────────────────────────────────────────────┘
```

**Key features:**
- **Serverless** — no servers to manage, pay only for active usage
- **Session isolation** — each user session is completely isolated (no data leakage between users)
- **Low-latency to 8-hour tasks** — supports quick chat responses AND long-running background agents
- **Any framework** — works with LangGraph, CrewAI, Strands Agents, LlamaIndex, Google ADK, OpenAI Agents SDK
- **Any model** — Claude, GPT, Gemini, Llama, Amazon Nova, Mistral, etc.
- **Deployable via** — code upload or containers

---

### 2. Gateway — Connecting Agents to Tools

**What it is**: Turns your existing APIs, Lambda functions, and services into tools that AI agents can use. Also connects to MCP (Model Context Protocol) servers.

**Real-world analogy**: Like an "API translator" — it takes your existing backend and makes it understandable to AI agents.

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   Your Existing APIs              AI Agent                  │
│   ─────────────────               ────────                  │
│   REST API /orders    ──┐                                   │
│   Lambda getUser()    ──┤── Gateway ──→  Agent can call:    │
│   Database query      ──┤  (converts)    "get_orders"       │
│   Slack webhook       ──┤               "lookup_user"       │
│   JIRA API            ──┘               "query_database"    │
│                                         "send_slack_msg"    │
│                                         "create_jira_task"  │
│                                                             │
│   You don't rewrite your backend!                           │
│   Gateway wraps it for the agent.                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Key features:**
- Converts **OpenAPI specs** and **Lambda functions** into agent-compatible tools
- Connects to existing **MCP servers** (the new standard for agent-tool communication)
- **Semantic search** for tool discovery — agent finds the right tool automatically
- Popular integrations: **Salesforce, Zoom, JIRA, Slack**, etc.

---

### 3. Memory — Agents That Remember

**What it is**: A managed service that gives agents both short-term memory (within a conversation) and long-term memory (across sessions).

**Real-world analogy**: Like giving your agent a notepad (short-term) AND a filing cabinet (long-term).

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   Short-Term Memory (within a session)                      │
│   ──────────────────────────────────                        │
│   User: "My name is David"                                  │
│   Agent: "Hi David!"                                        │
│   User: "What's my name?"                                   │
│   Agent: "Your name is David" ← remembers from this chat    │
│                                                             │
│   Long-Term Memory (across sessions)                        │
│   ────────────────────────────────                          │
│   Session 1 (Monday):  "I prefer Python over Java"          │
│   Session 2 (Friday):  "Write me some code"                 │
│   Agent: writes Python code ← remembers your preference!    │
│                                                             │
│   Shared Memory (across agents)                             │
│   ───────────────────────────                               │
│   Agent A learns: "Customer prefers email over phone"       │
│   Agent B (different team): uses that knowledge too          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Key features:**
- **Short-term memory** — multi-turn conversation context
- **Long-term memory** — persists across sessions, learns from interactions
- **Shared memory stores** — multiple agents can share knowledge
- **No infrastructure** — no database to set up or manage
- Works with LangGraph, LangChain, Strands, LlamaIndex

---

### 4. Identity — Agent Authentication

**What it is**: Manages how agents authenticate and access resources on behalf of users. Integrates with your existing identity providers.

**Real-world analogy**: Like giving your agent an employee badge that grants it specific permissions, based on which user it's acting for.

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│   User (logged in via Okta/Azure AD/Cognito)        │
│     │                                               │
│     │ "Book a meeting for me"                       │
│     ▼                                               │
│   Agent (gets delegated permissions)                │
│     │                                               │
│     ├──→ Google Calendar API (as the user)          │
│     ├──→ Slack API (as the user)                    │
│     └──→ AWS Resources (with scoped permissions)    │
│                                                     │
│   The agent acts ON BEHALF of the user              │
│   with only the permissions that user has.          │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Key features:**
- Works with **any Identity Provider** — Cognito, Okta, Azure AD, Auth0
- **Delegated access** — agent gets user's permissions, not admin access
- **Pre-authorized consent** — users approve what agents can do
- No need to migrate users or rebuild auth flows

---

### 5. Policy — Guardrails for Agent Actions

**What it is**: A rules engine that controls what agents can and cannot do. Write rules in **natural language** or in Cedar (AWS's policy language). Enforced in real-time before every tool call.

**Real-world analogy**: Like a manager who reviews every action before the agent does it. "You can read customer data but NOT delete it."

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   Agent wants to call: delete_customer_account("john123")   │
│     │                                                       │
│     ▼                                                       │
│   Policy Engine checks rules:                               │
│     Rule 1: "Agents cannot delete customer accounts"  ❌    │
│     Rule 2: "Agents can only read data during weekends" ✅  │
│     Rule 3: "Agents cannot access financial data > $10K" ✅ │
│     │                                                       │
│     ▼                                                       │
│   ❌ BLOCKED — action violates Rule 1                       │
│                                                             │
│   The agent NEVER executes the action.                      │
│   Policy intercepts it before it happens.                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Key features:**
- Write policies in **natural language** (auto-converted to Cedar)
- Integrates with **Gateway** — intercepts every tool call in real-time
- Fine-grained: control by tool, action, user, time, data value, etc.
- Doesn't slow down the agent — enforcement is milliseconds

---

### 6. Code Interpreter — Agents That Write & Run Code

**What it is**: A sandboxed environment where agents can write and execute code (Python, JavaScript, TypeScript) to solve complex tasks.

**Use cases:**
- Agent generates a chart from data → executes matplotlib code → returns the image
- Agent writes a data transformation script → runs it → gives you clean data
- Agent solves a math problem → writes Python to verify the answer

**Key features:**
- **Sandboxed** — code runs in an isolated environment (safe)
- **Multiple languages** — Python, JavaScript, TypeScript
- Large-scale data processing supported

---

### 7. Browser — Agents That Browse the Web

**What it is**: A cloud-based browser environment that lets agents interact with websites — fill forms, click buttons, navigate, extract data.

**Use cases:**
- Agent fills out expense reports on a web portal
- Agent scrapes product prices from competitor websites
- Agent submits forms on internal tools that don't have APIs

**Key features:**
- Managed Chromium instances in the cloud
- Works with **Playwright** and **BrowserUse** frameworks
- Reduced CAPTCHA interruptions
- Auto-scales from 0 to hundreds of browser sessions

---

### 8. Observability — Monitoring Agent Behavior

**What it is**: Dashboards and tracing powered by Amazon CloudWatch that show you exactly what your agent is doing.

```
┌─────────────────────────────────────────────────────────────┐
│  AgentCore Observability Dashboard                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  📊 Metrics                                                 │
│  ├── Total sessions: 15,420                                 │
│  ├── Avg latency: 2.3s                                      │
│  ├── Token usage: 12.5M tokens                              │
│  ├── Error rate: 0.3%                                       │
│  └── Avg session duration: 4.2 min                          │
│                                                             │
│  🔍 Trace Viewer (for a single request)                     │
│  ├── [0.0s] User message received                           │
│  ├── [0.1s] LLM call → Claude 3.5 Sonnet (1.2s)           │
│  ├── [1.3s] Tool call → get_customer_info (0.4s)           │
│  ├── [1.7s] LLM call → Claude 3.5 Sonnet (0.8s)           │
│  ├── [2.5s] Tool call → create_ticket (0.3s)               │
│  └── [2.8s] Response sent to user                           │
│                                                             │
│  See exactly where time is spent, what tools were called,   │
│  and what the LLM decided at each step.                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Key features:**
- Token usage, latency, session duration, error rates
- **Trace viewer** — step-by-step visualization of agent decisions
- **OpenTelemetry** compatible — integrates with your existing monitoring stack
- Powered by Amazon CloudWatch

---

### 9. Evaluations (Preview) — Testing Agent Quality

**What it is**: Automated testing that scores your agent's performance on criteria like correctness, helpfulness, safety, and goal success rate.

**Real-world analogy**: Like unit tests, but for AI agent behavior. "Did the agent give the right answer? Was it helpful? Was it safe?"

**Key features:**
- Built-in evaluators for common criteria
- Custom evaluators for your specific use cases
- Scores live interactions in production (not just pre-deployment tests)
- Results feed into Observability dashboards

---

## How the Services Work Together

Here's a complete flow of an AI agent handling a customer support request:

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  1. USER: "Cancel my order #12345"                                   │
│     │                                                                │
│     ▼                                                                │
│  2. IDENTITY: Verifies user is authenticated (via Okta)             │
│     Grants agent permission to act on behalf of this user            │
│     │                                                                │
│     ▼                                                                │
│  3. RUNTIME: Agent code starts in a serverless, isolated session    │
│     Agent uses Claude 3.5 Sonnet to reason about the request         │
│     │                                                                │
│     ▼                                                                │
│  4. MEMORY: Loads context — "This user cancelled 3 orders last      │
│     month. Previous interaction: user complained about late          │
│     deliveries."                                                     │
│     │                                                                │
│     ▼                                                                │
│  5. GATEWAY: Agent decides to call "get_order_details" tool          │
│     Gateway translates this to your REST API call                    │
│     │                                                                │
│     ▼                                                                │
│  6. POLICY: Checks — "Can this agent cancel orders over $500?"      │
│     Order is $89 → ✅ ALLOWED                                       │
│     │                                                                │
│     ▼                                                                │
│  7. Agent calls "cancel_order" tool via Gateway                     │
│     Responds to user: "Order #12345 has been cancelled.              │
│     Given your recent delivery issues, I've also applied a           │
│     10% discount to your account."                                   │
│     │                                                                │
│     ▼                                                                │
│  8. MEMORY: Saves interaction to long-term memory                   │
│     │                                                                │
│     ▼                                                                │
│  9. OBSERVABILITY: Logs trace — 2 tool calls, 3 LLM calls,         │
│     total latency 3.2s, 1,200 tokens used                           │
│     │                                                                │
│     ▼                                                                │
│  10. EVALUATIONS: Scores this interaction —                         │
│      Correctness: 95%, Helpfulness: 98%, Safety: 100%               │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Framework & Model Compatibility

AgentCore is **framework-agnostic** and **model-agnostic**:

### Supported Frameworks
| Framework | Description |
|-----------|------------|
| **Strands Agents** | AWS's own open-source agent framework |
| **LangGraph** | LangChain's graph-based agent framework |
| **CrewAI** | Multi-agent collaboration framework |
| **LlamaIndex** | Data-centric agent framework |
| **Google ADK** | Google's Agent Development Kit |
| **OpenAI Agents SDK** | OpenAI's agent framework |
| **Custom** | Bring your own framework |

### Supported Models
| Provider | Models |
|----------|--------|
| **Anthropic** | Claude 3.5, Claude 4 |
| **Amazon** | Amazon Nova |
| **Meta** | Llama 3, Llama 4 |
| **OpenAI** | GPT-4o, GPT-4.1 |
| **Google** | Gemini |
| **Mistral** | Mistral Large, etc. |

### Supported Protocols
| Protocol | What it's for |
|----------|--------------|
| **MCP (Model Context Protocol)** | Standard for agent-tool communication |
| **A2A (Agent-to-Agent)** | Standard for agent-to-agent communication |

---

## Pricing Model

AgentCore uses **consumption-based pricing** — pay only for what you use:

| Service | Pricing Model |
|---------|--------------|
| **Runtime** | Pay per active compute time (like Lambda) |
| **Memory** | Pay per storage + read/write operations |
| **Gateway** | Pay per tool invocation |
| **Identity** | Pay per authentication event |
| **Code Interpreter** | Pay per execution time |
| **Browser** | Pay per browser session |
| **Observability** | CloudWatch pricing |
| **Evaluations** | Pay per evaluation |
| **Policy** | Pay per policy check |

**No upfront costs. No minimum fees.**

---

## When to Use AgentCore vs Other AWS AI Services

| You want to... | Use |
|----------------|-----|
| Build a simple chatbot with no tools | **Amazon Bedrock (Converse API)** |
| Build a managed agent with Bedrock-only models | **Amazon Bedrock Agents** |
| Build a complex agent with any framework + any model + enterprise features | **Amazon Bedrock AgentCore** ✅ |
| Fine-tune a model | **Amazon Bedrock / SageMaker** |
| Deploy a multi-agent system at scale | **Amazon Bedrock AgentCore** ✅ |
| Buy a pre-built agent | **Amazon Bedrock Marketplace** |

---

## Key Takeaways

1. **AgentCore is NOT an agent framework** — it's the **platform** that runs, secures, and monitors agents built with ANY framework
2. **Modular** — use any combination of the 9 services independently
3. **Framework-agnostic** — LangGraph, CrewAI, Strands, or your own
4. **Model-agnostic** — Claude, GPT, Gemini, Llama, Nova, or your own
5. **Serverless** — no infrastructure to manage
6. **Enterprise-ready** — VPC, PrivateLink, session isolation, IAM integration, CloudFormation support

---

## 🎓 Hands-On Labs

This repository contains a complete learning path with 6 progressive labs:

| Lab | Directory | Topic | What You'll Build |
|-----|-----------|-------|-------------------|
| **Lab 1** | `lab1/` | LangGraph Basics | A state machine agent that reasons step-by-step |
| **Lab 2** | `lab2/` | Tools & Actions | Agent with tool calling (product search, shipping, inventory) |
| **Lab 3** | `lab3/` | Memory & State | Agent with persistent conversation memory |
| **Lab 4** | `lab4/` | LangSmith Integration | Full observability with tracing and evaluation |
| **Lab 5** | `lab5/` | Deploy to AgentCore | Production deployment with AgentCore Runtime |
| **Lab 6** | `lab6/` | Production Monitoring | CloudWatch dashboards and alerts |

### Quick Start

```bash
# 1. Setup environment
./scripts/setup.sh
source venv/bin/activate

# 2. Run Lab 1
cd lab1
python lab1_basic_agent.py

# 3. See full guide
cat LAB-GUIDE.md
```

### Repository Structure

```
aws-agentcore/
├── README.md                    # This file - overview and concepts
├── LAB-GUIDE.md                 # Complete step-by-step lab guide
├── docs/
│   └── quickstart.md           # 10-minute quick start
├── lab1/                       # Basic LangGraph agent
│   ├── lab1_basic_agent.py
│   └── requirements.txt
├── lab2/                       # Agent with tools
│   └── lab2_tools.py
├── lab3/                       # Memory & persistence
│   └── lab3_memory.py
├── lab4/                       # LangSmith tracing
│   └── lab4_langsmith.py
├── lab5/                       # Production deployment
│   ├── agent.py                # Production agent code
│   ├── .bedrock_agentcore.yaml # Deployment config (dot prefix required)
│   ├── deploy.sh               # Deployment script
│   └── requirements.txt
├── lab6/                       # Monitoring
│   └── monitoring.py
├── cloudformation/             # AWS infrastructure
│   └── agentcore-infrastructure.yaml
└── scripts/
    └── setup.sh                # One-command setup
```

## Useful Links

- **Product page**: https://aws.amazon.com/bedrock/agentcore/
- **Documentation**: https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/what-is-bedrock-agentcore.html
- **Getting started**: https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/agentcore-get-started-toolkit.html
- **Pricing**: https://aws.amazon.com/bedrock/agentcore/pricing/
- **Blog post (launch)**: https://aws.amazon.com/blogs/aws/introducing-amazon-bedrock-agentcore-securely-deploy-and-operate-ai-agents-at-any-scale/
- **LangGraph Docs**: https://langchain-ai.github.io/langgraph/
- **LangSmith**: https://smith.langchain.com
