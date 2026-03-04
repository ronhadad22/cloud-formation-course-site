# How to Deploy Different Stacks

## Available Stacks

You have 10 different example stacks available. Currently, only `SimpleAgentStack` is configured in `bin/app.ts`.

## Quick Deploy Guide

### Method 1: Edit bin/app.ts (Recommended)

Open `bin/app.ts` and change the import and stack instantiation:

#### Deploy Action Groups Stack
```typescript
#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ActionGroupsStack } from '../basic/02-action-groups';

const app = new cdk.App();

new ActionGroupsStack(app, 'ActionGroupsStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
});
```

#### Deploy Knowledge Base Stack
```typescript
#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { KnowledgeBaseStack } from '../basic/03-knowledge-base';

const app = new cdk.App();

new KnowledgeBaseStack(app, 'KnowledgeBaseStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
});
```

#### Deploy Guardrails Stack
```typescript
#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { GuardrailsStack } from '../basic/04-guardrails';

const app = new cdk.App();

new GuardrailsStack(app, 'GuardrailsStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
});
```

#### Deploy Multi-Agent System
```typescript
#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { MultiAgentSystemStack } from '../advanced/01-multi-agent-system';

const app = new cdk.App();

new MultiAgentSystemStack(app, 'MultiAgentSystemStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
});
```

#### Deploy Custom Actions (Task Manager)
```typescript
#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CustomActionsStack } from '../advanced/02-custom-actions';

const app = new cdk.App();

new CustomActionsStack(app, 'CustomActionsStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
});
```

#### Deploy RAG Pattern
```typescript
#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { RAGPatternStack } from '../advanced/03-rag-pattern';

const app = new cdk.App();

new RAGPatternStack(app, 'RAGPatternStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
});
```

#### Deploy Error Handling Pattern
```typescript
#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ErrorHandlingPatternStack } from '../patterns/error-handling';

const app = new cdk.App();

new ErrorHandlingPatternStack(app, 'ErrorHandlingStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
});
```

#### Deploy Monitoring Pattern
```typescript
#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { MonitoringPatternStack } from '../patterns/monitoring';

const app = new cdk.App();

new MonitoringPatternStack(app, 'MonitoringStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
});
```

#### Deploy Security Pattern
```typescript
#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { SecurityPatternStack } from '../patterns/security';

const app = new cdk.App();

new SecurityPatternStack(app, 'SecurityStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
});
```

---

### Method 2: Deploy Multiple Stacks at Once

Edit `bin/app.ts` to include multiple stacks:

```typescript
#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { SimpleAgentStack } from '../basic/01-simple-agent';
import { ActionGroupsStack } from '../basic/02-action-groups';
import { GuardrailsStack } from '../basic/04-guardrails';

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

// Deploy multiple stacks
new SimpleAgentStack(app, 'SimpleAgentStack', { env });
new ActionGroupsStack(app, 'ActionGroupsStack', { env });
new GuardrailsStack(app, 'GuardrailsStack', { env });
```

Then list and deploy specific stacks:
```bash
npx cdk list
# Shows: SimpleAgentStack, ActionGroupsStack, GuardrailsStack

npx cdk deploy ActionGroupsStack
npx cdk deploy GuardrailsStack
```

---

## Deployment Workflow

### 1. Choose a Stack
Pick from the list above based on what you want to learn.

### 2. Edit bin/app.ts
Replace the import and stack instantiation.

### 3. Rebuild
```bash
npm run build
```

### 4. Verify
```bash
npx cdk list
# Should show your new stack name
```

### 5. Preview Changes
```bash
npx cdk synth
# or
npx cdk diff
```

### 6. Deploy
```bash
npx cdk deploy <StackName>
```

### 7. Test Your Agent
Use the outputs from the deployment to test.

### 8. Clean Up
```bash
npx cdk destroy <StackName>
```

---

## Complete Stack List

| Stack Name | File Path | Complexity | Cost |
|------------|-----------|------------|------|
| SimpleAgentStack | `basic/01-simple-agent.ts` | ⭐ | ~$0 |
| ActionGroupsStack | `basic/02-action-groups.ts` | ⭐⭐ | ~$0 |
| KnowledgeBaseStack | `basic/03-knowledge-base.ts` | ⭐⭐⭐ | ~$175/mo |
| GuardrailsStack | `basic/04-guardrails.ts` | ⭐⭐ | ~$0 |
| MultiAgentSystemStack | `advanced/01-multi-agent-system.ts` | ⭐⭐⭐⭐ | ~$0 |
| CustomActionsStack | `advanced/02-custom-actions.ts` | ⭐⭐⭐ | ~$1/mo |
| RAGPatternStack | `advanced/03-rag-pattern.ts` | ⭐⭐⭐⭐ | ~$175/mo |
| ErrorHandlingStack | `patterns/error-handling.ts` | ⭐⭐ | ~$0 |
| MonitoringStack | `patterns/monitoring.ts` | ⭐⭐⭐ | ~$5/mo |
| SecurityStack | `patterns/security.ts` | ⭐⭐⭐ | ~$2/mo |

---

## Recommended Learning Path

### Week 1: Basics
```bash
# 1. Simple Agent (already deployed)
# 2. Action Groups
# Edit bin/app.ts → ActionGroupsStack
npm run build
npx cdk deploy ActionGroupsStack

# 3. Guardrails
# Edit bin/app.ts → GuardrailsStack
npm run build
npx cdk deploy GuardrailsStack
```

### Week 2: Advanced
```bash
# 4. Custom Actions (Task Manager)
# Edit bin/app.ts → CustomActionsStack
npm run build
npx cdk deploy CustomActionsStack

# 5. Multi-Agent System
# Edit bin/app.ts → MultiAgentSystemStack
npm run build
npx cdk deploy MultiAgentSystemStack
```

### Week 3: Production
```bash
# 6. Error Handling
# Edit bin/app.ts → ErrorHandlingStack
npm run build
npx cdk deploy ErrorHandlingStack

# 7. Monitoring
# Edit bin/app.ts → MonitoringStack
npm run build
npx cdk deploy MonitoringStack

# 8. Security
# Edit bin/app.ts → SecurityStack
npm run build
npx cdk deploy SecurityStack
```

### Week 4: Knowledge Base (Expensive!)
```bash
# 9. Knowledge Base (costs ~$175/month)
# Edit bin/app.ts → KnowledgeBaseStack
npm run build
npx cdk deploy KnowledgeBaseStack

# 10. RAG Pattern (also ~$175/month)
# Edit bin/app.ts → RAGPatternStack
npm run build
npx cdk deploy RAGPatternStack
```

---

## Quick Example: Deploy Action Groups

```bash
# 1. Edit bin/app.ts
# Change: import { SimpleAgentStack } from '../basic/01-simple-agent';
# To:     import { ActionGroupsStack } from '../basic/02-action-groups';
# Change: new SimpleAgentStack(app, 'SimpleAgentStack', {...
# To:     new ActionGroupsStack(app, 'ActionGroupsStack', {...

# 2. Rebuild
npm run build

# 3. Verify
npx cdk list
# Output: ActionGroupsStack

# 4. Deploy
npx cdk deploy ActionGroupsStack

# 5. Test the weather action
aws bedrock-agent-runtime invoke-agent \
  --agent-id <AGENT-ID-FROM-OUTPUT> \
  --agent-alias-id TSTALIASID \
  --session-id test-123 \
  --input-text "What's the weather in Paris?" \
  response.txt

# 6. Clean up when done
npx cdk destroy ActionGroupsStack
```

---

## Tips

- **Always rebuild** after editing TypeScript files: `npm run build`
- **Check costs** before deploying Knowledge Base or RAG stacks
- **Destroy stacks** when done testing to avoid charges
- **Start simple** and work your way up in complexity
- **Read STACKS_EXPLAINED.md** for detailed resource information

---

## Troubleshooting

### "Stack not found"
- Make sure you edited `bin/app.ts`
- Run `npm run build`
- Run `npx cdk list` to verify

### "Resource already exists"
- Destroy the old stack first: `npx cdk destroy OldStackName`
- Or use a different stack name

### "Build errors"
- Check TypeScript syntax
- Ensure import path is correct
- Run `npm run build` to see errors

### "Deployment failed"
- Check CloudFormation console for details
- Verify IAM permissions
- Check if Bedrock model access is enabled
