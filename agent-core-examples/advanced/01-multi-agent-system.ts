import * as cdk from 'aws-cdk-lib';
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export class MultiAgentSystemStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const orchestratorRole = new iam.Role(this, 'OrchestratorRole', {
      assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
    });

    orchestratorRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['bedrock:InvokeModel', 'bedrock:InvokeAgent'],
      resources: ['*'],
    }));

    const orchestratorAgent = new bedrock.CfnAgent(this, 'OrchestratorAgent', {
      agentName: 'orchestrator-agent',
      agentResourceRoleArn: orchestratorRole.roleArn,
      foundationModel: 'anthropic.claude-3-sonnet-20240229-v1:0',
      instruction: `You are an orchestrator agent that coordinates between specialized agents.
      When a user asks a question, determine which specialist agent should handle it:
      - For data analysis questions, delegate to the data-analyst agent
      - For code-related questions, delegate to the code-assistant agent
      - For general questions, answer directly`,
    });

    const dataAnalystRole = new iam.Role(this, 'DataAnalystRole', {
      assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
    });

    dataAnalystRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['bedrock:InvokeModel'],
      resources: ['*'],
    }));

    const dataAnalystAgent = new bedrock.CfnAgent(this, 'DataAnalystAgent', {
      agentName: 'data-analyst-agent',
      agentResourceRoleArn: dataAnalystRole.roleArn,
      foundationModel: 'anthropic.claude-3-sonnet-20240229-v1:0',
      instruction: `You are a data analysis specialist. You help users understand data,
      create visualizations, and perform statistical analysis. Be precise and data-driven.`,
    });

    const codeAssistantRole = new iam.Role(this, 'CodeAssistantRole', {
      assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
    });

    codeAssistantRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['bedrock:InvokeModel'],
      resources: ['*'],
    }));

    const codeAssistantAgent = new bedrock.CfnAgent(this, 'CodeAssistantAgent', {
      agentName: 'code-assistant-agent',
      agentResourceRoleArn: codeAssistantRole.roleArn,
      foundationModel: 'anthropic.claude-3-sonnet-20240229-v1:0',
      instruction: `You are a coding specialist. You help users write, debug, and optimize code.
      Provide clear explanations and best practices.`,
    });

    const routingLambda = new lambda.Function(this, 'AgentRouter', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
import json
import boto3

bedrock_agent_runtime = boto3.client('bedrock-agent-runtime')

def handler(event, context):
    """
    Route requests to appropriate specialist agents
    """
    action = event.get('actionGroup')
    api_path = event.get('apiPath')
    parameters = event.get('parameters', [])
    
    if api_path == '/route-to-agent':
        agent_type = next((p['value'] for p in parameters if p['name'] == 'agentType'), None)
        query = next((p['value'] for p in parameters if p['name'] == 'query'), None)
        
        agent_id_map = {
            'data-analyst': '${dataAnalystAgent.attrAgentId}',
            'code-assistant': '${codeAssistantAgent.attrAgentId}'
        }
        
        target_agent_id = agent_id_map.get(agent_type)
        
        if target_agent_id and query:
            try:
                response = bedrock_agent_runtime.invoke_agent(
                    agentId=target_agent_id,
                    agentAliasId='TSTALIASID',
                    sessionId=event.get('sessionId', 'default'),
                    inputText=query
                )
                
                result = ''
                for event_chunk in response.get('completion', []):
                    if 'chunk' in event_chunk:
                        result += event_chunk['chunk'].get('bytes', b'').decode('utf-8')
                
                return {
                    'messageVersion': '1.0',
                    'response': {
                        'actionGroup': action,
                        'apiPath': api_path,
                        'httpStatusCode': 200,
                        'responseBody': {
                            'application/json': {
                                'body': json.dumps({
                                    'agentType': agent_type,
                                    'response': result
                                })
                            }
                        }
                    }
                }
            except Exception as e:
                return {
                    'messageVersion': '1.0',
                    'response': {
                        'actionGroup': action,
                        'apiPath': api_path,
                        'httpStatusCode': 500,
                        'responseBody': {
                            'application/json': {
                                'body': json.dumps({'error': str(e)})
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
                    'body': json.dumps({'error': 'Route not found'})
                }
            }
        }
    }
      `),
      environment: {
        DATA_ANALYST_AGENT_ID: dataAnalystAgent.attrAgentId,
        CODE_ASSISTANT_AGENT_ID: codeAssistantAgent.attrAgentId,
      },
    });

    routingLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['bedrock:InvokeAgent'],
      resources: ['*'],
    }));

    routingLambda.grantInvoke(orchestratorRole);

    const apiSchema = {
      openapi: '3.0.0',
      info: {
        title: 'Agent Routing API',
        version: '1.0.0',
      },
      paths: {
        '/route-to-agent': {
          post: {
            summary: 'Route query to specialist agent',
            operationId: 'routeToAgent',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      agentType: {
                        type: 'string',
                        enum: ['data-analyst', 'code-assistant'],
                      },
                      query: {
                        type: 'string',
                      },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Successful response from specialist agent',
              },
            },
          },
        },
      },
    };

    new bedrock.CfnAgentActionGroup(this, 'RoutingActionGroup', {
      agentId: orchestratorAgent.attrAgentId,
      agentVersion: 'DRAFT',
      actionGroupName: 'agent-routing',
      actionGroupExecutor: {
        lambda: routingLambda.functionArn,
      },
      apiSchema: {
        payload: JSON.stringify(apiSchema),
      },
    });

    new cdk.CfnOutput(this, 'OrchestratorAgentId', {
      value: orchestratorAgent.attrAgentId,
    });

    new cdk.CfnOutput(this, 'DataAnalystAgentId', {
      value: dataAnalystAgent.attrAgentId,
    });

    new cdk.CfnOutput(this, 'CodeAssistantAgentId', {
      value: codeAssistantAgent.attrAgentId,
    });
  }
}
