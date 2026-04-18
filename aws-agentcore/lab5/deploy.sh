#!/bin/bash
# Deployment script for Lab 5
# Deploys the LangGraph agent to AWS Bedrock AgentCore Runtime
# Uses bedrock-agentcore-starter-toolkit Python CLI

set -e  # Exit on error

echo "🚀 Deploying LangGraph Agent to AgentCore"
echo "=========================================="

# Check prerequisites
echo "Checking prerequisites..."

if ! command -v agentcore &> /dev/null; then
    echo "❌ agentcore CLI not found. Install with: pip install bedrock-agentcore-starter-toolkit"
    exit 1
fi

if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI not found. Please install it."
    exit 1
fi

# Check AWS credentials (supports SSO and regular credentials)
echo "Verifying AWS credentials..."
if [ -n "$AWS_PROFILE" ]; then
    echo "Using AWS profile: $AWS_PROFILE"
    aws sts get-caller-identity --profile "$AWS_PROFILE" &> /dev/null || {
        echo "❌ AWS SSO session expired. Run: aws sso login --profile $AWS_PROFILE"
        exit 1
    }
else
    aws sts get-caller-identity &> /dev/null || {
        echo "❌ AWS credentials not configured. Run: aws configure"
        echo "   Or set AWS_PROFILE for SSO: export AWS_PROFILE=iitc-profile"
        exit 1
    }
fi
echo "✅ AWS credentials valid"

# Validate configuration file
if [ ! -f ".bedrock_agentcore.yaml" ]; then
    echo "❌ .bedrock_agentcore.yaml not found!"
    echo "   The config file must be named .bedrock_agentcore.yaml (with dot prefix)"
    exit 1
fi

echo "✅ Configuration file found"

# Validate Python code
echo ""
echo "Validating Python code..."
python -m py_compile agent.py && echo "✅ agent.py is valid Python"

# Deploy
echo ""
echo "📦 Deploying to AgentCore..."
echo "This may take a few minutes..."
echo ""

# The Python CLI requires the agent name
# It reads configuration from .bedrock_agentcore.yaml automatically
agentcore deploy --agent my-langgraph-agent

echo ""
echo "✅ Deployment complete!"

# Get status
echo ""
echo "Fetching deployment status..."
agentcore status --agent my-langgraph-agent

echo ""
echo "=========================================="
echo "🎉 Deployment successful!"
echo ""
echo "Next steps:"
echo "  1. Check status: agentcore status --agent my-langgraph-agent"
echo "  2. View logs: agentcore obs --agent my-langgraph-agent"
echo "  3. Monitor in LangSmith: https://smith.langchain.com"
echo "  4. Update: Make changes and run ./deploy.sh again"
echo ""
echo "To destroy the agent:"
echo "  agentcore destroy --agent my-langgraph-agent"
