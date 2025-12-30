# Agent Core Learning Examples

This directory contains examples and patterns for working with AWS CDK Agent Core, a framework for building AI agents that can interact with AWS services.

## Directory Structure

- **basic/** - Fundamental Agent Core concepts and simple examples
- **advanced/** - Complex patterns and real-world scenarios
- **patterns/** - Common design patterns and best practices

## What is Agent Core?

Agent Core is a CDK construct library that enables you to build AI agents with:
- **Action Groups** - Define capabilities your agent can perform
- **Knowledge Bases** - Provide context and information to your agent
- **Guardrails** - Set boundaries and safety controls
- **Prompt Templates** - Structure agent interactions

## Getting Started

1. Review the basic examples first to understand core concepts
2. Explore advanced examples for production patterns
3. Study the patterns directory for best practices

## Prerequisites

```bash
npm install @aws-cdk/aws-bedrock
```

## Examples Overview

### Basic Examples
- `01-simple-agent.ts` - Create a basic agent
- `02-action-groups.ts` - Define agent actions
- `03-knowledge-base.ts` - Add knowledge to agents
- `04-guardrails.ts` - Implement safety controls

### Advanced Examples
- `01-multi-agent-system.ts` - Orchestrate multiple agents
- `02-custom-actions.ts` - Build complex action handlers
- `03-rag-pattern.ts` - Retrieval Augmented Generation

### Patterns
- `error-handling.ts` - Robust error management
- `monitoring.ts` - Agent observability
- `security.ts` - Security best practices

## Resources

- [AWS Bedrock Documentation](https://docs.aws.amazon.com/bedrock/)
- [CDK Documentation](https://docs.aws.amazon.com/cdk/)
