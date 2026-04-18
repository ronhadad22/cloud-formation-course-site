#!/bin/bash
# Setup script for AWS AgentCore Lab
# Installs dependencies and configures the environment

set -e

LAB_NAME="aws-agentcore"
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       AWS AgentCore Lab - Setup Script                     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check Python version
echo -e "${YELLOW}▶ Checking Python version...${NC}"
python_version=$(python3 --version 2>&1 | awk '{print $2}')
required_version="3.10"

if [ "$(printf '%s\n' "$required_version" "$python_version" | sort -V | head -n1)" != "$required_version" ]; then
    echo -e "${YELLOW}⚠ Python 3.10+ required. Found: $python_version${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Python version OK: $python_version${NC}"

# Check AWS CLI
echo ""
echo -e "${YELLOW}▶ Checking AWS CLI...${NC}"
if ! command -v aws &> /dev/null; then
    echo -e "${YELLOW}✗ AWS CLI not found. Please install it:${NC}"
    echo "  https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html"
    exit 1
fi
aws_version=$(aws --version | cut -d' ' -f1 | cut -d'/' -f2)
echo -e "${GREEN}✓ AWS CLI found: $aws_version${NC}"

# Check AWS credentials
echo ""
echo -e "${YELLOW}▶ Checking AWS credentials...${NC}"
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${YELLOW}✗ AWS credentials not configured.${NC}"
    echo "  Run: aws configure"
    exit 1
fi
account_id=$(aws sts get-caller-identity --query Account --output text)
echo -e "${GREEN}✓ AWS credentials OK (Account: $account_id)${NC}"

# Check Bedrock access
echo ""
echo -e "${YELLOW}▶ Checking Amazon Bedrock access...${NC}"
if ! aws bedrock list-foundation-models --region us-east-1 &> /dev/null; then
    echo -e "${YELLOW}✗ No Bedrock access. Request access in AWS Console:${NC}"
    echo "  https://us-east-1.console.aws.amazon.com/bedrock/home?region=us-east-1#/modelaccess"
    exit 1
fi
echo -e "${GREEN}✓ Bedrock access confirmed${NC}"

# Create virtual environment
echo ""
echo -e "${YELLOW}▶ Setting up Python virtual environment...${NC}"
if [ -d "venv" ]; then
    echo "  Virtual environment already exists"
else
    python3 -m venv venv
    echo -e "${GREEN}✓ Created virtual environment${NC}"
fi

# Activate and install dependencies
echo ""
echo -e "${YELLOW}▶ Installing dependencies...${NC}"
source venv/bin/activate
pip install --upgrade pip &> /dev/null

# Install all lab requirements
for lab in lab1 lab2 lab3 lab4 lab5; do
    if [ -f "$lab/requirements.txt" ]; then
        echo "  Installing $lab requirements..."
        pip install -q -r $lab/requirements.txt
    fi
done

echo -e "${GREEN}✓ Dependencies installed${NC}"

# Check for AgentCore CLI
echo ""
echo -e "${YELLOW}▶ Checking AgentCore CLI...${NC}"
if ! command -v agentcore &> /dev/null; then
    echo "  Installing AgentCore CLI..."
    pip install -q amazon-bedrock-agentcore
fi
agentcore_version=$(agentcore --version 2>&1 | tail -1)
echo -e "${GREEN}✓ AgentCore CLI: $agentcore_version${NC}"

# Create .env file template
echo ""
echo -e "${YELLOW}▶ Creating environment file template...${NC}"
cat > .env << EOF
# AWS Configuration
export AWS_REGION=us-east-1

# LangSmith Configuration (optional but recommended)
# Get API key from: https://smith.langchain.com
# export LANGSMITH_API_KEY="ls-your-key-here"
# export LANGSMITH_PROJECT="aws-agentcore-lab"
# export LANGSMITH_TRACING_V2="true"

# AgentCore Configuration
export AGENTCORE_REGION=us-east-1
EOF
echo -e "${GREEN}✓ Created .env template${NC}"

# Make scripts executable
echo ""
echo -e "${YELLOW}▶ Setting up scripts...${NC}"
chmod +x lab5/deploy.sh scripts/setup.sh 2>/dev/null || true
echo -e "${GREEN}✓ Scripts ready${NC}"

# Print summary
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                     Setup Complete!                        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Next steps:${NC}"
echo ""
echo "1. Activate the virtual environment:"
echo "   ${YELLOW}source venv/bin/activate${NC}"
echo ""
echo "2. Configure LangSmith (optional):"
echo "   ${YELLOW}export LANGSMITH_API_KEY='ls-your-key'${NC}"
echo "   ${YELLOW}export LANGSMITH_PROJECT='aws-agentcore-lab'${NC}"
echo ""
echo "3. Run Lab 1:"
echo "   ${YELLOW}cd lab1 && python lab1_basic_agent.py${NC}"
echo ""
echo "4. See the full guide:"
echo "   ${YELLOW}cat LAB-GUIDE.md${NC}"
echo ""
echo -e "${BLUE}Happy building! 🚀${NC}"
