import * as cdk from 'aws-cdk-lib';
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

/**
 * Simplified Action Groups Stack
 * 
 * This creates the agent and Lambda function.
 * The action group must be added manually via AWS Console because
 * AWS::Bedrock::AgentActionGroup is not yet available in all regions.
 */
export class ActionGroupsSimpleStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const agentRole = new iam.Role(this, 'AgentRole', {
      assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
    });

    agentRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['bedrock:InvokeModel'],
      resources: ['*'],
    }));

    const actionLambda = new lambda.Function(this, 'ActionHandler', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
import json

def handler(event, context):
    """
    Handle agent actions for weather queries
    """
    print(f"Received event: {json.dumps(event)}")
    
    action = event.get('actionGroup')
    api_path = event.get('apiPath')
    
    if api_path == '/get-weather':
        parameters = event.get('parameters', [])
        location = next((p['value'] for p in parameters if p['name'] == 'location'), 'Unknown')
        
        return {
            'messageVersion': '1.0',
            'response': {
                'actionGroup': action,
                'apiPath': api_path,
                'httpMethod': event.get('httpMethod'),
                'httpStatusCode': 200,
                'responseBody': {
                    'application/json': {
                        'body': json.dumps({
                            'location': location,
                            'temperature': 72,
                            'conditions': 'Sunny',
                            'humidity': 45
                        })
                    }
                }
            }
        }
    
    return {
        'messageVersion': '1.0',
        'response': {
            'actionGroup': action,
            'apiPath': api_path,
            'httpStatusCode': 404,
            'responseBody': {
                'application/json': {
                    'body': json.dumps({'error': 'Unknown action'})
                }
            }
        }
    }
`),
    });

    // Allow agent to invoke Lambda
    actionLambda.grantInvoke(agentRole);

    const agent = new bedrock.CfnAgent(this, 'WeatherAgent', {
      agentName: 'weather-agent',
      agentResourceRoleArn: agentRole.roleArn,
      foundationModel: 'anthropic.claude-3-sonnet-20240229-v1:0',
      instruction: `You are a helpful weather assistant. You can provide weather information for any location.
      When asked about weather, use the get-weather action to retrieve current conditions.`,
      idleSessionTtlInSeconds: 600,
    });

    new cdk.CfnOutput(this, 'AgentId', {
      value: agent.attrAgentId,
      description: 'Agent ID - use this to add action group in console',
    });

    new cdk.CfnOutput(this, 'AgentArn', {
      value: agent.attrAgentArn,
    });

    new cdk.CfnOutput(this, 'LambdaArn', {
      value: actionLambda.functionArn,
      description: 'Lambda ARN - use this when adding action group',
    });

    new cdk.CfnOutput(this, 'LambdaName', {
      value: actionLambda.functionName,
      description: 'Lambda function name',
    });

    new cdk.CfnOutput(this, 'ManualSteps', {
      value: 'Go to AWS Console > Bedrock > Agents > Select agent > Add action group',
      description: 'Next steps to complete setup',
    });
  }
}
