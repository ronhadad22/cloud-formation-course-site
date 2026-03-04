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
exports.ActionGroupsStack = ActionGroupsStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiMDItYWN0aW9uLWdyb3Vwcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIjAyLWFjdGlvbi1ncm91cHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBQ25DLGlFQUFtRDtBQUNuRCx5REFBMkM7QUFDM0MsK0RBQWlEO0FBR2pELE1BQWEsaUJBQWtCLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDOUMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFzQjtRQUM5RCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixNQUFNLFNBQVMsR0FBRyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLFdBQVcsRUFBRTtZQUNoRCxTQUFTLEVBQUUsSUFBSSxHQUFHLENBQUMsZ0JBQWdCLENBQUMsdUJBQXVCLENBQUM7WUFDNUQsZUFBZSxFQUFFO2dCQUNmLEdBQUcsQ0FBQyxhQUFhLENBQUMsd0JBQXdCLENBQUMseUJBQXlCLENBQUM7YUFDdEU7U0FDRixDQUFDLENBQUM7UUFFSCxNQUFNLFlBQVksR0FBRyxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLGVBQWUsRUFBRTtZQUM5RCxPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXO1lBQ25DLE9BQU8sRUFBRSxlQUFlO1lBQ3hCLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7T0ErQzVCLENBQUM7U0FDSCxDQUFDLENBQUM7UUFFSCxnQ0FBZ0M7UUFDaEMsU0FBUyxDQUFDLFdBQVcsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxlQUFlLENBQUM7WUFDNUMsTUFBTSxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSztZQUN4QixPQUFPLEVB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QUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLFVBQVUsRUFBRTtZQUNsQyxLQUFLLEVBQUUsS0FBSyxDQUFDLFlBQVk7WUFDekIsV0FBVyxFQUFFLFdBQVc7U0FDekIsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBbktELDhDQW1LQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBiZWRyb2NrIGZyb20gJ2F3cy1jZGstbGliL2F3cy1iZWRyb2NrJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuXG5leHBvcnQgY2xhc3MgQWN0aW9uR3JvdXBzU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wcz86IGNkay5TdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICBjb25zdCBhZ2VudFJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ0FnZW50Um9sZScsIHtcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdiZWRyb2NrLmFtYXpvbmF3cy5jb20nKSxcbiAgICAgIG1hbmFnZWRQb2xpY2llczogW1xuICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoJ0FtYXpvbkJlZHJvY2tGdWxsQWNjZXNzJyksXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgY29uc3QgYWN0aW9uTGFtYmRhID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnQWN0aW9uSGFuZGxlcicsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLlBZVEhPTl8zXzEyLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUlubGluZShgXG5pbXBvcnQganNvblxuXG5kZWYgaGFuZGxlcihldmVudCwgY29udGV4dCk6XG4gICAgXCJcIlwiXG4gICAgSGFuZGxlIGFnZW50IGFjdGlvbnNcbiAgICBcIlwiXCJcbiAgICBhY3Rpb24gPSBldmVudC5nZXQoJ2FjdGlvbkdyb3VwJylcbiAgICBhcGlfcGF0aCA9IGV2ZW50LmdldCgnYXBpUGF0aCcpXG4gICAgXG4gICAgaWYgYXBpX3BhdGggPT0gJy9nZXQtd2VhdGhlcic6XG4gICAgICAgIHBhcmFtZXRlcnMgPSBldmVudC5nZXQoJ3BhcmFtZXRlcnMnLCBbXSlcbiAgICAgICAgbG9jYXRpb24gPSBuZXh0KChwWyd2YWx1ZSddIGZvciBwIGluIHBhcmFtZXRlcnMgaWYgcFsnbmFtZSddID09ICdsb2NhdGlvbicpLCAnVW5rbm93bicpXG4gICAgICAgIFxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgJ21lc3NhZ2VWZXJzaW9uJzogJzEuMCcsXG4gICAgICAgICAgICAncmVzcG9uc2UnOiB7XG4gICAgICAgICAgICAgICAgJ2FjdGlvbkdyb3VwJzogYWN0aW9uLFxuICAgICAgICAgICAgICAgICdhcGlQYXRoJzogYXBpX3BhdGgsXG4gICAgICAgICAgICAgICAgJ2h0dHBNZXRob2QnOiBldmVudC5nZXQoJ2h0dHBNZXRob2QnKSxcbiAgICAgICAgICAgICAgICAnaHR0cFN0YXR1c0NvZGUnOiAyMDAsXG4gICAgICAgICAgICAgICAgJ3Jlc3BvbnNlQm9keSc6IHtcbiAgICAgICAgICAgICAgICAgICAgJ2FwcGxpY2F0aW9uL2pzb24nOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAnYm9keSc6IGpzb24uZHVtcHMoe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICdsb2NhdGlvbic6IGxvY2F0aW9uLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICd0ZW1wZXJhdHVyZSc6IDcyLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICdjb25kaXRpb25zJzogJ1N1bm55JyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAnaHVtaWRpdHknOiA0NVxuICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIFxuICAgIHJldHVybiB7XG4gICAgICAgICdtZXNzYWdlVmVyc2lvbic6ICcxLjAnLFxuICAgICAgICAncmVzcG9uc2UnOiB7XG4gICAgICAgICAgICAnYWN0aW9uR3JvdXAnOiBhY3Rpb24sXG4gICAgICAgICAgICAnYXBpUGF0aCc6IGFwaV9wYXRoLFxuICAgICAgICAgICAgJ2h0dHBTdGF0dXNDb2RlJzogNDA0LFxuICAgICAgICAgICAgJ3Jlc3BvbnNlQm9keSc6IHtcbiAgICAgICAgICAgICAgICAnYXBwbGljYXRpb24vanNvbic6IHtcbiAgICAgICAgICAgICAgICAgICAgJ2JvZHknOiBqc29uLmR1bXBzKHsnZXJyb3InOiAnQWN0aW9uIG5vdCBmb3VuZCd9KVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICAgIGApLFxuICAgIH0pO1xuXG4gICAgLy8gQWRkIHBlcm1pc3Npb25zIHRvIGFnZW50IHJvbGVcbiAgICBhZ2VudFJvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICAnYmVkcm9jazpJbnZva2VNb2RlbCcsXG4gICAgICAgICdiZWRyb2NrOkludm9rZU1vZGVsV2l0aFJlc3BvbnNlU3RyZWFtJyxcbiAgICAgIF0sXG4gICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgYGFybjphd3M6YmVkcm9jazoke3RoaXMucmVnaW9ufTo6Zm91bmRhdGlvbi1tb2RlbC9hbnRocm9waWMuY2xhdWRlLTMtc29ubmV0LTIwMjQwMjI5LXYxOjBgLFxuICAgICAgXSxcbiAgICB9KSk7XG5cbiAgICAvLyBBbGxvdyBhZ2VudCB0byBpbnZva2UgTGFtYmRhXG4gICAgYWdlbnRSb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFsnbGFtYmRhOkludm9rZUZ1bmN0aW9uJ10sXG4gICAgICByZXNvdXJjZXM6IFthY3Rpb25MYW1iZGEuZnVuY3Rpb25Bcm5dLFxuICAgIH0pKTtcblxuICAgIC8vIENyZWF0ZSBhZ2VudCBmaXJzdCBzbyB3ZSBjYW4gcmVmZXJlbmNlIGl0XG4gICAgY29uc3QgYWdlbnQgPSBuZXcgYmVkcm9jay5DZm5BZ2VudCh0aGlzLCAnV2VhdGhlckFnZW50Jywge1xuICAgICAgYWdlbnROYW1lOiAnd2VhdGhlci1hZ2VudC13aXRoLWFjdGlvbnMnLFxuICAgICAgYWdlbnRSZXNvdXJjZVJvbGVBcm46IGFnZW50Um9sZS5yb2xlQXJuLFxuICAgICAgZm91bmRhdGlvbk1vZGVsOiAnYW50aHJvcGljLmNsYXVkZS0zLXNvbm5ldC0yMDI0MDIyOS12MTowJyxcbiAgICAgIGluc3RydWN0aW9uOiBgWW91IGFyZSBhIGhlbHBmdWwgd2VhdGhlciBhc3Npc3RhbnQuIFlvdSBjYW4gcHJvdmlkZSB3ZWF0aGVyIGluZm9ybWF0aW9uIGZvciBhbnkgbG9jYXRpb24uXG4gICAgICBXaGVuIGFza2VkIGFib3V0IHdlYXRoZXIsIHVzZSB0aGUgZ2V0LXdlYXRoZXIgYWN0aW9uIHRvIHJldHJpZXZlIGN1cnJlbnQgY29uZGl0aW9ucy5gLFxuICAgICAgaWRsZVNlc3Npb25UdGxJblNlY29uZHM6IDYwMCxcbiAgICAgIGFjdGlvbkdyb3VwczogW3tcbiAgICAgICAgYWN0aW9uR3JvdXBOYW1lOiAnd2VhdGhlci1hY3Rpb25zJyxcbiAgICAgICAgYWN0aW9uR3JvdXBFeGVjdXRvcjoge1xuICAgICAgICAgIGxhbWJkYTogYWN0aW9uTGFtYmRhLmZ1bmN0aW9uQXJuLFxuICAgICAgICB9LFxuICAgICAgICBhcGlTY2hlbWE6IHtcbiAgICAgICAgICBwYXlsb2FkOiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBvcGVuYXBpOiAnMy4wLjAnLFxuICAgICAgICAgICAgaW5mbzoge1xuICAgICAgICAgICAgICB0aXRsZTogJ1dlYXRoZXIgQVBJJyxcbiAgICAgICAgICAgICAgdmVyc2lvbjogJzEuMC4wJyxcbiAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdBUEkgZm9yIGdldHRpbmcgd2VhdGhlciBpbmZvcm1hdGlvbicsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcGF0aHM6IHtcbiAgICAgICAgICAgICAgJy9nZXQtd2VhdGhlcic6IHtcbiAgICAgICAgICAgICAgICBnZXQ6IHtcbiAgICAgICAgICAgICAgICAgIHN1bW1hcnk6ICdHZXQgY3VycmVudCB3ZWF0aGVyIGZvciBhIGxvY2F0aW9uJyxcbiAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnUmV0dXJucyBjdXJyZW50IHdlYXRoZXIgY29uZGl0aW9ucycsXG4gICAgICAgICAgICAgICAgICBvcGVyYXRpb25JZDogJ2dldFdlYXRoZXInLFxuICAgICAgICAgICAgICAgICAgcGFyYW1ldGVyczogW3tcbiAgICAgICAgICAgICAgICAgICAgbmFtZTogJ2xvY2F0aW9uJyxcbiAgICAgICAgICAgICAgICAgICAgaW46ICdxdWVyeScsXG4gICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnQ2l0eSBuYW1lIG9yIGxvY2F0aW9uJyxcbiAgICAgICAgICAgICAgICAgICAgcmVxdWlyZWQ6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIHNjaGVtYToge1xuICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgfV0sXG4gICAgICAgICAgICAgICAgICByZXNwb25zZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgJzIwMCc6IHtcbiAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1N1Y2Nlc3NmdWwgcmVzcG9uc2UnLFxuICAgICAgICAgICAgICAgICAgICAgIGNvbnRlbnQ6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICdhcHBsaWNhdGlvbi9qc29uJzoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICBzY2hlbWE6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2NhdGlvbjogeyB0eXBlOiAnc3RyaW5nJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGVtcGVyYXR1cmU6IHsgdHlwZTogJ251bWJlcicgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbmRpdGlvbnM6IHsgdHlwZTogJ3N0cmluZycgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGh1bWlkaXR5OiB7IHR5cGU6ICdudW1iZXInIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSksXG4gICAgICAgIH0sXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnQWN0aW9ucyBmb3IgcmV0cmlldmluZyB3ZWF0aGVyIGluZm9ybWF0aW9uJyxcbiAgICAgIH1dLFxuICAgIH0pO1xuXG4gICAgLy8gR3JhbnQgQmVkcm9jayBzZXJ2aWNlIHBlcm1pc3Npb24gdG8gaW52b2tlIExhbWJkYVxuICAgIGFjdGlvbkxhbWJkYS5hZGRQZXJtaXNzaW9uKCdBbGxvd0JlZHJvY2tJbnZva2UnLCB7XG4gICAgICBwcmluY2lwYWw6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnYmVkcm9jay5hbWF6b25hd3MuY29tJyksXG4gICAgICBhY3Rpb246ICdsYW1iZGE6SW52b2tlRnVuY3Rpb24nLFxuICAgICAgc291cmNlQXJuOiBhZ2VudC5hdHRyQWdlbnRBcm4sXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQWdlbnRJZCcsIHtcbiAgICAgIHZhbHVlOiBhZ2VudC5hdHRyQWdlbnRJZCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQWdlbnQgSUQnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FnZW50QXJuJywge1xuICAgICAgdmFsdWU6IGFnZW50LmF0dHJBZ2VudEFybixcbiAgICAgIGRlc2NyaXB0aW9uOiAnQWdlbnQgQVJOJyxcbiAgICB9KTtcbiAgfVxufVxuIl19