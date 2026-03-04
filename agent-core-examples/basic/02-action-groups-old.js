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
exports.ActionGroupsStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const bedrock = __importStar(require("aws-cdk-lib/aws-bedrock"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
class ActionGroupsStack extends cdk.Stack {
    constructor(scope, id, props) {
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
                        })
                    },
                },]
        });
        new cdk.CfnOutput(this, 'AgentId', {
            value: agent.attrAgentId,
        });
    }
}
exports.ActionGroupsStack = ActionGroupsStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiMDItYWN0aW9uLWdyb3Vwcy1vbGQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIwMi1hY3Rpb24tZ3JvdXBzLW9sZC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxpREFBbUM7QUFDbkMsaUVBQW1EO0FBQ25ELHlEQUEyQztBQUMzQywrREFBaUQ7QUFHakQsTUFBYSxpQkFBa0IsU0FBUSxHQUFHLENBQUMsS0FBSztJQUM5QyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQXNCO1FBQzlELEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLE1BQU0sU0FBUyxHQUFHLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsV0FBVyxFQUFFO1lBQ2hELFNBQVMsRUFBRSxJQUFJLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQyx1QkFBdUIsQ0FBQztTQUM3RCxDQUFDLENBQUM7UUFFSCxTQUFTLENBQUMsV0FBVyxDQUFDLElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQztZQUM1QyxNQUFNLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxLQUFLO1lBQ3hCLE9BQU8sRUFBRSxDQUFDLHFCQUFxQixDQUFDO1lBQ2hDLFNBQVMsRUFBRSxDQUFDLEdBQUcsQ0FBQztTQUNqQixDQUFDLENBQUMsQ0FBQztRQUVKLE1BQU0sWUFBWSxHQUFHLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsZUFBZSxFQUFFO1lBQzlELE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVc7WUFDbkMsT0FBTyxFQUFFLGVBQWU7WUFDeEIsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztPQStDNUIsQ0FBQztTQUNILENBQUMsQ0FBQztRQUVILFlBQVksQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLENBQUM7UUFFcEMsTUFBTSxLQUFLLEdBQUcsSUFBSSxPQUFPLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxjQUFjLEVBQUU7WUFDdkQsU0FBUyxFQUFFLDRCQUE0QjtZQUN2QyxvQkFBb0IsRUFBRSxTQUFTLENBQUMsT0FBTztZQUN2QyxlQUFlLEVBQUUseUNBQXlDO1lBQzFELFdBQVcsRUFBRTsyRkFDd0U7WUFDckYsdUJBQXVCLEVBQUUsR0FBRztZQUM1QixZQUFZLEVBQUUsQ0FBQztvQkFDYixlQUFlLEVBQUUsaUJBQWlCO29CQUNsQyxtQkFBbUIsRUFBRTt3QkFDbkIsTUFBTSxFQUFFLFlBQVksQ0FBQyxXQUFXO3FCQUNqQztvQkFDRCxTQUFTLEVBQUU7d0JBQ1QsT0FBTyxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUM7NEJBQ3RCLE9BQU8sRUFBRSxPQUFPOzRCQUNoQixJQUFJLEVBQUU7Z0NBQ0osS0FBSyxFQUFFLGFBQWE7Z0NBQ3BCLE9BQU8sRUFBRSxPQUFPO2dDQUNoQixXQUFXLEVBQUUscUNBQXFDOzZCQUNuRDs0QkFDRCxLQUFLLEVBQUU7Z0NBQ0wsY0FBYyxFQUFFO29DQUNkLEdBQUcsRUFBRTt3Q0FDSCxPQUFPLEVBQUUsb0NBQW9DO3dDQUM3QyxXQUFXLEVBQUUsb0NBQW9DO3dDQUNqRCxXQUFXLEVBQUUsWUFBWTt3Q0FDekIsVUFBVSxFQUFFOzRDQUNWO2dEQUNFLElBQUksRUFBRSxVQUFVO2dEQUNoQixFQUFFLEVBQUUsT0FBTztnREFDWCxXQUFXLEVBQUUseUNBQXlDO2dEQUN0RCxRQUFRLEVBQUUsSUFBSTtnREFDZCxNQUFNLEVBQUU7b0RBQ04sSUFBSSxFQUFFLFFBQVE7aURBQ2Y7NkNBQ0Y7eUNBQ0Y7d0NBQ0QsU0FBUyxFQUFFOzRDQUNULEtBQUssRUFBRTtnREFDTCxXQUFXLEVBQUUscUJBQXFCO2dEQUNsQyxPQUFPLEVBQUU7b0RBQ1Asa0JBQWtCLEVBQUU7d0RBQ2xCLE1BQU0sRUFBRTs0REFDTixJQUFJLEVBQUUsUUFBUTs0REFDZCxVQUFVLEVBQUU7Z0VBQ1YsUUFBUSxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRTtnRUFDNUIsV0FBVyxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRTtnRUFDL0IsVUFBVSxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRTtnRUFDOUIsUUFBUSxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRTs2REFDN0I7eURBQ0Y7cURBQ0Y7aURBQ0Y7NkNBQ0Y7eUNBQ0Y7cUNBQ0Y7aUNBQ0Y7NkJBQ0Y7eUJBQ0YsQ0FBQztxQkFDSDtpQkFDRixFQUFDO1NBQ0gsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxTQUFTLEVBQUU7WUFDakMsS0FBSyxFQUFFLEtBQUssQ0FBQyxXQUFXO1NBQ3pCLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQXhJRCw4Q0F3SUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgYmVkcm9jayBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYmVkcm9jayc7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcblxuZXhwb3J0IGNsYXNzIEFjdGlvbkdyb3Vwc1N0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM/OiBjZGsuU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgY29uc3QgYWdlbnRSb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsICdBZ2VudFJvbGUnLCB7XG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnYmVkcm9jay5hbWF6b25hd3MuY29tJyksXG4gICAgfSk7XG5cbiAgICBhZ2VudFJvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogWydiZWRyb2NrOkludm9rZU1vZGVsJ10sXG4gICAgICByZXNvdXJjZXM6IFsnKiddLFxuICAgIH0pKTtcblxuICAgIGNvbnN0IGFjdGlvbkxhbWJkYSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0FjdGlvbkhhbmRsZXInLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5QWVRIT05fM18xMixcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21JbmxpbmUoYFxuaW1wb3J0IGpzb25cblxuZGVmIGhhbmRsZXIoZXZlbnQsIGNvbnRleHQpOlxuICAgIFwiXCJcIlxuICAgIEhhbmRsZSBhZ2VudCBhY3Rpb25zXG4gICAgXCJcIlwiXG4gICAgYWN0aW9uID0gZXZlbnQuZ2V0KCdhY3Rpb25Hcm91cCcpXG4gICAgYXBpX3BhdGggPSBldmVudC5nZXQoJ2FwaVBhdGgnKVxuICAgIFxuICAgIGlmIGFwaV9wYXRoID09ICcvZ2V0LXdlYXRoZXInOlxuICAgICAgICBwYXJhbWV0ZXJzID0gZXZlbnQuZ2V0KCdwYXJhbWV0ZXJzJywgW10pXG4gICAgICAgIGxvY2F0aW9uID0gbmV4dCgocFsndmFsdWUnXSBmb3IgcCBpbiBwYXJhbWV0ZXJzIGlmIHBbJ25hbWUnXSA9PSAnbG9jYXRpb24nKSwgJ1Vua25vd24nKVxuICAgICAgICBcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICdtZXNzYWdlVmVyc2lvbic6ICcxLjAnLFxuICAgICAgICAgICAgJ3Jlc3BvbnNlJzoge1xuICAgICAgICAgICAgICAgICdhY3Rpb25Hcm91cCc6IGFjdGlvbixcbiAgICAgICAgICAgICAgICAnYXBpUGF0aCc6IGFwaV9wYXRoLFxuICAgICAgICAgICAgICAgICdodHRwTWV0aG9kJzogZXZlbnQuZ2V0KCdodHRwTWV0aG9kJyksXG4gICAgICAgICAgICAgICAgJ2h0dHBTdGF0dXNDb2RlJzogMjAwLFxuICAgICAgICAgICAgICAgICdyZXNwb25zZUJvZHknOiB7XG4gICAgICAgICAgICAgICAgICAgICdhcHBsaWNhdGlvbi9qc29uJzoge1xuICAgICAgICAgICAgICAgICAgICAgICAgJ2JvZHknOiBqc29uLmR1bXBzKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAnbG9jYXRpb24nOiBsb2NhdGlvbixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAndGVtcGVyYXR1cmUnOiA3MixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAnY29uZGl0aW9ucyc6ICdTdW5ueScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJ2h1bWlkaXR5JzogNDVcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgICAnbWVzc2FnZVZlcnNpb24nOiAnMS4wJyxcbiAgICAgICAgJ3Jlc3BvbnNlJzoge1xuICAgICAgICAgICAgJ2FjdGlvbkdyb3VwJzogYWN0aW9uLFxuICAgICAgICAgICAgJ2FwaVBhdGgnOiBhcGlfcGF0aCxcbiAgICAgICAgICAgICdodHRwU3RhdHVzQ29kZSc6IDQwNCxcbiAgICAgICAgICAgICdyZXNwb25zZUJvZHknOiB7XG4gICAgICAgICAgICAgICAgJ2FwcGxpY2F0aW9uL2pzb24nOiB7XG4gICAgICAgICAgICAgICAgICAgICdib2R5JzoganNvbi5kdW1wcyh7J2Vycm9yJzogJ0FjdGlvbiBub3QgZm91bmQnfSlcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgICBgKSxcbiAgICB9KTtcblxuICAgIGFjdGlvbkxhbWJkYS5ncmFudEludm9rZShhZ2VudFJvbGUpO1xuXG4gICAgY29uc3QgYWdlbnQgPSBuZXcgYmVkcm9jay5DZm5BZ2VudCh0aGlzLCAnV2VhdGhlckFnZW50Jywge1xuICAgICAgYWdlbnROYW1lOiAnd2VhdGhlci1hZ2VudC13aXRoLWFjdGlvbnMnLFxuICAgICAgYWdlbnRSZXNvdXJjZVJvbGVBcm46IGFnZW50Um9sZS5yb2xlQXJuLFxuICAgICAgZm91bmRhdGlvbk1vZGVsOiAnYW50aHJvcGljLmNsYXVkZS0zLXNvbm5ldC0yMDI0MDIyOS12MTowJyxcbiAgICAgIGluc3RydWN0aW9uOiBgWW91IGFyZSBhIGhlbHBmdWwgd2VhdGhlciBhc3Npc3RhbnQuIFlvdSBjYW4gcHJvdmlkZSB3ZWF0aGVyIGluZm9ybWF0aW9uIGZvciBhbnkgbG9jYXRpb24uXG4gICAgICBXaGVuIGFza2VkIGFib3V0IHdlYXRoZXIsIHVzZSB0aGUgZ2V0LXdlYXRoZXIgYWN0aW9uIHRvIHJldHJpZXZlIGN1cnJlbnQgY29uZGl0aW9ucy5gLFxuICAgICAgaWRsZVNlc3Npb25UdGxJblNlY29uZHM6IDYwMCxcbiAgICAgIGFjdGlvbkdyb3VwczogW3tcbiAgICAgICAgYWN0aW9uR3JvdXBOYW1lOiAnd2VhdGhlci1hY3Rpb25zJyxcbiAgICAgICAgYWN0aW9uR3JvdXBFeGVjdXRvcjoge1xuICAgICAgICAgIGxhbWJkYTogYWN0aW9uTGFtYmRhLmZ1bmN0aW9uQXJuLFxuICAgICAgICB9LFxuICAgICAgICBhcGlTY2hlbWE6IHtcbiAgICAgICAgICBwYXlsb2FkOiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBvcGVuYXBpOiAnMy4wLjAnLFxuICAgICAgICAgICAgaW5mbzoge1xuICAgICAgICAgICAgICB0aXRsZTogJ1dlYXRoZXIgQVBJJyxcbiAgICAgICAgICAgICAgdmVyc2lvbjogJzEuMC4wJyxcbiAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdBUEkgZm9yIGdldHRpbmcgd2VhdGhlciBpbmZvcm1hdGlvbicsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcGF0aHM6IHtcbiAgICAgICAgICAgICAgJy9nZXQtd2VhdGhlcic6IHtcbiAgICAgICAgICAgICAgICBnZXQ6IHtcbiAgICAgICAgICAgICAgICAgIHN1bW1hcnk6ICdHZXQgY3VycmVudCB3ZWF0aGVyIGZvciBhIGxvY2F0aW9uJyxcbiAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnUmV0dXJucyBjdXJyZW50IHdlYXRoZXIgY29uZGl0aW9ucycsXG4gICAgICAgICAgICAgICAgICBvcGVyYXRpb25JZDogJ2dldFdlYXRoZXInLFxuICAgICAgICAgICAgICAgICAgcGFyYW1ldGVyczogW1xuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgbmFtZTogJ2xvY2F0aW9uJyxcbiAgICAgICAgICAgICAgICAgICAgICBpbjogJ3F1ZXJ5JyxcbiAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1RoZSBjaXR5IG9yIGxvY2F0aW9uIHRvIGdldCB3ZWF0aGVyIGZvcicsXG4gICAgICAgICAgICAgICAgICAgICAgcmVxdWlyZWQ6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgc2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICAgIHJlc3BvbnNlczoge1xuICAgICAgICAgICAgICAgICAgICAnMjAwJzoge1xuICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnU3VjY2Vzc2Z1bCByZXNwb25zZScsXG4gICAgICAgICAgICAgICAgICAgICAgY29udGVudDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgJ2FwcGxpY2F0aW9uL2pzb24nOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHNjaGVtYToge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvY2F0aW9uOiB7IHR5cGU6ICdzdHJpbmcnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0ZW1wZXJhdHVyZTogeyB0eXBlOiAnbnVtYmVyJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uZGl0aW9uczogeyB0eXBlOiAnc3RyaW5nJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaHVtaWRpdHk6IHsgdHlwZTogJ251bWJlcicgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBZ2VudElkJywge1xuICAgICAgdmFsdWU6IGFnZW50LmF0dHJBZ2VudElkLFxuICAgIH0pO1xuICB9XG59XG4iXX0=