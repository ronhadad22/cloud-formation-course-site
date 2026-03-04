# CloudFormation Resource Availability Workaround

## Issue

The following CloudFormation resource types are not yet available in all AWS regions:
- `AWS::Bedrock::AgentActionGroup`
- `AWS::Bedrock::AgentKnowledgeBase` (association)

This causes deployment failures with error:
```
ValidationError: Template format error: Unrecognized resource types: [AWS::Bedrock::AgentActionGroup]
```

## Solution Options

### Option 1: Use Simplified Stacks (Recommended for Learning)

Deploy the agent and Lambda, then manually add action groups via AWS Console.

#### Deploy Simplified Action Groups Stack

1. **Edit `bin/app.ts`:**
```typescript
import { ActionGroupsSimpleStack } from '../basic/02-action-groups-simple';

new ActionGroupsSimpleStack(app, 'ActionGroupsSimpleStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
});
```

2. **Deploy:**
```bash
npm run build
npx cdk deploy ActionGroupsSimpleStack
```

3. **Manually Add Action Group in AWS Console:**

After deployment, note the outputs:
- `AgentId`: Your agent ID
- `LambdaArn`: Lambda function ARN

Then:

**Step 1:** Go to AWS Console → Amazon Bedrock → Agents

**Step 2:** Click on your agent (`weather-agent`)

**Step 3:** Scroll to "Action groups" section → Click "Add"

**Step 4:** Configure the action group:
- **Name:** `weather-actions`
- **Description:** `Actions for retrieving weather information`
- **Action group type:** Define with API schemas
- **Action group invocation:** Select existing Lambda function
- **Lambda function:** Select the Lambda from outputs (starts with `ActionGroupsSimpleStack-ActionHandler`)

**Step 5:** Define API Schema (inline):
```json
{
  "openapi": "3.0.0",
  "info": {
    "title": "Weather API",
    "version": "1.0.0",
    "description": "API for getting weather information"
  },
  "paths": {
    "/get-weather": {
      "get": {
        "summary": "Get current weather for a location",
        "description": "Returns current weather conditions including temperature, conditions, and humidity",
        "operationId": "getWeather",
        "parameters": [
          {
            "name": "location",
            "in": "query",
            "description": "City name or location",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Successful response",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "location": {
                      "type": "string"
                    },
                    "temperature": {
                      "type": "number"
                    },
                    "conditions": {
                      "type": "string"
                    },
                    "humidity": {
                      "type": "number"
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
```

**Step 6:** Save the action group

**Step 7:** Prepare the agent:
- Click "Prepare" button at the top
- Wait for preparation to complete (~1-2 minutes)

**Step 8:** Create an alias:
- Go to "Aliases" tab
- Click "Create alias"
- Name: `prod`
- Click "Create"

**Step 9:** Test the agent:
- Click "Test" button
- Try: "What's the weather in Paris?"
- Agent should call Lambda and return weather data

---

### Option 2: Use Different Regions

Some regions may have these resources available. Try:
- `us-west-2` (Oregon)
- `eu-west-1` (Ireland)

**Edit `bin/app.ts`:**
```typescript
region: 'us-west-2',  // Instead of us-east-1
```

Then redeploy.

---

### Option 3: Wait for AWS to Roll Out Resources

AWS is actively rolling out these CloudFormation resources. Check periodically:
```bash
aws cloudformation list-types --type RESOURCE --visibility PUBLIC \
  --filters TypeNamePrefix=AWS::Bedrock | grep Agent
```

---

### Option 4: Use Custom Resources (Advanced)

Create a Lambda-backed custom resource that calls the Bedrock Agents API directly:
- `CreateAgentActionGroup` API
- `CreateAgentKnowledgeBaseAssociation` API

This requires more code but works in all regions.

---

## Which Stacks Work Without Workarounds?

These stacks deploy successfully without manual steps:

✅ **SimpleAgentStack** - No action groups needed
✅ **GuardrailsStack** - Uses `AWS::Bedrock::Guardrail` (available)
✅ **MonitoringStack** - CloudWatch only
✅ **ErrorHandlingStack** - Lambda + agent only

These require workarounds:

⚠️ **ActionGroupsStack** - Needs manual action group setup
⚠️ **KnowledgeBaseStack** - Needs manual KB association
⚠️ **CustomActionsStack** - Needs manual action group setup
⚠️ **MultiAgentSystemStack** - Needs manual action group setup
⚠️ **RAGPatternStack** - Needs manual KB association + action group
⚠️ **SecurityStack** - Needs manual action group setup

---

## Recommended Learning Path (With Workarounds)

### Week 1: No Workarounds Needed
1. ✅ SimpleAgentStack
2. ✅ GuardrailsStack

### Week 2: Manual Console Setup
3. ⚠️ ActionGroupsSimpleStack + manual action group
4. ⚠️ CustomActionsStack + manual action group

### Week 3: Try Different Region
5. Switch to `us-west-2` and try full stacks

---

## Example: Complete ActionGroupsSimpleStack Deployment

```bash
# 1. Edit bin/app.ts to use ActionGroupsSimpleStack
# 2. Build
npm run build

# 3. Deploy
npx cdk deploy ActionGroupsSimpleStack

# 4. Note the outputs:
# AgentId: ABCD1234
# LambdaArn: arn:aws:lambda:us-east-1:123456789012:function:ActionGroupsSimpleStack-ActionHandler...

# 5. Go to AWS Console and manually add action group (see steps above)

# 6. Test
aws bedrock-agent-runtime invoke-agent \
  --agent-id ABCD1234 \
  --agent-alias-id <ALIAS-ID> \
  --session-id test-123 \
  --input-text "What's the weather in Tokyo?" \
  response.txt

cat response.txt
```

---

## Future Updates

Once `AWS::Bedrock::AgentActionGroup` becomes available in your region, you can:
1. Update to the full stack versions
2. Use `npx cdk deploy` without manual steps
3. Everything will be automated via CloudFormation

Check AWS CloudFormation documentation for resource availability updates.
