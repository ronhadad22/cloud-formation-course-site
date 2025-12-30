"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MultiAgentSystemStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const bedrock = __importStar(require("aws-cdk-lib/aws-bedrock"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
class MultiAgentSystemStack extends cdk.Stack {
    constructor(scope, id, props) {
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
        new cdk.CfnResource(this, 'RoutingActionGroup', {
            type: 'AWS::Bedrock::AgentActionGroup',
            properties: {
                AgentId: orchestratorAgent.attrAgentId,
                AgentVersion: 'DRAFT',
                ActionGroupName: 'agent-routing',
                ActionGroupExecutor: {
                    Lambda: routingLambda.functionArn,
                },
                ApiSchema: {
                    Payload: JSON.stringify(apiSchema),
                },
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
exports.MultiAgentSystemStack = MultiAgentSystemStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiMDEtbXVsdGktYWdlbnQtc3lzdGVtLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiMDEtbXVsdGktYWdlbnQtc3lzdGVtLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUNuQyxpRUFBbUQ7QUFDbkQseURBQTJDO0FBQzNDLCtEQUFpRDtBQUdqRCxNQUFhLHFCQUFzQixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQ2xELFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBc0I7UUFDOUQsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLGtCQUFrQixFQUFFO1lBQzlELFNBQVMsRUFBRSxJQUFJLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQyx1QkFBdUIsQ0FBQztTQUM3RCxDQUFDLENBQUM7UUFFSCxnQkFBZ0IsQ0FBQyxXQUFXLENBQUMsSUFBSSxHQUFHLENBQUMsZUFBZSxDQUFDO1lBQ25ELE1BQU0sRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLEtBQUs7WUFDeEIsT0FBTyxFQUFFLENBQUMscUJBQXFCLEVBQUUscUJBQXFCLENBQUM7WUFDdkQsU0FBUyxFQUFFLENBQUMsR0FBRyxDQUFDO1NBQ2pCLENBQUMsQ0FBQyxDQUFDO1FBRUosTUFBTSxpQkFBaUIsR0FBRyxJQUFJLE9BQU8sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLG1CQUFtQixFQUFFO1lBQ3hFLFNBQVMsRUFBRSxvQkFBb0I7WUFDL0Isb0JBQW9CLEVBQUUsZ0JBQWdCLENBQUMsT0FBTztZQUM5QyxlQUFlLEVBQUUseUNBQXlDO1lBQzFELFdBQVcsRUFBRTs7OzsrQ0FJNEI7U0FDMUMsQ0FBQyxDQUFDO1FBRUgsTUFBTSxlQUFlLEdBQUcsSUFBSSxHQUFHLENBQUMsSUFB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Q0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxzQkFBc0IsRUFBRTtZQUM5QyxLQUFLLEVBQUUsa0JBQWtCLENBQUMsV0FBVztTQUN0QyxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUFyT0Qsc0RBcU9DIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGJlZHJvY2sgZnJvbSAnYXdzLWNkay1saWIvYXdzLWJlZHJvY2snO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5cbmV4cG9ydCBjbGFzcyBNdWx0aUFnZW50U3lzdGVtU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wcz86IGNkay5TdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICBjb25zdCBvcmNoZXN0cmF0b3JSb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsICdPcmNoZXN0cmF0b3JSb2xlJywge1xuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2JlZHJvY2suYW1hem9uYXdzLmNvbScpLFxuICAgIH0pO1xuXG4gICAgb3JjaGVzdHJhdG9yUm9sZS5hZGRUb1BvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICBhY3Rpb25zOiBbJ2JlZHJvY2s6SW52b2tlTW9kZWwnLCAnYmVkcm9jazpJbnZva2VBZ2VudCddLFxuICAgICAgcmVzb3VyY2VzOiBbJyonXSxcbiAgICB9KSk7XG5cbiAgICBjb25zdCBvcmNoZXN0cmF0b3JBZ2VudCA9IG5ldyBiZWRyb2NrLkNmbkFnZW50KHRoaXMsICdPcmNoZXN0cmF0b3JBZ2VudCcsIHtcbiAgICAgIGFnZW50TmFtZTogJ29yY2hlc3RyYXRvci1hZ2VudCcsXG4gICAgICBhZ2VudFJlc291cmNlUm9sZUFybjogb3JjaGVzdHJhdG9yUm9sZS5yb2xlQXJuLFxuICAgICAgZm91bmRhdGlvbk1vZGVsOiAnYW50aHJvcGljLmNsYXVkZS0zLXNvbm5ldC0yMDI0MDIyOS12MTowJyxcbiAgICAgIGluc3RydWN0aW9uOiBgWW91IGFyZSBhbiBvcmNoZXN0cmF0b3IgYWdlbnQgdGhhdCBjb29yZGluYXRlcyBiZXR3ZWVuIHNwZWNpYWxpemVkIGFnZW50cy5cbiAgICAgIFdoZW4gYSB1c2VyIGFza3MgYSBxdWVzdGlvbiwgZGV0ZXJtaW5lIHdoaWNoIHNwZWNpYWxpc3QgYWdlbnQgc2hvdWxkIGhhbmRsZSBpdDpcbiAgICAgIC0gRm9yIGRhdGEgYW5hbHlzaXMgcXVlc3Rpb25zLCBkZWxlZ2F0ZSB0byB0aGUgZGF0YS1hbmFseXN0IGFnZW50XG4gICAgICAtIEZvciBjb2RlLXJlbGF0ZWQgcXVlc3Rpb25zLCBkZWxlZ2F0ZSB0byB0aGUgY29kZS1hc3Npc3RhbnQgYWdlbnRcbiAgICAgIC0gRm9yIGdlbmVyYWwgcXVlc3Rpb25zLCBhbnN3ZXIgZGlyZWN0bHlgLFxuICAgIH0pO1xuXG4gICAgY29uc3QgZGF0YUFuYWx5c3RSb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsICdEYXRhQW5hbHlzdFJvbGUnLCB7XG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnYmVkcm9jay5hbWF6b25hd3MuY29tJyksXG4gICAgfSk7XG5cbiAgICBkYXRhQW5hbHlzdFJvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogWydiZWRyb2NrOkludm9rZU1vZGVsJ10sXG4gICAgICByZXNvdXJjZXM6IFsnKiddLFxuICAgIH0pKTtcblxuICAgIGNvbnN0IGRhdGFBbmFseXN0QWdlbnQgPSBuZXcgYmVkcm9jay5DZm5BZ2VudCh0aGlzLCAnRGF0YUFuYWx5c3RBZ2VudCcsIHtcbiAgICAgIGFnZW50TmFtZTogJ2RhdGEtYW5hbHlzdC1hZ2VudCcsXG4gICAgICBhZ2VudFJlc291cmNlUm9sZUFybjogZGF0YUFuYWx5c3RSb2xlLnJvbGVBcm4sXG4gICAgICBmb3VuZGF0aW9uTW9kZWw6ICdhbnRocm9waWMuY2xhdWRlLTMtc29ubmV0LTIwMjQwMjI5LXYxOjAnLFxuICAgICAgaW5zdHJ1Y3Rpb246IGBZb3UgYXJlIGEgZGF0YSBhbmFseXNpcyBzcGVjaWFsaXN0LiBZb3UgaGVscCB1c2VycyB1bmRlcnN0YW5kIGRhdGEsXG4gICAgICBjcmVhdGUgdmlzdWFsaXphdGlvbnMsIGFuZCBwZXJmb3JtIHN0YXRpc3RpY2FsIGFuYWx5c2lzLiBCZSBwcmVjaXNlIGFuZCBkYXRhLWRyaXZlbi5gLFxuICAgIH0pO1xuXG4gICAgY29uc3QgY29kZUFzc2lzdGFudFJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ0NvZGVBc3Npc3RhbnRSb2xlJywge1xuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2JlZHJvY2suYW1hem9uYXdzLmNvbScpLFxuICAgIH0pO1xuXG4gICAgY29kZUFzc2lzdGFudFJvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogWydiZWRyb2NrOkludm9rZU1vZGVsJ10sXG4gICAgICByZXNvdXJjZXM6IFsnKiddLFxuICAgIH0pKTtcblxuICAgIGNvbnN0IGNvZGVBc3Npc3RhbnRBZ2VudCA9IG5ldyBiZWRyb2NrLkNmbkFnZW50KHRoaXMsICdDb2RlQXNzaXN0YW50QWdlbnQnLCB7XG4gICAgICBhZ2VudE5hbWU6ICdjb2RlLWFzc2lzdGFudC1hZ2VudCcsXG4gICAgICBhZ2VudFJlc291cmNlUm9sZUFybjogY29kZUFzc2lzdGFudFJvbGUucm9sZUFybixcbiAgICAgIGZvdW5kYXRpb25Nb2RlbDogJ2FudGhyb3BpYy5jbGF1ZGUtMy1zb25uZXQtMjAyNDAyMjktdjE6MCcsXG4gICAgICBpbnN0cnVjdGlvbjogYFlvdSBhcmUgYSBjb2Rpbmcgc3BlY2lhbGlzdC4gWW91IGhlbHAgdXNlcnMgd3JpdGUsIGRlYnVnLCBhbmQgb3B0aW1pemUgY29kZS5cbiAgICAgIFByb3ZpZGUgY2xlYXIgZXhwbGFuYXRpb25zIGFuZCBiZXN0IHByYWN0aWNlcy5gLFxuICAgIH0pO1xuXG4gICAgY29uc3Qgcm91dGluZ0xhbWJkYSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0FnZW50Um91dGVyJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfMTIsXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tSW5saW5lKGBcbmltcG9ydCBqc29uXG5pbXBvcnQgYm90bzNcblxuYmVkcm9ja19hZ2VudF9ydW50aW1lID0gYm90bzMuY2xpZW50KCdiZWRyb2NrLWFnZW50LXJ1bnRpbWUnKVxuXG5kZWYgaGFuZGxlcihldmVudCwgY29udGV4dCk6XG4gICAgXCJcIlwiXG4gICAgUm91dGUgcmVxdWVzdHMgdG8gYXBwcm9wcmlhdGUgc3BlY2lhbGlzdCBhZ2VudHNcbiAgICBcIlwiXCJcbiAgICBhY3Rpb24gPSBldmVudC5nZXQoJ2FjdGlvbkdyb3VwJylcbiAgICBhcGlfcGF0aCA9IGV2ZW50LmdldCgnYXBpUGF0aCcpXG4gICAgcGFyYW1ldGVycyA9IGV2ZW50LmdldCgncGFyYW1ldGVycycsIFtdKVxuICAgIFxuICAgIGlmIGFwaV9wYXRoID09ICcvcm91dGUtdG8tYWdlbnQnOlxuICAgICAgICBhZ2VudF90eXBlID0gbmV4dCgocFsndmFsdWUnXSBmb3IgcCBpbiBwYXJhbWV0ZXJzIGlmIHBbJ25hbWUnXSA9PSAnYWdlbnRUeXBlJyksIE5vbmUpXG4gICAgICAgIHF1ZXJ5ID0gbmV4dCgocFsndmFsdWUnXSBmb3IgcCBpbiBwYXJhbWV0ZXJzIGlmIHBbJ25hbWUnXSA9PSAncXVlcnknKSwgTm9uZSlcbiAgICAgICAgXG4gICAgICAgIGFnZW50X2lkX21hcCA9IHtcbiAgICAgICAgICAgICdkYXRhLWFuYWx5c3QnOiAnJHtkYXRhQW5hbHlzdEFnZW50LmF0dHJBZ2VudElkfScsXG4gICAgICAgICAgICAnY29kZS1hc3Npc3RhbnQnOiAnJHtjb2RlQXNzaXN0YW50QWdlbnQuYXR0ckFnZW50SWR9J1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICB0YXJnZXRfYWdlbnRfaWQgPSBhZ2VudF9pZF9tYXAuZ2V0KGFnZW50X3R5cGUpXG4gICAgICAgIFxuICAgICAgICBpZiB0YXJnZXRfYWdlbnRfaWQgYW5kIHF1ZXJ5OlxuICAgICAgICAgICAgdHJ5OlxuICAgICAgICAgICAgICAgIHJlc3BvbnNlID0gYmVkcm9ja19hZ2VudF9ydW50aW1lLmludm9rZV9hZ2VudChcbiAgICAgICAgICAgICAgICAgICAgYWdlbnRJZD10YXJnZXRfYWdlbnRfaWQsXG4gICAgICAgICAgICAgICAgICAgIGFnZW50QWxpYXNJZD0nVFNUQUxJQVNJRCcsXG4gICAgICAgICAgICAgICAgICAgIHNlc3Npb25JZD1ldmVudC5nZXQoJ3Nlc3Npb25JZCcsICdkZWZhdWx0JyksXG4gICAgICAgICAgICAgICAgICAgIGlucHV0VGV4dD1xdWVyeVxuICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICByZXN1bHQgPSAnJ1xuICAgICAgICAgICAgICAgIGZvciBldmVudF9jaHVuayBpbiByZXNwb25zZS5nZXQoJ2NvbXBsZXRpb24nLCBbXSk6XG4gICAgICAgICAgICAgICAgICAgIGlmICdjaHVuaycgaW4gZXZlbnRfY2h1bms6XG4gICAgICAgICAgICAgICAgICAgICAgICByZXN1bHQgKz0gZXZlbnRfY2h1bmtbJ2NodW5rJ10uZ2V0KCdieXRlcycsIGInJykuZGVjb2RlKCd1dGYtOCcpXG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgJ21lc3NhZ2VWZXJzaW9uJzogJzEuMCcsXG4gICAgICAgICAgICAgICAgICAgICdyZXNwb25zZSc6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICdhY3Rpb25Hcm91cCc6IGFjdGlvbixcbiAgICAgICAgICAgICAgICAgICAgICAgICdhcGlQYXRoJzogYXBpX3BhdGgsXG4gICAgICAgICAgICAgICAgICAgICAgICAnaHR0cFN0YXR1c0NvZGUnOiAyMDAsXG4gICAgICAgICAgICAgICAgICAgICAgICAncmVzcG9uc2VCb2R5Jzoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICdhcHBsaWNhdGlvbi9qc29uJzoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnYm9keSc6IGpzb24uZHVtcHMoe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ2FnZW50VHlwZSc6IGFnZW50X3R5cGUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAncmVzcG9uc2UnOiByZXN1bHRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICBleGNlcHQgRXhjZXB0aW9uIGFzIGU6XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgJ21lc3NhZ2VWZXJzaW9uJzogJzEuMCcsXG4gICAgICAgICAgICAgICAgICAgICdyZXNwb25zZSc6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICdhY3Rpb25Hcm91cCc6IGFjdGlvbixcbiAgICAgICAgICAgICAgICAgICAgICAgICdhcGlQYXRoJzogYXBpX3BhdGgsXG4gICAgICAgICAgICAgICAgICAgICAgICAnaHR0cFN0YXR1c0NvZGUnOiA1MDAsXG4gICAgICAgICAgICAgICAgICAgICAgICAncmVzcG9uc2VCb2R5Jzoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICdhcHBsaWNhdGlvbi9qc29uJzoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnYm9keSc6IGpzb24uZHVtcHMoeydlcnJvcic6IHN0cihlKX0pXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgIFxuICAgIHJldHVybiB7XG4gICAgICAgICdtZXNzYWdlVmVyc2lvbic6ICcxLjAnLFxuICAgICAgICAncmVzcG9uc2UnOiB7XG4gICAgICAgICAgICAnYWN0aW9uR3JvdXAnOiBhY3Rpb24sXG4gICAgICAgICAgICAnYXBpUGF0aCc6IGFwaV9wYXRoLFxuICAgICAgICAgICAgJ2h0dHBTdGF0dXNDb2RlJzogNDA0LFxuICAgICAgICAgICAgJ3Jlc3BvbnNlQm9keSc6IHtcbiAgICAgICAgICAgICAgICAnYXBwbGljYXRpb24vanNvbic6IHtcbiAgICAgICAgICAgICAgICAgICAgJ2JvZHknOiBqc29uLmR1bXBzKHsnZXJyb3InOiAnUm91dGUgbm90IGZvdW5kJ30pXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgICAgYCksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBEQVRBX0FOQUxZU1RfQUdFTlRfSUQ6IGRhdGFBbmFseXN0QWdlbnQuYXR0ckFnZW50SWQsXG4gICAgICAgIENPREVfQVNTSVNUQU5UX0FHRU5UX0lEOiBjb2RlQXNzaXN0YW50QWdlbnQuYXR0ckFnZW50SWQsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgcm91dGluZ0xhbWJkYS5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogWydiZWRyb2NrOkludm9rZUFnZW50J10sXG4gICAgICByZXNvdXJjZXM6IFsnKiddLFxuICAgIH0pKTtcblxuICAgIHJvdXRpbmdMYW1iZGEuZ3JhbnRJbnZva2Uob3JjaGVzdHJhdG9yUm9sZSk7XG5cbiAgICBjb25zdCBhcGlTY2hlbWEgPSB7XG4gICAgICBvcGVuYXBpOiAnMy4wLjAnLFxuICAgICAgaW5mbzoge1xuICAgICAgICB0aXRsZTogJ0FnZW50IFJvdXRpbmcgQVBJJyxcbiAgICAgICAgdmVyc2lvbjogJzEuMC4wJyxcbiAgICAgIH0sXG4gICAgICBwYXRoczoge1xuICAgICAgICAnL3JvdXRlLXRvLWFnZW50Jzoge1xuICAgICAgICAgIHBvc3Q6IHtcbiAgICAgICAgICAgIHN1bW1hcnk6ICdSb3V0ZSBxdWVyeSB0byBzcGVjaWFsaXN0IGFnZW50JyxcbiAgICAgICAgICAgIG9wZXJhdGlvbklkOiAncm91dGVUb0FnZW50JyxcbiAgICAgICAgICAgIHJlcXVlc3RCb2R5OiB7XG4gICAgICAgICAgICAgIHJlcXVpcmVkOiB0cnVlLFxuICAgICAgICAgICAgICBjb250ZW50OiB7XG4gICAgICAgICAgICAgICAgJ2FwcGxpY2F0aW9uL2pzb24nOiB7XG4gICAgICAgICAgICAgICAgICBzY2hlbWE6IHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgICBhZ2VudFR5cGU6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgZW51bTogWydkYXRhLWFuYWx5c3QnLCAnY29kZS1hc3Npc3RhbnQnXSxcbiAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgIHF1ZXJ5OiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlc3BvbnNlczoge1xuICAgICAgICAgICAgICAnMjAwJzoge1xuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnU3VjY2Vzc2Z1bCByZXNwb25zZSBmcm9tIHNwZWNpYWxpc3QgYWdlbnQnLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9O1xuXG4gICAgbmV3IGNkay5DZm5SZXNvdXJjZSh0aGlzLCAnUm91dGluZ0FjdGlvbkdyb3VwJywge1xuICAgICAgdHlwZTogJ0FXUzo6QmVkcm9jazo6QWdlbnRBY3Rpb25Hcm91cCcsXG4gICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgIEFnZW50SWQ6IG9yY2hlc3RyYXRvckFnZW50LmF0dHJBZ2VudElkLFxuICAgICAgICBBZ2VudFZlcnNpb246ICdEUkFGVCcsXG4gICAgICAgIEFjdGlvbkdyb3VwTmFtZTogJ2FnZW50LXJvdXRpbmcnLFxuICAgICAgICBBY3Rpb25Hcm91cEV4ZWN1dG9yOiB7XG4gICAgICAgICAgTGFtYmRhOiByb3V0aW5nTGFtYmRhLmZ1bmN0aW9uQXJuLFxuICAgICAgICB9LFxuICAgICAgICBBcGlTY2hlbWE6IHtcbiAgICAgICAgICBQYXlsb2FkOiBKU09OLnN0cmluZ2lmeShhcGlTY2hlbWEpLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdPcmNoZXN0cmF0b3JBZ2VudElkJywge1xuICAgICAgdmFsdWU6IG9yY2hlc3RyYXRvckFnZW50LmF0dHJBZ2VudElkLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0RhdGFBbmFseXN0QWdlbnRJZCcsIHtcbiAgICAgIHZhbHVlOiBkYXRhQW5hbHlzdEFnZW50LmF0dHJBZ2VudElkLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0NvZGVBc3Npc3RhbnRBZ2VudElkJywge1xuICAgICAgdmFsdWU6IGNvZGVBc3Npc3RhbnRBZ2VudC5hdHRyQWdlbnRJZCxcbiAgICB9KTtcbiAgfVxufVxuIl19