# RAG and Agents Demo - AWS Course

This demo teaches students about **Retrieval-Augmented Generation (RAG)** and **AI Agents** using AWS services.

## What You'll Learn

1. **RAG (Retrieval-Augmented Generation)**
   - How to store and retrieve documents using vector embeddings
   - Using AWS Bedrock for embeddings and LLM inference
   - Building a knowledge base with Amazon OpenSearch or in-memory vector store
   - Combining retrieval with generation for accurate responses

2. **AI Agents**
   - Building agents that can use tools/functions
   - Tool calling and function execution
   - Multi-step reasoning and planning
   - Integration with AWS services (S3, DynamoDB, Lambda)

## Architecture

```
┌─────────────┐
│   User      │
└──────┬──────┘
       │
       v
┌─────────────────────────────────────┐
│  Application (Python/Lambda)        │
│  ┌─────────────┐  ┌──────────────┐ │
│  │   RAG       │  │   Agent      │ │
│  │  Pipeline   │  │   System     │ │
│  └─────────────┘  └──────────────┘ │
└─────────────────────────────────────┘
       │                    │
       v                    v
┌─────────────┐      ┌─────────────┐
│ AWS Bedrock │      │   Tools     │
│  - Claude   │      │  - S3       │
│  - Titan    │      │  - DynamoDB │
└─────────────┘      └─────────────┘
       │
       v
┌─────────────┐
│ Vector DB   │
│ (OpenSearch)│
└─────────────┘
```

## Prerequisites

- AWS Account with Bedrock access
- Python 3.9+
- AWS CLI configured
- Basic understanding of LLMs

## AWS Services Used

- **Amazon Bedrock**: LLM inference and embeddings
- **Amazon OpenSearch Serverless**: Vector database (optional)
- **AWS Lambda**: Serverless compute
- **Amazon S3**: Document storage
- **Amazon DynamoDB**: Conversation history
- **CloudFormation**: Infrastructure as Code

## Project Structure

```
rag-agents-demo/
├── README.md
├── requirements.txt
├── cloudformation/
│   └── infrastructure.yaml
├── rag/
│   ├── basic_rag.py          # Simple RAG implementation
│   ├── vector_store.py        # In-memory vector store
│   └── bedrock_rag.py         # Full RAG with Bedrock
├── agents/
│   ├── basic_agent.py         # Simple agent with tools
│   ├── tools.py               # Tool definitions
│   └── advanced_agent.py      # Multi-step agent
├── data/
│   └── sample_docs/           # Sample documents for RAG
└── exercises/
    ├── exercise1_rag.md
    └── exercise2_agents.md
```

## Quick Start

### 1. Setup Environment

```bash
cd rag-agents-demo
pip install -r requirements.txt
```

### 2. Configure AWS

```bash
aws configure
# Enable Bedrock models in AWS Console (us-east-1)
```

### 3. Deploy Infrastructure (Optional)

```bash
aws cloudformation create-stack \
  --stack-name rag-agents-demo \
  --template-body file://cloudformation/infrastructure.yaml \
  --capabilities CAPABILITY_IAM
```

### 4. Run Basic RAG Demo

```bash
python rag/basic_rag.py
```

### 5. Run Agent Demo

```bash
python agents/basic_agent.py
```

## Cost Considerations

- **Bedrock**: Pay per token (~$0.01-0.03 per 1K tokens)
- **OpenSearch Serverless**: ~$700/month (optional, can use in-memory)
- **Lambda**: Free tier covers most demos
- **S3/DynamoDB**: Minimal costs for demo

**Recommendation**: Use in-memory vector store for learning to avoid OpenSearch costs.

## Student Exercises

1. **Exercise 1**: Build a simple RAG system with your own documents
2. **Exercise 2**: Create an agent that can search and summarize documents
3. **Exercise 3**: Build a multi-agent system with specialized roles

## Resources

- [AWS Bedrock Documentation](https://docs.aws.amazon.com/bedrock/)
- [LangChain Documentation](https://python.langchain.com/)
- [RAG Concepts](https://aws.amazon.com/what-is/retrieval-augmented-generation/)

## License

Educational use only.
