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

    actionLambda.grantInvoke(agentRole);

    const agent = new bedrock.CfnAgent(this, 'AgentWithActions', {
      agentName: 'agent-with-action-groups',
      agentResourceRoleArn: agentRole.roleArn,
      foundationModel: 'anthropic.claude-3-sonnet-20240229-v1:0',
      instruction: 'You are a weather assistant that can provide weather information for any location.',
    });

    const apiSchema = {
      openapi: '3.0.0',
      info: {
        title: 'Weather API',
        version: '1.0.0',
        description: 'API for getting weather information',
      },
      paths: {
        '/get-weather': {
          get: {
            summary: 'Get weather for a location',
            description: 'Returns current weather conditions for the specified location',
            operationId: 'getWeather',
            parameters: [
              {
                name: 'location',
                in: 'query',
                description: 'The city or location to get weather for',
                required: true,
                schema: {
                  type: 'string',
                },
              },
            ],
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
    };

    new bedrock.CfnAgentActionGroup(this, 'WeatherActionGroup', {
      agentId: agent.attrAgentId,
      agentVersion: 'DRAFT',
      actionGroupName: 'weather-actions',
      actionGroupExecutor: {
        lambda: actionLambda.functionArn,
      },
      apiSchema: {
        payload: JSON.stringify(apiSchema),
      },
      description: 'Actions for retrieving weather information',
    });

    new cdk.CfnOutput(this, 'AgentId', {
      value: agent.attrAgentId,
    });
  }
}
