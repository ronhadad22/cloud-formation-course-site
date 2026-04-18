# Quick Start Guide — AWS AgentCore Lab

Get up and running with LangGraph + AgentCore + LangSmith in 10 minutes.

## Prerequisites

- Python 3.10+
- AWS CLI configured with credentials
- AWS account with Bedrock access

## 1. Setup Environment (2 minutes)

```bash
# Clone the repo
cd aws-agentcore

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r lab1/requirements.txt
```

## 2. Configure AWS (2 minutes)

```bash
# Set AWS region
export AWS_REGION=us-east-1

# Verify Bedrock access
aws bedrock list-foundation-models --region us-east-1
```

## 3. Configure LangSmith (Optional but Recommended)

```bash
# Sign up at https://smith.langchain.com
# Get API key from Settings

export LANGSMITH_API_KEY="ls-your-key-here"
export LANGSMITH_PROJECT="aws-agentcore-lab"
export LANGSMITH_TRACING_V2="true"
```

## 4. Run Lab 1 — Basic Agent (3 minutes)

```bash
cd lab1
python lab1_basic_agent.py
```

**Expected output:**
```
🤖 Running LangGraph Agent - Lab 1

=== Node: think ===
I need to calculate 23 * 47.

Let me break this down:
23 * 47 = 23 * (40 + 7)
        = (23 * 40) + (23 * 7)
        = 920 + 161
        = 1081

FINISHED

=== Node: __end__ ===
✅ Agent completed!
```

## 5. Run Lab 2 — Tools (3 minutes)

```bash
cd ../lab2
python lab2_tools.py
```

## 6. Deploy to AgentCore (5 minutes)

```bash
cd ../lab5

# Deploy (ensure AWS credentials are configured first)
# The script will configure and deploy the agent
./deploy.sh my-langgraph-agent eu-central-1

# Test deployed agent
curl -X POST https://<your-endpoint>/invoke \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello!", "thread_id": "test-1"}'
```

## What's Next?

- **Lab 3**: Add memory (conversation persistence)
- **Lab 4**: Set up LangSmith tracing
- **Lab 6**: Production monitoring

## Troubleshooting

### AWS Bedrock Access Denied
```bash
# Ensure your IAM user/role has Bedrock permissions
aws iam attach-user-policy \
  --user-name your-username \
  --policy-arn arn:aws:iam::aws:policy/AmazonBedrockFullAccess
```

### LangSmith Not Recording Traces
```bash
# Verify environment variables
echo $LANGSMITH_API_KEY
echo $LANGSMITH_TRACING_V2

# Test LangSmith connection
python -c "from langsmith import Client; Client().list_projects()"
```

### AgentCore CLI Not Found
```bash
pip install amazon-bedrock-agentcore
```

## Architecture Overview

```
Local Development                  Production
─────────────────                  ──────────
lab1_basic_agent.py   ──deploy──▶  AgentCore Runtime
      │                                    │
      │ traces                             │ traces
      ▼                                    ▼
  LangSmith   ◀───────────────────────  LangSmith
  (dashboard)                            (monitoring)
```

## Help

- LangGraph Docs: https://langchain-ai.github.io/langgraph/
- AgentCore Docs: https://docs.aws.amazon.com/bedrock-agentcore/
- LangSmith: https://smith.langchain.com
