# Agent Core Learning Guide

## Introduction

This guide will help you understand AWS Bedrock Agent Core concepts through practical examples.

## What You'll Learn

### 1. **Basic Concepts**

#### Simple Agent (`basic/01-simple-agent.ts`)
- Creating your first Bedrock agent
- Configuring foundation models
- Setting up IAM roles and permissions
- Understanding agent instructions

**Key Concepts:**
- `CfnAgent` - The core agent construct
- `agentResourceRoleArn` - IAM role for agent execution
- `foundationModel` - The LLM powering your agent
- `instruction` - System prompt defining agent behavior

#### Action Groups (`basic/02-action-groups.ts`)
- Defining agent capabilities
- Creating Lambda function handlers
- Using OpenAPI schemas
- Handling action parameters

**Key Concepts:**
- `CfnAgentActionGroup` - Defines what actions an agent can perform
- Lambda executors - Backend logic for actions
- OpenAPI schema - API contract for actions
- Parameter extraction and validation

#### Knowledge Bases (`basic/03-knowledge-base.ts`)
- Setting up vector databases
- Configuring S3 data sources
- Embedding models
- RAG (Retrieval Augmented Generation)

**Key Concepts:**
- `CfnKnowledgeBase` - Vector store for agent context
- OpenSearch Serverless - Vector database backend
- `CfnDataSource` - Where documents come from
- `CfnAgentKnowledgeBase` - Linking KB to agent

#### Guardrails (`basic/04-guardrails.ts`)
- Content filtering
- Topic restrictions
- PII detection and handling
- Safety controls

**Key Concepts:**
- `CfnGuardrail` - Safety and compliance controls
- Content policies - Filter harmful content
- Sensitive information policies - Protect PII
- Topic policies - Restrict certain subjects

### 2. **Advanced Patterns**

#### Multi-Agent Systems (`advanced/01-multi-agent-system.ts`)
- Agent orchestration
- Delegation patterns
- Inter-agent communication
- Specialized agents

**Use Cases:**
- Complex workflows requiring different expertise
- Routing queries to specialist agents
- Coordinating multiple AI capabilities

#### Custom Actions (`advanced/02-custom-actions.ts`)
- Complex business logic
- Database integration (DynamoDB)
- CRUD operations
- State management

**Use Cases:**
- Task management systems
- Data processing pipelines
- Stateful applications

#### RAG Pattern (`advanced/03-rag-pattern.ts`)
- Enhanced retrieval
- Custom processing
- Source citation
- Knowledge synthesis

**Use Cases:**
- Document Q&A systems
- Research assistants
- Knowledge management

### 3. **Production Patterns**

#### Error Handling (`patterns/error-handling.ts`)
- Custom exception classes
- Input validation
- Structured logging
- User-friendly error messages

**Best Practices:**
- Always validate inputs
- Use typed exceptions
- Log errors with context
- Return helpful error messages

#### Monitoring (`patterns/monitoring.ts`)
- CloudWatch metrics
- Custom dashboards
- Alerting
- Performance tracking

**Metrics to Track:**
- Invocation count
- Error rate
- Response latency
- Success rate

#### Security (`patterns/security.ts`)
- Authentication & authorization
- Input sanitization
- Secrets management
- Encryption

**Security Checklist:**
- ✓ Least-privilege IAM roles
- ✓ Encrypt data at rest and in transit
- ✓ Validate and sanitize all inputs
- ✓ Use Secrets Manager for credentials
- ✓ Enable guardrails
- ✓ Log security events

## Getting Started

### Prerequisites

```bash
# Install dependencies
npm install

# Configure AWS credentials
aws configure
```

### Deploy an Example

```bash
# Build TypeScript
npm run build

# Deploy a stack (example)
cdk deploy SimpleAgentStack

# View agent in AWS Console
# Navigate to Amazon Bedrock > Agents
```

### Testing Your Agent

```bash
# Use AWS CLI to invoke agent
aws bedrock-agent-runtime invoke-agent \
  --agent-id <AGENT_ID> \
  --agent-alias-id <ALIAS_ID> \
  --session-id test-session \
  --input-text "Hello, what can you do?" \
  output.txt
```

## Learning Path

### Week 1: Foundations
1. Deploy `01-simple-agent.ts`
2. Experiment with different instructions
3. Try different foundation models
4. Deploy `02-action-groups.ts`
5. Create your own custom action

### Week 2: Knowledge & Safety
1. Deploy `03-knowledge-base.ts`
2. Upload documents to S3
3. Test retrieval
4. Deploy `04-guardrails.ts`
5. Test content filtering

### Week 3: Advanced Concepts
1. Study multi-agent pattern
2. Build a custom action with DynamoDB
3. Implement RAG for your use case

### Week 4: Production Ready
1. Add comprehensive error handling
2. Set up monitoring and alerts
3. Implement security best practices
4. Load test your agent

## Common Patterns

### Pattern: Action with Database
```typescript
// 1. Create DynamoDB table
// 2. Grant Lambda permissions
// 3. Implement CRUD in Lambda
// 4. Define OpenAPI schema
// 5. Create action group
```

### Pattern: RAG Implementation
```typescript
// 1. Create S3 bucket for documents
// 2. Set up OpenSearch collection
// 3. Create knowledge base
// 4. Link to agent
// 5. Test retrieval
```

### Pattern: Secure Agent
```typescript
// 1. Create KMS key
// 2. Set up Secrets Manager
// 3. Configure guardrails
// 4. Implement input validation
// 5. Add audit logging
```

## Troubleshooting

### Agent Not Responding
- Check IAM role permissions
- Verify foundation model access
- Review CloudWatch logs

### Action Failures
- Validate OpenAPI schema
- Check Lambda execution role
- Test Lambda independently

### Knowledge Base Issues
- Verify S3 bucket permissions
- Check embedding model access
- Ensure data source is synced

## Resources

- [AWS Bedrock Documentation](https://docs.aws.amazon.com/bedrock/)
- [CDK API Reference](https://docs.aws.amazon.com/cdk/api/v2/)
- [Agent Best Practices](https://docs.aws.amazon.com/bedrock/latest/userguide/agents-best-practices.html)

## Next Steps

1. **Customize Examples**: Modify the examples for your use case
2. **Combine Patterns**: Mix and match patterns (e.g., RAG + Monitoring)
3. **Build Production Apps**: Apply learnings to real projects
4. **Contribute**: Share your patterns and improvements

## Tips for Success

- Start simple, add complexity gradually
- Test each component independently
- Use CloudWatch Logs for debugging
- Version your agents and aliases
- Document your agent's capabilities
- Monitor costs and usage
- Iterate based on user feedback
