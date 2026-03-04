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
exports.ActionGroupsSimpleStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const bedrock = __importStar(require("aws-cdk-lib/aws-bedrock"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
/**
 * Simplified Action Groups Stack
 *
 * This creates the agent and Lambda function.
 * The action group must be added manually via AWS Console because
 * AWS::Bedrock::AgentActionGroup is not yet available in all regions.
 */
class ActionGroupsSimpleStack extends cdk.Stack {
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
exports.ActionGroupsSimpleStack = ActionGroupsSimpleStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiMDItYWN0aW9uLWdyb3Vwcy1zaW1wbGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIwMi1hY3Rpb24tZ3JvdXBzLXNpbXBsZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxpREFBbUM7QUFDbkMsaUVBQW1EO0FBQ25ELHlEQUEyQztBQUMzQywrREFBaUQ7QUFHakQ7Ozs7OztHQU1HO0FBQ0gsTUFBYSx1QkFBd0IsU0FBUSxHQUFHLENBQUMsS0FBSztJQUNwRCxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQXNCO1FBQzlELEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLE1BQU0sU0FBUyxHQUFHLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsV0FBVyxFQUFFO1lBQ2hELFNBQVMsRUFBRSxJQUFJLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQyx1QkFBdUIsQ0FBQztTQUM3RCxDQUFDLENBQUM7UUFFSCxTQUFTLENBQUMsV0FBVyxDQUFDLElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQztZQUM1QyxNQUFNLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxLQUFLO1lBQ3hCLE9BQU8sRUFBRSxDQUFDLHFCQUFxQixDQUFDO1lBQ2hDLFNBQVMsRUFBRSxDQUFDLEdBQUcsQ0FBQztTQUNqQixDQUFDLENBQUMsQ0FBQztRQUVKLE1BQU0sWUFBWSxHQUFHLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsZUFBZSxFQUFFO1lBQzlELE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVc7WUFDbkMsT0FBTyxFQUFFLGVBQWU7WUFDeEIsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0NBaURsQyxDQUFDO1NBQ0csQ0FBQyxDQUFDO1FBRUgsK0JBQStCO1FBQy9CLFlBQVksQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLENBQUM7UUFFcEMsTUFBTSxLQUFLLEdBQUcsSUFBSSxPQUFPLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxjQUFjLEVBQUU7WUFDdkQsU0FBUyxFQUFFLGVBQWU7WUFDMUIsb0JBQW9CLEVBQUUsU0FBUyxDQUFDLE9BQU87WUFDdkMsZUFBZSxFQUFFLHlDQUF5QztZQUMxRCxXQUFXLEVBQUU7MkZBQ3dFO1lBQ3JGLHVCQUF1QixFQUFFLEdBQUc7U0FDN0IsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxTQUFTLEVBQUU7WUFDakMsS0FBSyxFQUFFLEtBQUssQ0FBQyxXQUFXO1lBQ3hCLFdBQVcsRUFBRSxvREFBb0Q7U0FDbEUsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxVQUFVLEVBQUU7WUFDbEMsS0FBSyxFQUFFLEtBQUssQ0FBQyxZQUFZO1NBQzFCLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsV0FBVyxFQUFFO1lBQ25DLEtBQUssRUFBRSxZQUFZLENBQUMsV0FBVztZQUMvQixXQUFXLEVBQUUsZ0RBQWdEO1NBQzlELENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsWUFBWSxFQUFFO1lBQ3BDLEtBQUssRUFBRSxZQUFZLENBQUMsWUFBWTtZQUNoQyxXQUFXLEVBQUUsc0JBQXNCO1NBQ3BDLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsYUFBYSxFQUFFO1lBQ3JDLEtBQUssRUFBRSx3RUFBd0U7WUFDL0UsV0FBVyxFQUFFLDhCQUE4QjtTQUM1QyxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUF6R0QsMERBeUdDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGJlZHJvY2sgZnJvbSAnYXdzLWNkay1saWIvYXdzLWJlZHJvY2snO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5cbi8qKlxuICogU2ltcGxpZmllZCBBY3Rpb24gR3JvdXBzIFN0YWNrXG4gKiBcbiAqIFRoaXMgY3JlYXRlcyB0aGUgYWdlbnQgYW5kIExhbWJkYSBmdW5jdGlvbi5cbiAqIFRoZSBhY3Rpb24gZ3JvdXAgbXVzdCBiZSBhZGRlZCBtYW51YWxseSB2aWEgQVdTIENvbnNvbGUgYmVjYXVzZVxuICogQVdTOjpCZWRyb2NrOjpBZ2VudEFjdGlvbkdyb3VwIGlzIG5vdCB5ZXQgYXZhaWxhYmxlIGluIGFsbCByZWdpb25zLlxuICovXG5leHBvcnQgY2xhc3MgQWN0aW9uR3JvdXBzU2ltcGxlU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wcz86IGNkay5TdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICBjb25zdCBhZ2VudFJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ0FnZW50Um9sZScsIHtcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdiZWRyb2NrLmFtYXpvbmF3cy5jb20nKSxcbiAgICB9KTtcblxuICAgIGFnZW50Um9sZS5hZGRUb1BvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICBhY3Rpb25zOiBbJ2JlZHJvY2s6SW52b2tlTW9kZWwnXSxcbiAgICAgIHJlc291cmNlczogWycqJ10sXG4gICAgfSkpO1xuXG4gICAgY29uc3QgYWN0aW9uTGFtYmRhID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnQWN0aW9uSGFuZGxlcicsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLlBZVEhPTl8zXzEyLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUlubGluZShgXG5pbXBvcnQganNvblxuXG5kZWYgaGFuZGxlcihldmVudCwgY29udGV4dCk6XG4gICAgXCJcIlwiXG4gICAgSGFuZGxlIGFnZW50IGFjdGlvbnMgZm9yIHdlYXRoZXIgcXVlcmllc1xuICAgIFwiXCJcIlxuICAgIHByaW50KGZcIlJlY2VpdmVkIGV2ZW50OiB7anNvbi5kdW1wcyhldmVudCl9XCIpXG4gICAgXG4gICAgYWN0aW9uID0gZXZlbnQuZ2V0KCdhY3Rpb25Hcm91cCcpXG4gICAgYXBpX3BhdGggPSBldmVudC5nZXQoJ2FwaVBhdGgnKVxuICAgIFxuICAgIGlmIGFwaV9wYXRoID09ICcvZ2V0LXdlYXRoZXInOlxuICAgICAgICBwYXJhbWV0ZXJzID0gZXZlbnQuZ2V0KCdwYXJhbWV0ZXJzJywgW10pXG4gICAgICAgIGxvY2F0aW9uID0gbmV4dCgocFsndmFsdWUnXSBmb3IgcCBpbiBwYXJhbWV0ZXJzIGlmIHBbJ25hbWUnXSA9PSAnbG9jYXRpb24nKSwgJ1Vua25vd24nKVxuICAgICAgICBcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICdtZXNzYWdlVmVyc2lvbic6ICcxLjAnLFxuICAgICAgICAgICAgJ3Jlc3BvbnNlJzoge1xuICAgICAgICAgICAgICAgICdhY3Rpb25Hcm91cCc6IGFjdGlvbixcbiAgICAgICAgICAgICAgICAnYXBpUGF0aCc6IGFwaV9wYXRoLFxuICAgICAgICAgICAgICAgICdodHRwTWV0aG9kJzogZXZlbnQuZ2V0KCdodHRwTWV0aG9kJyksXG4gICAgICAgICAgICAgICAgJ2h0dHBTdGF0dXNDb2RlJzogMjAwLFxuICAgICAgICAgICAgICAgICdyZXNwb25zZUJvZHknOiB7XG4gICAgICAgICAgICAgICAgICAgICdhcHBsaWNhdGlvbi9qc29uJzoge1xuICAgICAgICAgICAgICAgICAgICAgICAgJ2JvZHknOiBqc29uLmR1bXBzKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAnbG9jYXRpb24nOiBsb2NhdGlvbixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAndGVtcGVyYXR1cmUnOiA3MixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAnY29uZGl0aW9ucyc6ICdTdW5ueScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJ2h1bWlkaXR5JzogNDVcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgICAnbWVzc2FnZVZlcnNpb24nOiAnMS4wJyxcbiAgICAgICAgJ3Jlc3BvbnNlJzoge1xuICAgICAgICAgICAgJ2FjdGlvbkdyb3VwJzogYWN0aW9uLFxuICAgICAgICAgICAgJ2FwaVBhdGgnOiBhcGlfcGF0aCxcbiAgICAgICAgICAgICdodHRwU3RhdHVzQ29kZSc6IDQwNCxcbiAgICAgICAgICAgICdyZXNwb25zZUJvZHknOiB7XG4gICAgICAgICAgICAgICAgJ2FwcGxpY2F0aW9uL2pzb24nOiB7XG4gICAgICAgICAgICAgICAgICAgICdib2R5JzoganNvbi5kdW1wcyh7J2Vycm9yJzogJ1Vua25vd24gYWN0aW9uJ30pXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuYCksXG4gICAgfSk7XG5cbiAgICAvLyBBbGxvdyBhZ2VudCB0byBpbnZva2UgTGFtYmRhXG4gICAgYWN0aW9uTGFtYmRhLmdyYW50SW52b2tlKGFnZW50Um9sZSk7XG5cbiAgICBjb25zdCBhZ2VudCA9IG5ldyBiZWRyb2NrLkNmbkFnZW50KHRoaXMsICdXZWF0aGVyQWdlbnQnLCB7XG4gICAgICBhZ2VudE5hbWU6ICd3ZWF0aGVyLWFnZW50JyxcbiAgICAgIGFnZW50UmVzb3VyY2VSb2xlQXJuOiBhZ2VudFJvbGUucm9sZUFybixcbiAgICAgIGZvdW5kYXRpb25Nb2RlbDogJ2FudGhyb3BpYy5jbGF1ZGUtMy1zb25uZXQtMjAyNDAyMjktdjE6MCcsXG4gICAgICBpbnN0cnVjdGlvbjogYFlvdSBhcmUgYSBoZWxwZnVsIHdlYXRoZXIgYXNzaXN0YW50LiBZb3UgY2FuIHByb3ZpZGUgd2VhdGhlciBpbmZvcm1hdGlvbiBmb3IgYW55IGxvY2F0aW9uLlxuICAgICAgV2hlbiBhc2tlZCBhYm91dCB3ZWF0aGVyLCB1c2UgdGhlIGdldC13ZWF0aGVyIGFjdGlvbiB0byByZXRyaWV2ZSBjdXJyZW50IGNvbmRpdGlvbnMuYCxcbiAgICAgIGlkbGVTZXNzaW9uVHRsSW5TZWNvbmRzOiA2MDAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQWdlbnRJZCcsIHtcbiAgICAgIHZhbHVlOiBhZ2VudC5hdHRyQWdlbnRJZCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQWdlbnQgSUQgLSB1c2UgdGhpcyB0byBhZGQgYWN0aW9uIGdyb3VwIGluIGNvbnNvbGUnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FnZW50QXJuJywge1xuICAgICAgdmFsdWU6IGFnZW50LmF0dHJBZ2VudEFybixcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdMYW1iZGFBcm4nLCB7XG4gICAgICB2YWx1ZTogYWN0aW9uTGFtYmRhLmZ1bmN0aW9uQXJuLFxuICAgICAgZGVzY3JpcHRpb246ICdMYW1iZGEgQVJOIC0gdXNlIHRoaXMgd2hlbiBhZGRpbmcgYWN0aW9uIGdyb3VwJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdMYW1iZGFOYW1lJywge1xuICAgICAgdmFsdWU6IGFjdGlvbkxhbWJkYS5mdW5jdGlvbk5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ0xhbWJkYSBmdW5jdGlvbiBuYW1lJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdNYW51YWxTdGVwcycsIHtcbiAgICAgIHZhbHVlOiAnR28gdG8gQVdTIENvbnNvbGUgPiBCZWRyb2NrID4gQWdlbnRzID4gU2VsZWN0IGFnZW50ID4gQWRkIGFjdGlvbiBncm91cCcsXG4gICAgICBkZXNjcmlwdGlvbjogJ05leHQgc3RlcHMgdG8gY29tcGxldGUgc2V0dXAnLFxuICAgIH0pO1xuICB9XG59XG4iXX0=