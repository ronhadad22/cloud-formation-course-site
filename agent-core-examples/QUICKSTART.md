# Quick Start Guide

## Running the Agent Core Examples

### Step 1: Install Dependencies

```bash
cd agent-core-examples
npm install
```

### Step 2: Build the TypeScript Code

```bash
npm run build
```

### Step 3: Configure AWS Credentials

Make sure you have AWS credentials configured:

```bash
aws configure
# Enter your AWS Access Key ID, Secret Access Key, and default region
```

Or use environment variables:
```bash
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key
export AWS_DEFAULT_REGION=us-east-1
```

### Step 4: Bootstrap CDK (First Time Only)

If you haven't used CDK in your AWS account before:

```bash
npx cdk bootstrap aws://ACCOUNT-ID/REGION
```

Example:
```bash
npx cdk bootstrap aws://123456789012/us-east-1
```

### Step 5: Create a CDK App File

Create a file called `app.ts` in the agent-core-examples directory:

```typescript
#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { SimpleAgentStack } from './basic/01-simple-agent';

const app = new cdk.App();

// Deploy a simple agent
new SimpleAgentStack(app, 'MySimpleAgentStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
```

Or use the CLI directly with a specific stack file.

### Step 6: Deploy a Stack

#### Option A: Using CDK CLI directly

```bash
# Synthesize CloudFormation template
npx cdk synth

# Deploy the stack
npx cdk deploy

# View what will be deployed
npx cdk diff
```

#### Option B: Create a proper CDK app structure

1. Create `bin/app.ts`:

```typescript
#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { SimpleAgentStack } from '../basic/01-simple-agent';

const app = new cdk.App();

new SimpleAgentStack(app, 'SimpleAgentStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
});
```

2. Create `cdk.json`:

```json
{
  "app": "npx ts-node --prefer-ts-exts bin/app.ts",
  "context": {
    "@aws-cdk/aws-lambda:recognizeLayerVersion": true,
    "@aws-cdk/core:checkSecretUsage": true,
    "@aws-cdk/core:target-partitions": ["aws", "aws-cn"]
  }
}
```

3. Deploy:

```bash
npx cdk deploy SimpleAgentStack
```

### Step 7: Test Your Agent

After deployment, you'll see outputs with the Agent ID. Test it using AWS CLI:

```bash
# Get the agent ID from the stack outputs
AGENT_ID="your-agent-id-from-output"

# Invoke the agent
aws bedrock-agent-runtime invoke-agent \
  --agent-id $AGENT_ID \
  --agent-alias-id TSTALIASID \
  --session-id test-session-$(date +%s) \
  --input-text "Hello, what can you do?" \
  response.txt

# View the response
cat response.txt
```

### Step 8: Clean Up

When you're done testing:

```bash
npx cdk destroy SimpleAgentStack
```

## Example Deployment Commands

### Deploy Simple Agent
```bash
# Create app.ts with SimpleAgentStack
npx cdk deploy
```

### Deploy Action Groups Example
```bash
# Modify app.ts to import ActionGroupsStack
npx cdk deploy
```

### Deploy Knowledge Base Example
```bash
# Note: This creates S3 bucket and OpenSearch collection
# More expensive - be aware of costs
npx cdk deploy
```

## Troubleshooting

### Error: "No stacks match"
- Make sure you have a `cdk.json` file or specify the app entry point
- Check that your TypeScript files are compiled (`npm run build`)

### Error: "Need to perform AWS calls for account"
- Run `aws configure` to set up credentials
- Or set AWS environment variables

### Error: "This stack uses assets"
- Run `npx cdk bootstrap` first

### Error: "Bedrock model access denied"
- Go to AWS Console → Bedrock → Model access
- Request access to Claude 3 Sonnet model

### Error: "Insufficient permissions"
- Ensure your IAM user/role has permissions for:
  - Bedrock (bedrock:*)
  - Lambda (lambda:*)
  - IAM (iam:*)
  - S3 (s3:*)
  - CloudFormation (cloudformation:*)

## Cost Considerations

- **Simple Agent**: ~$0 (just agent definition)
- **Action Groups**: ~$0 + Lambda invocations
- **Knowledge Base**: ~$0.10/hour for OpenSearch Serverless + S3 storage
- **Agent Invocations**: Charged per token based on model used

Always run `npx cdk destroy` when done testing to avoid ongoing charges!

## Next Steps

1. Start with `01-simple-agent.ts` - simplest example
2. Try `02-action-groups.ts` - adds Lambda functions
3. Explore `04-guardrails.ts` - add safety controls
4. Review advanced patterns for production use

## Useful Commands

```bash
# List all stacks
npx cdk list

# Show CloudFormation template
npx cdk synth

# Compare deployed stack with current code
npx cdk diff

# Watch for changes and rebuild
npm run watch

# Deploy with auto-approval (careful!)
npx cdk deploy --require-approval never
```
