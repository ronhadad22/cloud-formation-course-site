#!/bin/bash
# Deployment script for Lab 5
# Deploys the LangGraph agent to AWS Bedrock AgentCore Runtime

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

# Check AWS credentials
echo "Verifying AWS credentials..."
aws sts get-caller-identity &> /dev/null || {
    echo "❌ AWS credentials not configured. Run: aws configure"
    exit 1
}
echo "✅ AWS credentials valid"

# Configuration
AGENT_NAME=${1:-"my-langgraph-agent"}
REGION=${2:-"us-east-1"}

echo ""
echo "Configuration:"
echo "  Agent Name: $AGENT_NAME"
echo "  Region: $REGION"
echo ""

# Check environment variables
if [ -z "$LANGSMITH_API_KEY" ]; then
    echo "⚠️  Warning: LANGSMITH_API_KEY not set. Tracing will be disabled."
    read -p "Continue without LangSmith? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Validate configuration file
if [ ! -f "agentcore.yaml" ]; then
    echo "❌ agentcore.yaml not found!"
    exit 1
fi

echo "✅ Configuration file found"

# Validate Python code
echo ""
echo "Validating Python code..."
python -m py_compile agent.py && echo "✅ agent.py is valid Python"

# Configure agent (if not already configured)
echo ""
echo "🔧 Configuring agent..."
agentcore configure \
    --agent "$AGENT_NAME" \
    --entrypoint agent.py \
    --requirements-file requirements.txt \
    --env AWS_REGION="$REGION" \
    --env MODEL_ID=eu.anthropic.claude-sonnet-4-6 \
    --auto-update-on-conflict

# Deploy
echo ""
echo "📦 Deploying to AgentCore..."
echo "This may take a few minutes..."

agentcore deploy \
    --agent "$AGENT_NAME" \
    --wait

echo ""
echo "✅ Deployment complete!"

# Get endpoint
echo ""
echo "Fetching endpoint information..."
agentcore status --agent "$AGENT_NAME"

# Test the deployed agent
# Note: The endpoint URL is shown in the status output above
echo ""
echo "🧪 To test your deployed agent:"
echo "  curl -X POST <endpoint-from-status>/invoke \\"
echo "    -H \"Content-Type: application/json\" \\"
echo "    -d '{\"message\": \"Hello!\", \"thread_id\": \"test-123\"}'"
echo ""

echo "=========================================="
echo "🎉 Deployment successful!"
echo ""
echo "Next steps:"
echo "  1. Get endpoint: agentcore status --agent $AGENT_NAME"
echo "  2. View logs: agentcore obs --agent $AGENT_NAME"
echo "  3. Monitor in LangSmith: https://smith.langchain.com"
echo "  4. Update agent: Run this script again after making changes"
echo ""
echo "To destroy the agent:"
echo "  agentcore destroy --agent $AGENT_NAME"
