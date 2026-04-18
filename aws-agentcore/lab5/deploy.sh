#!/bin/bash
# Deployment script for Lab 5
# Deploys the LangGraph agent to AWS Bedrock AgentCore Runtime
# Uses the official AWS AgentCore CLI (@aws/agentcore)

set -e  # Exit on error

echo "🚀 Deploying LangGraph Agent to AgentCore"
echo "=========================================="

# Check prerequisites
echo "Checking prerequisites..."

if ! command -v agentcore &> /dev/null; then
    echo "❌ agentcore CLI not found. Install with: npm install -g @aws/agentcore"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Install from https://nodejs.org/"
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
echo "� Deploying to AgentCore..."
echo "This may take a few minutes..."
echo ""

# The official CLI uses project-based deployment
# It reads configuration from agentcore.yaml automatically
agentcore deploy

echo ""
echo "✅ Deployment complete!"

# Get status
echo ""
echo "Fetching deployment status..."
agentcore status

echo ""
echo "=========================================="
echo "🎉 Deployment successful!"
echo ""
echo "Next steps:"
echo "  1. Test locally: agentcore dev \"Hello!\""
echo "  2. View logs: agentcore logs"
echo "  3. Monitor in LangSmith: https://smith.langchain.com"
echo "  4. Update: Make changes and run agentcore deploy again"
echo ""
echo "To destroy the agent:"
echo "  agentcore destroy"
