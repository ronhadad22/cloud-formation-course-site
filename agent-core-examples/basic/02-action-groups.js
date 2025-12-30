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
        new cdk.CfnResource(this, 'WeatherActionGroup', {
            type: 'AWS::Bedrock::AgentActionGroup',
            properties: {
                AgentId: agent.attrAgentId,
                AgentVersion: 'DRAFT',
                ActionGroupName: 'weather-actions',
                ActionGroupExecutor: {
                    Lambda: actionLambda.functionArn,
                },
                ApiSchema: {
                    Payload: JSON.stringify(apiSchema),
                },
                Description: 'Actions for retrieving weather information',
            },
        });
        new cdk.CfnOutput(this, 'AgentId', {
            value: agent.attrAgentId,
        });
    }
}
exports.ActionGroupsStack = ActionGroupsStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiMDItYWN0aW9uLWdyb3Vwcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIjAyLWFjdGlvbi1ncm91cHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBQ25DLGlFQUFtRDtBQUNuRCx5REFBMkM7QUFDM0MsK0RBQWlEO0FBR2pELE1BQWEsaUJBQWtCLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDOUMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFzQjtRQUM5RCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixNQUFNLFNBQVMsR0FBRyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLFdBQVcsRUFBRTtZQUNoRCxTQUFTLEVBQUUsSUFBSSxHQUFHLENBQUMsZ0JBQWdCLENBQUMsdUJBQXVCLENBQUM7U0FDN0QsQ0FBQyxDQUFDO1FBRUgsU0FBUyxDQUFDLFdBQVcsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxlQUFlLENBQUM7WUFDNUMsTUFBTSxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSztZQUN4QixPQUFPLEVBQUUsQ0FBQyxxQkFBcUIsQ0FBQztZQUNoQyxTQUFTLEVBQUUsQ0FBQyxHQUFHLENBQUM7U0FDakIsQ0FBQyxDQUFDLENBQUM7UUFFSixNQUFNLFlBQVksR0FBRyxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLGVBQWUsRUFBRTtZQUM5RCxPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXO1lBQ25DLE9BQU8sRUFBRSxlQUFlO1lBQ3hCLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7T0ErQzVCLENBQUM7U0FDSCxDQUFDLENBQUM7UUFFSCxZQUFZLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBRXBDLE1BQU0sS0FBSyxHQUFHLElBQUksT0FBTyxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsa0JBQWtCLEVBQUU7WUFDM0QsU0FBUyxFQUFFLDBCQUEwQjtZQUNyQyxvQkFBb0IsRUFBRSxTQUFTLENBQUMsT0FBTztZQUN2QyxlQUFlLEVBQUUseUNBQXlDO1lBQzFELFdBQVcsRUFBRSxvRkFBb0Y7U0FDbEcsQ0FBQyxDQUFDO1FBRUgsTUFBTSxTQUFTLEdBQUc7WUFDaEIsT0FBTyxFQUFFLE9BQU87WUFDaEIsSUFBSSxFQUFFO2dCQUNKLEtBQUssRUFBRSxhQUFhO2dCQUNwQixPQUFPLEVBQUUsT0FBTztnQkFDaEIsV0FBVyxFQUFFLHFDQUFxQzthQUNuRDtZQUNELEtBQUssRUFBRTtnQkFDTCxjQUFjLEVBQUU7b0JBQ2QsR0FBRyxFQUFFO3dCQUNILE9BQU8sRUFBRSw0QkFBNEI7d0JBQ3JDLFdBQVcsRUFBRSwrREFBK0Q7d0JBQzVFLFdBQVcsRUFBRSxZQUFZO3dCQUN6QixVQUFVLEVBQUU7NEJBQ1Y7Z0NBQ0UsSUFBSSxFQUFFLFVBQVU7Z0NBQ2hCLEVBQUUsRUFBRSxPQUFPO2dDQUNYLFdBQVcsRUFBRSx5Q0FBeUM7Z0NBQ3RELFFBQVEsRUFBRSxJQUFJO2dDQUNkLE1BQU0sRUFBRTtvQ0FDTixJQUFJLEVBQUUsUUFBUTtpQ0FDZjs2QkFDRjt5QkFDRjt3QkFDRCxTQUFTLEVBQUU7NEJBQ1QsS0FBSyxFQUFFO2dDQUNMLFdBQVcsRUFBRSxxQkFBcUI7Z0NBQ2xDLE9BQU8sRUFBRTtvQ0FDUCxrQkFBa0IsRUFBRTt3Q0FDbEIsTUFBTSxFQUFFOzRDQUNOLElBQUksRUFBRSxRQUFROzRDQUNkLFVBQVUsRUFBRTtnREFDVixRQUFRLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFO2dEQUM1QixXQUFXLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFO2dEQUMvQixVQUFVLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFO2dEQUM5QixRQUFRLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFOzZDQUM3Qjt5Q0FDRjtxQ0FDRjtpQ0FDRjs2QkFDRjt5QkFDRjtxQkFDRjtpQkFDRjthQUNGO1NBQ0YsQ0FBQztRQUVGLElBQUksR0FBRyxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUUsb0JBQW9CLEVBQUU7WUFDOUMsSUFBSSxFQUFFLGdDQUFnQztZQUN0QyxVQUFVLEVBQUU7Z0JBQ1YsT0FBTyxFQUFFLEtBQUssQ0FBQyxXQUFXO2dCQUMxQixZQUFZLEVBQUUsT0FBTztnQkFDckIsZUFBZSxFQUFFLGlCQUFpQjtnQkFDbEMsbUJBQW1CLEVBQUU7b0JBQ25CLE1BQU0sRUFBRSxZQUFZLENBQUMsV0FBVztpQkFDakM7Z0JBQ0QsU0FBUyxFQUFFO29CQUNULE9BQU8sRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQztpQkFDbkM7Z0JBQ0QsV0FBVyxFQUFFLDRDQUE0QzthQUMxRDtTQUNGLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsU0FBUyxFQUFFO1lBQ2pDLEtBQUssRUFBRSxLQUFLLENBQUMsV0FBVztTQUN6QixDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUEvSUQsOENBK0lDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGJlZHJvY2sgZnJvbSAnYXdzLWNkay1saWIvYXdzLWJlZHJvY2snO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5cbmV4cG9ydCBjbGFzcyBBY3Rpb25Hcm91cHNTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzPzogY2RrLlN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIGNvbnN0IGFnZW50Um9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnQWdlbnRSb2xlJywge1xuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2JlZHJvY2suYW1hem9uYXdzLmNvbScpLFxuICAgIH0pO1xuXG4gICAgYWdlbnRSb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFsnYmVkcm9jazpJbnZva2VNb2RlbCddLFxuICAgICAgcmVzb3VyY2VzOiBbJyonXSxcbiAgICB9KSk7XG5cbiAgICBjb25zdCBhY3Rpb25MYW1iZGEgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdBY3Rpb25IYW5kbGVyJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfMTIsXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tSW5saW5lKGBcbmltcG9ydCBqc29uXG5cbmRlZiBoYW5kbGVyKGV2ZW50LCBjb250ZXh0KTpcbiAgICBcIlwiXCJcbiAgICBIYW5kbGUgYWdlbnQgYWN0aW9uc1xuICAgIFwiXCJcIlxuICAgIGFjdGlvbiA9IGV2ZW50LmdldCgnYWN0aW9uR3JvdXAnKVxuICAgIGFwaV9wYXRoID0gZXZlbnQuZ2V0KCdhcGlQYXRoJylcbiAgICBcbiAgICBpZiBhcGlfcGF0aCA9PSAnL2dldC13ZWF0aGVyJzpcbiAgICAgICAgcGFyYW1ldGVycyA9IGV2ZW50LmdldCgncGFyYW1ldGVycycsIFtdKVxuICAgICAgICBsb2NhdGlvbiA9IG5leHQoKHBbJ3ZhbHVlJ10gZm9yIHAgaW4gcGFyYW1ldGVycyBpZiBwWyduYW1lJ10gPT0gJ2xvY2F0aW9uJyksICdVbmtub3duJylcbiAgICAgICAgXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAnbWVzc2FnZVZlcnNpb24nOiAnMS4wJyxcbiAgICAgICAgICAgICdyZXNwb25zZSc6IHtcbiAgICAgICAgICAgICAgICAnYWN0aW9uR3JvdXAnOiBhY3Rpb24sXG4gICAgICAgICAgICAgICAgJ2FwaVBhdGgnOiBhcGlfcGF0aCxcbiAgICAgICAgICAgICAgICAnaHR0cE1ldGhvZCc6IGV2ZW50LmdldCgnaHR0cE1ldGhvZCcpLFxuICAgICAgICAgICAgICAgICdodHRwU3RhdHVzQ29kZSc6IDIwMCxcbiAgICAgICAgICAgICAgICAncmVzcG9uc2VCb2R5Jzoge1xuICAgICAgICAgICAgICAgICAgICAnYXBwbGljYXRpb24vanNvbic6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICdib2R5JzoganNvbi5kdW1wcyh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJ2xvY2F0aW9uJzogbG9jYXRpb24sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJ3RlbXBlcmF0dXJlJzogNzIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJ2NvbmRpdGlvbnMnOiAnU3VubnknLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICdodW1pZGl0eSc6IDQ1XG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgXG4gICAgcmV0dXJuIHtcbiAgICAgICAgJ21lc3NhZ2VWZXJzaW9uJzogJzEuMCcsXG4gICAgICAgICdyZXNwb25zZSc6IHtcbiAgICAgICAgICAgICdhY3Rpb25Hcm91cCc6IGFjdGlvbixcbiAgICAgICAgICAgICdhcGlQYXRoJzogYXBpX3BhdGgsXG4gICAgICAgICAgICAnaHR0cFN0YXR1c0NvZGUnOiA0MDQsXG4gICAgICAgICAgICAncmVzcG9uc2VCb2R5Jzoge1xuICAgICAgICAgICAgICAgICdhcHBsaWNhdGlvbi9qc29uJzoge1xuICAgICAgICAgICAgICAgICAgICAnYm9keSc6IGpzb24uZHVtcHMoeydlcnJvcic6ICdBY3Rpb24gbm90IGZvdW5kJ30pXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgICAgYCksXG4gICAgfSk7XG5cbiAgICBhY3Rpb25MYW1iZGEuZ3JhbnRJbnZva2UoYWdlbnRSb2xlKTtcblxuICAgIGNvbnN0IGFnZW50ID0gbmV3IGJlZHJvY2suQ2ZuQWdlbnQodGhpcywgJ0FnZW50V2l0aEFjdGlvbnMnLCB7XG4gICAgICBhZ2VudE5hbWU6ICdhZ2VudC13aXRoLWFjdGlvbi1ncm91cHMnLFxuICAgICAgYWdlbnRSZXNvdXJjZVJvbGVBcm46IGFnZW50Um9sZS5yb2xlQXJuLFxuICAgICAgZm91bmRhdGlvbk1vZGVsOiAnYW50aHJvcGljLmNsYXVkZS0zLXNvbm5ldC0yMDI0MDIyOS12MTowJyxcbiAgICAgIGluc3RydWN0aW9uOiAnWW91IGFyZSBhIHdlYXRoZXIgYXNzaXN0YW50IHRoYXQgY2FuIHByb3ZpZGUgd2VhdGhlciBpbmZvcm1hdGlvbiBmb3IgYW55IGxvY2F0aW9uLicsXG4gICAgfSk7XG5cbiAgICBjb25zdCBhcGlTY2hlbWEgPSB7XG4gICAgICBvcGVuYXBpOiAnMy4wLjAnLFxuICAgICAgaW5mbzoge1xuICAgICAgICB0aXRsZTogJ1dlYXRoZXIgQVBJJyxcbiAgICAgICAgdmVyc2lvbjogJzEuMC4wJyxcbiAgICAgICAgZGVzY3JpcHRpb246ICdBUEkgZm9yIGdldHRpbmcgd2VhdGhlciBpbmZvcm1hdGlvbicsXG4gICAgICB9LFxuICAgICAgcGF0aHM6IHtcbiAgICAgICAgJy9nZXQtd2VhdGhlcic6IHtcbiAgICAgICAgICBnZXQ6IHtcbiAgICAgICAgICAgIHN1bW1hcnk6ICdHZXQgd2VhdGhlciBmb3IgYSBsb2NhdGlvbicsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1JldHVybnMgY3VycmVudCB3ZWF0aGVyIGNvbmRpdGlvbnMgZm9yIHRoZSBzcGVjaWZpZWQgbG9jYXRpb24nLFxuICAgICAgICAgICAgb3BlcmF0aW9uSWQ6ICdnZXRXZWF0aGVyJyxcbiAgICAgICAgICAgIHBhcmFtZXRlcnM6IFtcbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdsb2NhdGlvbicsXG4gICAgICAgICAgICAgICAgaW46ICdxdWVyeScsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdUaGUgY2l0eSBvciBsb2NhdGlvbiB0byBnZXQgd2VhdGhlciBmb3InLFxuICAgICAgICAgICAgICAgIHJlcXVpcmVkOiB0cnVlLFxuICAgICAgICAgICAgICAgIHNjaGVtYToge1xuICAgICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICByZXNwb25zZXM6IHtcbiAgICAgICAgICAgICAgJzIwMCc6IHtcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1N1Y2Nlc3NmdWwgcmVzcG9uc2UnLFxuICAgICAgICAgICAgICAgIGNvbnRlbnQ6IHtcbiAgICAgICAgICAgICAgICAgICdhcHBsaWNhdGlvbi9qc29uJzoge1xuICAgICAgICAgICAgICAgICAgICBzY2hlbWE6IHtcbiAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2NhdGlvbjogeyB0eXBlOiAnc3RyaW5nJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgdGVtcGVyYXR1cmU6IHsgdHlwZTogJ251bWJlcicgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbmRpdGlvbnM6IHsgdHlwZTogJ3N0cmluZycgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGh1bWlkaXR5OiB7IHR5cGU6ICdudW1iZXInIH0sXG4gICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfTtcblxuICAgIG5ldyBjZGsuQ2ZuUmVzb3VyY2UodGhpcywgJ1dlYXRoZXJBY3Rpb25Hcm91cCcsIHtcbiAgICAgIHR5cGU6ICdBV1M6OkJlZHJvY2s6OkFnZW50QWN0aW9uR3JvdXAnLFxuICAgICAgcHJvcGVydGllczoge1xuICAgICAgICBBZ2VudElkOiBhZ2VudC5hdHRyQWdlbnRJZCxcbiAgICAgICAgQWdlbnRWZXJzaW9uOiAnRFJBRlQnLFxuICAgICAgICBBY3Rpb25Hcm91cE5hbWU6ICd3ZWF0aGVyLWFjdGlvbnMnLFxuICAgICAgICBBY3Rpb25Hcm91cEV4ZWN1dG9yOiB7XG4gICAgICAgICAgTGFtYmRhOiBhY3Rpb25MYW1iZGEuZnVuY3Rpb25Bcm4sXG4gICAgICAgIH0sXG4gICAgICAgIEFwaVNjaGVtYToge1xuICAgICAgICAgIFBheWxvYWQ6IEpTT04uc3RyaW5naWZ5KGFwaVNjaGVtYSksXG4gICAgICAgIH0sXG4gICAgICAgIERlc2NyaXB0aW9uOiAnQWN0aW9ucyBmb3IgcmV0cmlldmluZyB3ZWF0aGVyIGluZm9ybWF0aW9uJyxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQWdlbnRJZCcsIHtcbiAgICAgIHZhbHVlOiBhZ2VudC5hdHRyQWdlbnRJZCxcbiAgICB9KTtcbiAgfVxufVxuIl19