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

# Deploy
echo ""
echo "📦 Deploying to AgentCore..."
echo "This may take a few minutes..."

agentcore deploy \
    --name "$AGENT_NAME" \
    --file agentcore.yaml \
    --region "$REGION" \
    --wait

echo ""
echo "✅ Deployment complete!"

# Get endpoint
echo ""
echo "Fetching endpoint information..."
agentcore status --name "$AGENT_NAME" --region "$REGION"

# Test the deployed agent
# Note: Extract endpoint from status output or use the URL shown after deploy

if [ -n "$ENDPOINT" ]; then
    echo ""
    echo "🧪 Testing deployed agent..."
    curl -s -X POST "$ENDPOINT/invoke" \
        -H "Content-Type: application/json" \
        -d '{"message": "Hello from deployment script!", "thread_id": "deploy-test-123"}' | head -c 500
    echo ""
fi

echo ""
echo "=========================================="
echo "🎉 Deployment successful!"
echo ""
echo "Next steps:"
echo "  1. Test your agent: curl -X POST $ENDPOINT/invoke -d '{\"message\": \"Hello\"}'"
echo "  2. View logs: agentcore obs --name $AGENT_NAME"
echo "  3. Monitor in LangSmith: https://smith.langchain.com"
echo "  4. Update agent: Run this script again after making changes"
echo ""
echo "To destroy the agent:"
echo "  agentcore destroy --name $AGENT_NAME --region $REGION"
