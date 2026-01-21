import * as cdk from 'aws-cdk-lib';
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export class ActionGroupsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const agentRole = new iam.Role(this, 'AgentRole', {
      assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonBedrockFullAccess'),
      ],
    });

    const actionLambda = new lambda.Function(this, 'ActionHandler', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
import json

def handler(event, context):
    """
    Handle agent actions
    """
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
                    'body': json.dumps({'error': 'Action not found'})
                }
            }
        }
    }
      `),
    });

    // Add permissions to agent role
    agentRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeModel',
        'bedrock:InvokeModelWithResponseStream',
      ],
      resources: [
        `arn:aws:bedrock:${this.region}::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0`,
      ],
    }));

    // Allow agent to invoke Lambda
    agentRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['lambda:InvokeFunction'],
      resources: [actionLambda.functionArn],
    }));

    // Create agent first so we can reference it
    const agent = new bedrock.CfnAgent(this, 'WeatherAgent', {
      agentName: 'weather-agent-with-actions',
      agentResourceRoleArn: agentRole.roleArn,
      foundationModel: 'anthropic.claude-3-sonnet-20240229-v1:0',
      instruction: `You are a helpful weather assistant. You can provide weather information for any location.
      When asked about weather, use the get-weather action to retrieve current conditions.`,
      idleSessionTtlInSeconds: 600,
      actionGroups: [{
        actionGroupName: 'weather-actions',
        actionGroupExecutor: {
          lambda: actionLambda.functionArn,
        },
        apiSchema: {
          payload: JSON.stringify({
            openapi: '3.0.0',
            info: {
              title: 'Weather API',
              version: '1.0.0',
              description: 'API for getting weather information',
            },
            paths: {
              '/get-weather': {
                get: {
                  summary: 'Get current weather for a location',
                  description: 'Returns current weather conditions',
                  operationId: 'getWeather',
                  parameters: [{
                    name: 'location',
                    in: 'query',
                    description: 'City name or location',
                    required: true,
                    schema: {
                      type: 'string',
                    },
                  }],
                  responses: {
                    '200': {
                      description: 'Successful response',
                      content: {
                        'application/json': {
                          schema: {
                            type: 'object',
                            properties: {
                              location: { type: 'string' },
                              temperature: { type: 'number' },
                              conditions: { type: 'string' },
                              humidity: { type: 'number' },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
        },
        description: 'Actions for retrieving weather information',
      }],
    });

    // Grant Bedrock service permission to invoke Lambda
    actionLambda.addPermission('AllowBedrockInvoke', {
      principal: new iam.ServicePrincipal('bedrock.amazonaws.com'),
      action: 'lambda:InvokeFunction',
      sourceArn: agent.attrAgentArn,
    });

    new cdk.CfnOutput(this, 'AgentId', {
      value: agent.attrAgentId,
      description: 'Agent ID',
    });

    new cdk.CfnOutput(this, 'AgentArn', {
      value: agent.attrAgentArn,
      description: 'Agent ARN',
    });
  }
}
