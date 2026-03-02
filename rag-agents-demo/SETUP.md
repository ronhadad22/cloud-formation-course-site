# Setup Guide - RAG and Agents Demo

## Prerequisites

### 1. AWS Account Setup
- Active AWS account
- IAM user with appropriate permissions
- AWS CLI installed and configured

### 2. Enable AWS Bedrock Models

**Important**: You must enable model access in AWS Bedrock before running the demos.

1. Go to AWS Console → Amazon Bedrock
2. Navigate to "Model access" in the left sidebar
3. Click "Manage model access"
4. Enable the following models:
   - **Amazon Titan Embeddings G1 - Text** (for embeddings)
   - **Anthropic Claude 3 Sonnet** (for LLM)
5. Wait for access to be granted (usually instant)

**Supported Regions**: us-east-1, us-west-2, eu-west-1, ap-southeast-1

### 3. Python Environment

```bash
# Check Python version (3.9+ required)
python3 --version

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate
# On Windows:
# venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

## AWS Configuration

### Option 1: AWS CLI Configuration

```bash
aws configure
# Enter your:
# - AWS Access Key ID
# - AWS Secret Access Key
# - Default region (e.g., us-east-1)
# - Default output format (json)
```

### Option 2: Environment Variables

```bash
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
export AWS_DEFAULT_REGION="us-east-1"
```

### Option 3: IAM Role (for EC2/Lambda)

If running on EC2 or Lambda, attach an IAM role with these permissions:
- `bedrock:InvokeModel`
- `bedrock:InvokeModelWithResponseStream`

## Verify Setup

### Test AWS Credentials

```bash
aws sts get-caller-identity
```

Expected output:
```json
{
    "UserId": "AIDAXXXXXXXXXXXXXXXXX",
    "Account": "123456789012",
    "Arn": "arn:aws:iam::123456789012:user/your-username"
}
```

### Test Bedrock Access

```bash
aws bedrock list-foundation-models --region us-east-1
```

### Test Python Environment

```python
python3 << EOF
import boto3
import numpy as np

# Test Bedrock client
bedrock = boto3.client('bedrock-runtime', region_name='us-east-1')
print("✓ Bedrock client created successfully")

# Test dependencies
print("✓ All dependencies imported successfully")
EOF
```

## Running the Demos

### 1. Basic RAG Demo

```bash
cd rag
python basic_rag.py
```

Expected output:
- Document processing messages
- Embedding generation progress
- Query results with retrieved documents
- Generated answers

### 2. Advanced RAG Demo

```bash
cd rag
python bedrock_rag.py
```

Features demonstrated:
- Advanced chunking
- FAISS vector store
- Conversation history
- Reranking

### 3. Basic Agent Demo

```bash
cd agents
python basic_agent.py
```

Expected output:
- Agent task execution
- Tool usage logs
- Reasoning steps
- Final results

### 4. Advanced Agent Demo

```bash
cd agents
python advanced_agent.py
```

Features demonstrated:
- Planning phase
- Multi-step execution
- Reflection
- Multi-agent collaboration

## Deploy Infrastructure (Optional)

### Deploy CloudFormation Stack

```bash
cd cloudformation

aws cloudformation create-stack \
  --stack-name rag-agents-demo \
  --template-body file://infrastructure.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --region us-east-1
```

### Check Stack Status

```bash
aws cloudformation describe-stacks \
  --stack-name rag-agents-demo \
  --region us-east-1 \
  --query 'Stacks[0].StackStatus'
```

### Get Stack Outputs

```bash
aws cloudformation describe-stacks \
  --stack-name rag-agents-demo \
  --region us-east-1 \
  --query 'Stacks[0].Outputs'
```

## Troubleshooting

### Issue: "Model not found" or "Access denied"

**Solution**: 
1. Verify model access in Bedrock console
2. Check you're using the correct region
3. Wait a few minutes after enabling models

### Issue: "Rate limit exceeded"

**Solution**:
1. Add delays between requests
2. Use exponential backoff
3. Request quota increase in AWS console

### Issue: "Import error" for dependencies

**Solution**:
```bash
pip install --upgrade pip
pip install -r requirements.txt --force-reinstall
```

### Issue: "Insufficient permissions"

**Solution**:
Add these IAM policies to your user/role:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream",
        "bedrock:ListFoundationModels"
      ],
      "Resource": "*"
    }
  ]
}
```

### Issue: Slow performance

**Causes and Solutions**:
- **Large documents**: Reduce chunk size or document count
- **Many embeddings**: Use batch processing or caching
- **Network latency**: Use same region for all services

## Cost Estimation

### Bedrock Pricing (us-east-1, approximate):

**Claude 3 Sonnet:**
- Input: $0.003 per 1K tokens
- Output: $0.015 per 1K tokens

**Titan Embeddings:**
- $0.0001 per 1K tokens

### Example Costs:

**Basic RAG Demo:**
- 4 documents × 500 tokens = 2K tokens for embeddings = $0.0002
- 3 queries × 2K tokens (input + output) = $0.036
- **Total: ~$0.04**

**Agent Demo:**
- 4 tasks × 5K tokens average = $0.30
- **Total: ~$0.30**

**Daily Development (10 hours):**
- Estimated: $5-10 per day

### Cost Optimization Tips:
1. Use caching for embeddings
2. Limit context window size
3. Use smaller models for testing
4. Set up billing alerts

## Best Practices

### 1. Security
- Never commit AWS credentials
- Use IAM roles when possible
- Enable CloudTrail logging
- Rotate access keys regularly

### 2. Development
- Use version control (git)
- Test with small datasets first
- Monitor token usage
- Implement error handling

### 3. Production
- Use environment variables for config
- Implement rate limiting
- Add monitoring and logging
- Set up alerts for errors

## Environment Variables

Create a `.env` file (don't commit this):

```bash
AWS_REGION=us-east-1
EMBEDDING_MODEL=amazon.titan-embed-text-v1
LLM_MODEL=anthropic.claude-3-sonnet-20240229-v1:0
MAX_TOKENS=4096
TEMPERATURE=0.7
```

Load in Python:
```python
from dotenv import load_dotenv
import os

load_dotenv()
region = os.getenv('AWS_REGION', 'us-east-1')
```

## Next Steps

1. ✅ Complete setup verification
2. ✅ Run all demos successfully
3. 📚 Start with Exercise 1 (RAG)
4. 🤖 Progress to Exercise 2 (Agents)
5. 🚀 Deploy to production (optional)

## Support and Resources

- **AWS Bedrock Documentation**: https://docs.aws.amazon.com/bedrock/
- **Claude API Reference**: https://docs.anthropic.com/claude/reference
- **AWS Support**: https://console.aws.amazon.com/support/
- **Course Repository**: [Your repo URL]

## Getting Help

If you encounter issues:
1. Check the troubleshooting section above
2. Review AWS CloudWatch logs
3. Check AWS Service Health Dashboard
4. Contact course instructor
5. Open an issue in the repository

---

**Ready to start?** Run the basic RAG demo:
```bash
cd rag && python basic_rag.py
```
