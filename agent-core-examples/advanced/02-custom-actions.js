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
exports.CustomActionsStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const bedrock = __importStar(require("aws-cdk-lib/aws-bedrock"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
class CustomActionsStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const taskTable = new dynamodb.Table(this, 'TaskTable', {
            partitionKey: { name: 'taskId', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        const actionLambda = new lambda.Function(this, 'CustomActionHandler', {
            runtime: lambda.Runtime.PYTHON_3_12,
            handler: 'index.handler',
            timeout: cdk.Duration.seconds(30),
            code: lambda.Code.fromInline(`
import json
import boto3
import uuid
from datetime import datetime

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('${taskTable.tableName}')

def handler(event, context):
    """
    Handle complex custom actions for the agent
    """
    action = event.get('actionGroup')
    api_path = event.get('apiPath')
    parameters = event.get('parameters', [])
    
    def get_param(name):
        return next((p['value'] for p in parameters if p['name'] == name), None)
    
    try:
        if api_path == '/create-task':
            task_id = str(uuid.uuid4())
            title = get_param('title')
            description = get_param('description')
            priority = get_param('priority') or 'medium'
            
            table.put_item(Item={
                'taskId': task_id,
                'title': title,
                'description': description,
                'priority': priority,
                'status': 'pending',
                'createdAt': datetime.utcnow().isoformat(),
            })
            
            return success_response(action, api_path, {
                'taskId': task_id,
                'message': f'Task created successfully with ID: {task_id}'
            })
        
        elif api_path == '/list-tasks':
            status_filter = get_param('status')
            
            if status_filter:
                response = table.scan(
                    FilterExpression='#status = :status',
                    ExpressionAttributeNames={'#status': 'status'},
                    ExpressionAttributeValues={':status': status_filter}
                )
            else:
                response = table.scan()
            
            tasks = response.get('Items', [])
            
            return success_response(action, api_path, {
                'tasks': tasks,
                'count': len(tasks)
            })
        
        elif api_path == '/update-task':
            task_id = get_param('taskId')
            status = get_param('status')
            
            table.update_item(
                Key={'taskId': task_id},
                UpdateExpression='SET #status = :status, updatedAt = :updatedAt',
                ExpressionAttributeNames={'#status': 'status'},
                ExpressionAttributeValues={
                    ':status': status,
                    ':updatedAt': datetime.utcnow().isoformat()
                }
            )
            
            return success_response(action, api_path, {
                'taskId': task_id,
                'message': f'Task updated to status: {status}'
            })
        
        elif api_path == '/delete-task':
            task_id = get_param('taskId')
            
            table.delete_item(Key={'taskId': task_id})
            
            return success_response(action, api_path, {
                'taskId': task_id,
                'message': 'Task deleted successfully'
            })
        
        elif api_path == '/analyze-tasks':
            response = table.scan()
            tasks = response.get('Items', [])
            
            status_counts = {}
            priority_counts = {}
            
            for task in tasks:
                status = task.get('status', 'unknown')
                priority = task.get('priority', 'unknown')
                
                status_counts[status] = status_counts.get(status, 0) + 1
                priority_counts[priority] = priority_counts.get(priority, 0) + 1
            
            return success_response(action, api_path, {
                'totalTasks': len(tasks),
                'statusBreakdown': status_counts,
                'priorityBreakdown': priority_counts
            })
        
        else:
            return error_response(action, api_path, 404, 'Action not found')
    
    except Exception as e:
        return error_response(action, api_path, 500, str(e))

def success_response(action, api_path, data):
    return {
        'messageVersion': '1.0',
        'response': {
            'actionGroup': action,
            'apiPath': api_path,
            'httpStatusCode': 200,
            'responseBody': {
                'application/json': {
                    'body': json.dumps(data)
                }
            }
        }
    }

def error_response(action, api_path, status_code, error_message):
    return {
        'messageVersion': '1.0',
        'response': {
            'actionGroup': action,
            'apiPath': api_path,
            'httpStatusCode': status_code,
            'responseBody': {
                'application/json': {
                    'body': json.dumps({'error': error_message})
                }
            }
        }
    }
      `),
            environment: {
                TASK_TABLE_NAME: taskTable.tableName,
            },
        });
        taskTable.grantReadWriteData(actionLambda);
        const agentRole = new iam.Role(this, 'AgentRole', {
            assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
        });
        agentRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['bedrock:InvokeModel'],
            resources: ['*'],
        }));
        actionLambda.grantInvoke(agentRole);
        const agent = new bedrock.CfnAgent(this, 'TaskManagerAgent', {
            agentName: 'task-manager-agent',
            agentResourceRoleArn: agentRole.roleArn,
            foundationModel: 'anthropic.claude-3-sonnet-20240229-v1:0',
            instruction: `You are a task management assistant. You can help users:
      - Create new tasks with titles, descriptions, and priorities
      - List all tasks or filter by status
      - Update task status (pending, in-progress, completed)
      - Delete tasks
      - Analyze task statistics
      
      Be helpful and provide clear confirmations when tasks are created or modified.`,
        });
        const apiSchema = {
            openapi: '3.0.0',
            info: {
                title: 'Task Management API',
                version: '1.0.0',
            },
            paths: {
                '/create-task': {
                    post: {
                        summary: 'Create a new task',
                        operationId: 'createTask',
                        parameters: [
                            {
                                name: 'title',
                                in: 'query',
                                required: true,
                                schema: { type: 'string' },
                            },
                            {
                                name: 'description',
                                in: 'query',
                                required: true,
                                schema: { type: 'string' },
                            },
                            {
                                name: 'priority',
                                in: 'query',
                                schema: { type: 'string', enum: ['low', 'medium', 'high'] },
                            },
                        ],
                        responses: {
                            '200': { description: 'Task created' },
                        },
                    },
                },
                '/list-tasks': {
                    get: {
                        summary: 'List all tasks',
                        operationId: 'listTasks',
                        parameters: [
                            {
                                name: 'status',
                                in: 'query',
                                schema: { type: 'string', enum: ['pending', 'in-progress', 'completed'] },
                            },
                        ],
                        responses: {
                            '200': { description: 'List of tasks' },
                        },
                    },
                },
                '/update-task': {
                    put: {
                        summary: 'Update task status',
                        operationId: 'updateTask',
                        parameters: [
                            {
                                name: 'taskId',
                                in: 'query',
                                required: true,
                                schema: { type: 'string' },
                            },
                            {
                                name: 'status',
                                in: 'query',
                                required: true,
                                schema: { type: 'string', enum: ['pending', 'in-progress', 'completed'] },
                            },
                        ],
                        responses: {
                            '200': { description: 'Task updated' },
                        },
                    },
                },
                '/delete-task': {
                    delete: {
                        summary: 'Delete a task',
                        operationId: 'deleteTask',
                        parameters: [
                            {
                                name: 'taskId',
                                in: 'query',
                                required: true,
                                schema: { type: 'string' },
                            },
                        ],
                        responses: {
                            '200': { description: 'Task deleted' },
                        },
                    },
                },
                '/analyze-tasks': {
                    get: {
                        summary: 'Get task analytics',
                        operationId: 'analyzeTasks',
                        responses: {
                            '200': { description: 'Task statistics' },
                        },
                    },
                },
            },
        };
        new cdk.CfnResource(this, 'TaskActions', {
            type: 'AWS::Bedrock::AgentActionGroup',
            properties: {
                AgentId: agent.attrAgentId,
                AgentVersion: 'DRAFT',
                ActionGroupName: 'task-management',
                ActionGroupExecutor: {
                    Lambda: actionLambda.functionArn,
                },
                ApiSchema: {
                    Payload: JSON.stringify(apiSchema),
                },
            },
        });
        new cdk.CfnOutput(this, 'AgentId', {
            value: agent.attrAgentId,
        });
        new cdk.CfnOutput(this, 'TaskTableName', {
            value: taskTable.tableName,
        });
    }
}
exports.CustomActionsStack = CustomActionsStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiMDItY3VzdG9tLWFjdGlvbnMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIwMi1jdXN0b20tYWN0aW9ucy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxpREFBbUM7QUFDbkMsaUVBQW1EO0FBQ25ELHlEQUEyQztBQUMzQywrREFBaUQ7QUFDakQsbUVBQXFEO0FBR3JELE1BQWEsa0JBQW1CLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDL0MsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFzQjtRQUM5RCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixNQUFNLFNBQVMsR0FBRyxJQUFJLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLFdBQVcsRUFBRTtZQUN0RCxZQUFZLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRTtZQUNyRSxXQUFXLEVBQUUsUUFBUSxDQUFDLFdBQVcsQ0FBQyxlQUFlO1lBQ2pELGFBQWEsRUFBRSxHQUFHLENBQUMsYUFBYSxDQUFDLE9BQU87U0FDekMsQ0FBQyxDQUFDO1FBRUgsTUFBTSxZQUFZLEdBQUcsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxxQkFBcUIsRUFBRTtZQUNwRSxPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXO1lBQ25DLE9BQU8sRUFBRSxlQUFlO1lBQ3hCLE9BQU8sRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7WUFDakMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDOzs7Ozs7OzBCQU9ULFNBQVMsQ0FBQyxTQUFTOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7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VyxDQUFDLElBQUksRUFBRSxhQUFhLEVBQUU7WUFDdkMsSUFBSSxFQUFFLGdDQUFnQztZQUN0QyxVQUFVLEVBQUU7Z0JBQ1YsT0FBTyxFQUFFLEtBQUssQ0FBQyxXQUFXO2dCQUMxQixZQUFZLEVBQUUsT0FBTztnQkFDckIsZUFBZSxFQUFFLGlCQUFpQjtnQkFDbEMsbUJBQW1CLEVBQUU7b0JBQ25CLE1BQU0sRUFBRSxZQUFZLENBQUMsV0FBVztpQkFDakM7Z0JBQ0QsU0FBUyxFQUFFO29CQUNULE9BQU8sRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQztpQkFDbkM7YUFDRjtTQUNGLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsU0FBUyxFQUFFO1lBQ2pDLEtBQUssRUFBRSxLQUFLLENBQUMsV0FBVztTQUN6QixDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGVBQWUsRUFBRTtZQUN2QyxLQUFLLEVBQUUsU0FBUyxDQUFDLFNBQVM7U0FDM0IsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBOVRELGdEQThUQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBiZWRyb2NrIGZyb20gJ2F3cy1jZGstbGliL2F3cy1iZWRyb2NrJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcbmltcG9ydCAqIGFzIGR5bmFtb2RiIGZyb20gJ2F3cy1jZGstbGliL2F3cy1keW5hbW9kYic7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcblxuZXhwb3J0IGNsYXNzIEN1c3RvbUFjdGlvbnNTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzPzogY2RrLlN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIGNvbnN0IHRhc2tUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnVGFza1RhYmxlJywge1xuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICd0YXNrSWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG5cbiAgICBjb25zdCBhY3Rpb25MYW1iZGEgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdDdXN0b21BY3Rpb25IYW5kbGVyJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfMTIsXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tSW5saW5lKGBcbmltcG9ydCBqc29uXG5pbXBvcnQgYm90bzNcbmltcG9ydCB1dWlkXG5mcm9tIGRhdGV0aW1lIGltcG9ydCBkYXRldGltZVxuXG5keW5hbW9kYiA9IGJvdG8zLnJlc291cmNlKCdkeW5hbW9kYicpXG50YWJsZSA9IGR5bmFtb2RiLlRhYmxlKCcke3Rhc2tUYWJsZS50YWJsZU5hbWV9JylcblxuZGVmIGhhbmRsZXIoZXZlbnQsIGNvbnRleHQpOlxuICAgIFwiXCJcIlxuICAgIEhhbmRsZSBjb21wbGV4IGN1c3RvbSBhY3Rpb25zIGZvciB0aGUgYWdlbnRcbiAgICBcIlwiXCJcbiAgICBhY3Rpb24gPSBldmVudC5nZXQoJ2FjdGlvbkdyb3VwJylcbiAgICBhcGlfcGF0aCA9IGV2ZW50LmdldCgnYXBpUGF0aCcpXG4gICAgcGFyYW1ldGVycyA9IGV2ZW50LmdldCgncGFyYW1ldGVycycsIFtdKVxuICAgIFxuICAgIGRlZiBnZXRfcGFyYW0obmFtZSk6XG4gICAgICAgIHJldHVybiBuZXh0KChwWyd2YWx1ZSddIGZvciBwIGluIHBhcmFtZXRlcnMgaWYgcFsnbmFtZSddID09IG5hbWUpLCBOb25lKVxuICAgIFxuICAgIHRyeTpcbiAgICAgICAgaWYgYXBpX3BhdGggPT0gJy9jcmVhdGUtdGFzayc6XG4gICAgICAgICAgICB0YXNrX2lkID0gc3RyKHV1aWQudXVpZDQoKSlcbiAgICAgICAgICAgIHRpdGxlID0gZ2V0X3BhcmFtKCd0aXRsZScpXG4gICAgICAgICAgICBkZXNjcmlwdGlvbiA9IGdldF9wYXJhbSgnZGVzY3JpcHRpb24nKVxuICAgICAgICAgICAgcHJpb3JpdHkgPSBnZXRfcGFyYW0oJ3ByaW9yaXR5Jykgb3IgJ21lZGl1bSdcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgdGFibGUucHV0X2l0ZW0oSXRlbT17XG4gICAgICAgICAgICAgICAgJ3Rhc2tJZCc6IHRhc2tfaWQsXG4gICAgICAgICAgICAgICAgJ3RpdGxlJzogdGl0bGUsXG4gICAgICAgICAgICAgICAgJ2Rlc2NyaXB0aW9uJzogZGVzY3JpcHRpb24sXG4gICAgICAgICAgICAgICAgJ3ByaW9yaXR5JzogcHJpb3JpdHksXG4gICAgICAgICAgICAgICAgJ3N0YXR1cyc6ICdwZW5kaW5nJyxcbiAgICAgICAgICAgICAgICAnY3JlYXRlZEF0JzogZGF0ZXRpbWUudXRjbm93KCkuaXNvZm9ybWF0KCksXG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgXG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc19yZXNwb25zZShhY3Rpb24sIGFwaV9wYXRoLCB7XG4gICAgICAgICAgICAgICAgJ3Rhc2tJZCc6IHRhc2tfaWQsXG4gICAgICAgICAgICAgICAgJ21lc3NhZ2UnOiBmJ1Rhc2sgY3JlYXRlZCBzdWNjZXNzZnVsbHkgd2l0aCBJRDoge3Rhc2tfaWR9J1xuICAgICAgICAgICAgfSlcbiAgICAgICAgXG4gICAgICAgIGVsaWYgYXBpX3BhdGggPT0gJy9saXN0LXRhc2tzJzpcbiAgICAgICAgICAgIHN0YXR1c19maWx0ZXIgPSBnZXRfcGFyYW0oJ3N0YXR1cycpXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmIHN0YXR1c19maWx0ZXI6XG4gICAgICAgICAgICAgICAgcmVzcG9uc2UgPSB0YWJsZS5zY2FuKFxuICAgICAgICAgICAgICAgICAgICBGaWx0ZXJFeHByZXNzaW9uPScjc3RhdHVzID0gOnN0YXR1cycsXG4gICAgICAgICAgICAgICAgICAgIEV4cHJlc3Npb25BdHRyaWJ1dGVOYW1lcz17JyNzdGF0dXMnOiAnc3RhdHVzJ30sXG4gICAgICAgICAgICAgICAgICAgIEV4cHJlc3Npb25BdHRyaWJ1dGVWYWx1ZXM9eyc6c3RhdHVzJzogc3RhdHVzX2ZpbHRlcn1cbiAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICBlbHNlOlxuICAgICAgICAgICAgICAgIHJlc3BvbnNlID0gdGFibGUuc2NhbigpXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHRhc2tzID0gcmVzcG9uc2UuZ2V0KCdJdGVtcycsIFtdKVxuICAgICAgICAgICAgXG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc19yZXNwb25zZShhY3Rpb24sIGFwaV9wYXRoLCB7XG4gICAgICAgICAgICAgICAgJ3Rhc2tzJzogdGFza3MsXG4gICAgICAgICAgICAgICAgJ2NvdW50JzogbGVuKHRhc2tzKVxuICAgICAgICAgICAgfSlcbiAgICAgICAgXG4gICAgICAgIGVsaWYgYXBpX3BhdGggPT0gJy91cGRhdGUtdGFzayc6XG4gICAgICAgICAgICB0YXNrX2lkID0gZ2V0X3BhcmFtKCd0YXNrSWQnKVxuICAgICAgICAgICAgc3RhdHVzID0gZ2V0X3BhcmFtKCdzdGF0dXMnKVxuICAgICAgICAgICAgXG4gICAgICAgICAgICB0YWJsZS51cGRhdGVfaXRlbShcbiAgICAgICAgICAgICAgICBLZXk9eyd0YXNrSWQnOiB0YXNrX2lkfSxcbiAgICAgICAgICAgICAgICBVcGRhdGVFeHByZXNzaW9uPSdTRVQgI3N0YXR1cyA9IDpzdGF0dXMsIHVwZGF0ZWRBdCA9IDp1cGRhdGVkQXQnLFxuICAgICAgICAgICAgICAgIEV4cHJlc3Npb25BdHRyaWJ1dGVOYW1lcz17JyNzdGF0dXMnOiAnc3RhdHVzJ30sXG4gICAgICAgICAgICAgICAgRXhwcmVzc2lvbkF0dHJpYnV0ZVZhbHVlcz17XG4gICAgICAgICAgICAgICAgICAgICc6c3RhdHVzJzogc3RhdHVzLFxuICAgICAgICAgICAgICAgICAgICAnOnVwZGF0ZWRBdCc6IGRhdGV0aW1lLnV0Y25vdygpLmlzb2Zvcm1hdCgpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgKVxuICAgICAgICAgICAgXG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc19yZXNwb25zZShhY3Rpb24sIGFwaV9wYXRoLCB7XG4gICAgICAgICAgICAgICAgJ3Rhc2tJZCc6IHRhc2tfaWQsXG4gICAgICAgICAgICAgICAgJ21lc3NhZ2UnOiBmJ1Rhc2sgdXBkYXRlZCB0byBzdGF0dXM6IHtzdGF0dXN9J1xuICAgICAgICAgICAgfSlcbiAgICAgICAgXG4gICAgICAgIGVsaWYgYXBpX3BhdGggPT0gJy9kZWxldGUtdGFzayc6XG4gICAgICAgICAgICB0YXNrX2lkID0gZ2V0X3BhcmFtKCd0YXNrSWQnKVxuICAgICAgICAgICAgXG4gICAgICAgICAgICB0YWJsZS5kZWxldGVfaXRlbShLZXk9eyd0YXNrSWQnOiB0YXNrX2lkfSlcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NfcmVzcG9uc2UoYWN0aW9uLCBhcGlfcGF0aCwge1xuICAgICAgICAgICAgICAgICd0YXNrSWQnOiB0YXNrX2lkLFxuICAgICAgICAgICAgICAgICdtZXNzYWdlJzogJ1Rhc2sgZGVsZXRlZCBzdWNjZXNzZnVsbHknXG4gICAgICAgICAgICB9KVxuICAgICAgICBcbiAgICAgICAgZWxpZiBhcGlfcGF0aCA9PSAnL2FuYWx5emUtdGFza3MnOlxuICAgICAgICAgICAgcmVzcG9uc2UgPSB0YWJsZS5zY2FuKClcbiAgICAgICAgICAgIHRhc2tzID0gcmVzcG9uc2UuZ2V0KCdJdGVtcycsIFtdKVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBzdGF0dXNfY291bnRzID0ge31cbiAgICAgICAgICAgIHByaW9yaXR5X2NvdW50cyA9IHt9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGZvciB0YXNrIGluIHRhc2tzOlxuICAgICAgICAgICAgICAgIHN0YXR1cyA9IHRhc2suZ2V0KCdzdGF0dXMnLCAndW5rbm93bicpXG4gICAgICAgICAgICAgICAgcHJpb3JpdHkgPSB0YXNrLmdldCgncHJpb3JpdHknLCAndW5rbm93bicpXG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgc3RhdHVzX2NvdW50c1tzdGF0dXNdID0gc3RhdHVzX2NvdW50cy5nZXQoc3RhdHVzLCAwKSArIDFcbiAgICAgICAgICAgICAgICBwcmlvcml0eV9jb3VudHNbcHJpb3JpdHldID0gcHJpb3JpdHlfY291bnRzLmdldChwcmlvcml0eSwgMCkgKyAxXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzX3Jlc3BvbnNlKGFjdGlvbiwgYXBpX3BhdGgsIHtcbiAgICAgICAgICAgICAgICAndG90YWxUYXNrcyc6IGxlbih0YXNrcyksXG4gICAgICAgICAgICAgICAgJ3N0YXR1c0JyZWFrZG93bic6IHN0YXR1c19jb3VudHMsXG4gICAgICAgICAgICAgICAgJ3ByaW9yaXR5QnJlYWtkb3duJzogcHJpb3JpdHlfY291bnRzXG4gICAgICAgICAgICB9KVxuICAgICAgICBcbiAgICAgICAgZWxzZTpcbiAgICAgICAgICAgIHJldHVybiBlcnJvcl9yZXNwb25zZShhY3Rpb24sIGFwaV9wYXRoLCA0MDQsICdBY3Rpb24gbm90IGZvdW5kJylcbiAgICBcbiAgICBleGNlcHQgRXhjZXB0aW9uIGFzIGU6XG4gICAgICAgIHJldHVybiBlcnJvcl9yZXNwb25zZShhY3Rpb24sIGFwaV9wYXRoLCA1MDAsIHN0cihlKSlcblxuZGVmIHN1Y2Nlc3NfcmVzcG9uc2UoYWN0aW9uLCBhcGlfcGF0aCwgZGF0YSk6XG4gICAgcmV0dXJuIHtcbiAgICAgICAgJ21lc3NhZ2VWZXJzaW9uJzogJzEuMCcsXG4gICAgICAgICdyZXNwb25zZSc6IHtcbiAgICAgICAgICAgICdhY3Rpb25Hcm91cCc6IGFjdGlvbixcbiAgICAgICAgICAgICdhcGlQYXRoJzogYXBpX3BhdGgsXG4gICAgICAgICAgICAnaHR0cFN0YXR1c0NvZGUnOiAyMDAsXG4gICAgICAgICAgICAncmVzcG9uc2VCb2R5Jzoge1xuICAgICAgICAgICAgICAgICdhcHBsaWNhdGlvbi9qc29uJzoge1xuICAgICAgICAgICAgICAgICAgICAnYm9keSc6IGpzb24uZHVtcHMoZGF0YSlcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbmRlZiBlcnJvcl9yZXNwb25zZShhY3Rpb24sIGFwaV9wYXRoLCBzdGF0dXNfY29kZSwgZXJyb3JfbWVzc2FnZSk6XG4gICAgcmV0dXJuIHtcbiAgICAgICAgJ21lc3NhZ2VWZXJzaW9uJzogJzEuMCcsXG4gICAgICAgICdyZXNwb25zZSc6IHtcbiAgICAgICAgICAgICdhY3Rpb25Hcm91cCc6IGFjdGlvbixcbiAgICAgICAgICAgICdhcGlQYXRoJzogYXBpX3BhdGgsXG4gICAgICAgICAgICAnaHR0cFN0YXR1c0NvZGUnOiBzdGF0dXNfY29kZSxcbiAgICAgICAgICAgICdyZXNwb25zZUJvZHknOiB7XG4gICAgICAgICAgICAgICAgJ2FwcGxpY2F0aW9uL2pzb24nOiB7XG4gICAgICAgICAgICAgICAgICAgICdib2R5JzoganNvbi5kdW1wcyh7J2Vycm9yJzogZXJyb3JfbWVzc2FnZX0pXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgICAgYCksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBUQVNLX1RBQkxFX05BTUU6IHRhc2tUYWJsZS50YWJsZU5hbWUsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgdGFza1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShhY3Rpb25MYW1iZGEpO1xuXG4gICAgY29uc3QgYWdlbnRSb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsICdBZ2VudFJvbGUnLCB7XG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnYmVkcm9jay5hbWF6b25hd3MuY29tJyksXG4gICAgfSk7XG5cbiAgICBhZ2VudFJvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogWydiZWRyb2NrOkludm9rZU1vZGVsJ10sXG4gICAgICByZXNvdXJjZXM6IFsnKiddLFxuICAgIH0pKTtcblxuICAgIGFjdGlvbkxhbWJkYS5ncmFudEludm9rZShhZ2VudFJvbGUpO1xuXG4gICAgY29uc3QgYWdlbnQgPSBuZXcgYmVkcm9jay5DZm5BZ2VudCh0aGlzLCAnVGFza01hbmFnZXJBZ2VudCcsIHtcbiAgICAgIGFnZW50TmFtZTogJ3Rhc2stbWFuYWdlci1hZ2VudCcsXG4gICAgICBhZ2VudFJlc291cmNlUm9sZUFybjogYWdlbnRSb2xlLnJvbGVBcm4sXG4gICAgICBmb3VuZGF0aW9uTW9kZWw6ICdhbnRocm9waWMuY2xhdWRlLTMtc29ubmV0LTIwMjQwMjI5LXYxOjAnLFxuICAgICAgaW5zdHJ1Y3Rpb246IGBZb3UgYXJlIGEgdGFzayBtYW5hZ2VtZW50IGFzc2lzdGFudC4gWW91IGNhbiBoZWxwIHVzZXJzOlxuICAgICAgLSBDcmVhdGUgbmV3IHRhc2tzIHdpdGggdGl0bGVzLCBkZXNjcmlwdGlvbnMsIGFuZCBwcmlvcml0aWVzXG4gICAgICAtIExpc3QgYWxsIHRhc2tzIG9yIGZpbHRlciBieSBzdGF0dXNcbiAgICAgIC0gVXBkYXRlIHRhc2sgc3RhdHVzIChwZW5kaW5nLCBpbi1wcm9ncmVzcywgY29tcGxldGVkKVxuICAgICAgLSBEZWxldGUgdGFza3NcbiAgICAgIC0gQW5hbHl6ZSB0YXNrIHN0YXRpc3RpY3NcbiAgICAgIFxuICAgICAgQmUgaGVscGZ1bCBhbmQgcHJvdmlkZSBjbGVhciBjb25maXJtYXRpb25zIHdoZW4gdGFza3MgYXJlIGNyZWF0ZWQgb3IgbW9kaWZpZWQuYCxcbiAgICB9KTtcblxuICAgIGNvbnN0IGFwaVNjaGVtYSA9IHtcbiAgICAgIG9wZW5hcGk6ICczLjAuMCcsXG4gICAgICBpbmZvOiB7XG4gICAgICAgIHRpdGxlOiAnVGFzayBNYW5hZ2VtZW50IEFQSScsXG4gICAgICAgIHZlcnNpb246ICcxLjAuMCcsXG4gICAgICB9LFxuICAgICAgcGF0aHM6IHtcbiAgICAgICAgJy9jcmVhdGUtdGFzayc6IHtcbiAgICAgICAgICBwb3N0OiB7XG4gICAgICAgICAgICBzdW1tYXJ5OiAnQ3JlYXRlIGEgbmV3IHRhc2snLFxuICAgICAgICAgICAgb3BlcmF0aW9uSWQ6ICdjcmVhdGVUYXNrJyxcbiAgICAgICAgICAgIHBhcmFtZXRlcnM6IFtcbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIG5hbWU6ICd0aXRsZScsXG4gICAgICAgICAgICAgICAgaW46ICdxdWVyeScsXG4gICAgICAgICAgICAgICAgcmVxdWlyZWQ6IHRydWUsXG4gICAgICAgICAgICAgICAgc2NoZW1hOiB7IHR5cGU6ICdzdHJpbmcnIH0sXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnZGVzY3JpcHRpb24nLFxuICAgICAgICAgICAgICAgIGluOiAncXVlcnknLFxuICAgICAgICAgICAgICAgIHJlcXVpcmVkOiB0cnVlLFxuICAgICAgICAgICAgICAgIHNjaGVtYTogeyB0eXBlOiAnc3RyaW5nJyB9LFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ3ByaW9yaXR5JyxcbiAgICAgICAgICAgICAgICBpbjogJ3F1ZXJ5JyxcbiAgICAgICAgICAgICAgICBzY2hlbWE6IHsgdHlwZTogJ3N0cmluZycsIGVudW06IFsnbG93JywgJ21lZGl1bScsICdoaWdoJ10gfSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICByZXNwb25zZXM6IHtcbiAgICAgICAgICAgICAgJzIwMCc6IHsgZGVzY3JpcHRpb246ICdUYXNrIGNyZWF0ZWQnIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgICcvbGlzdC10YXNrcyc6IHtcbiAgICAgICAgICBnZXQ6IHtcbiAgICAgICAgICAgIHN1bW1hcnk6ICdMaXN0IGFsbCB0YXNrcycsXG4gICAgICAgICAgICBvcGVyYXRpb25JZDogJ2xpc3RUYXNrcycsXG4gICAgICAgICAgICBwYXJhbWV0ZXJzOiBbXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnc3RhdHVzJyxcbiAgICAgICAgICAgICAgICBpbjogJ3F1ZXJ5JyxcbiAgICAgICAgICAgICAgICBzY2hlbWE6IHsgdHlwZTogJ3N0cmluZycsIGVudW06IFsncGVuZGluZycsICdpbi1wcm9ncmVzcycsICdjb21wbGV0ZWQnXSB9LFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIHJlc3BvbnNlczoge1xuICAgICAgICAgICAgICAnMjAwJzogeyBkZXNjcmlwdGlvbjogJ0xpc3Qgb2YgdGFza3MnIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgICcvdXBkYXRlLXRhc2snOiB7XG4gICAgICAgICAgcHV0OiB7XG4gICAgICAgICAgICBzdW1tYXJ5OiAnVXBkYXRlIHRhc2sgc3RhdHVzJyxcbiAgICAgICAgICAgIG9wZXJhdGlvbklkOiAndXBkYXRlVGFzaycsXG4gICAgICAgICAgICBwYXJhbWV0ZXJzOiBbXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAndGFza0lkJyxcbiAgICAgICAgICAgICAgICBpbjogJ3F1ZXJ5JyxcbiAgICAgICAgICAgICAgICByZXF1aXJlZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICBzY2hlbWE6IHsgdHlwZTogJ3N0cmluZycgfSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdzdGF0dXMnLFxuICAgICAgICAgICAgICAgIGluOiAncXVlcnknLFxuICAgICAgICAgICAgICAgIHJlcXVpcmVkOiB0cnVlLFxuICAgICAgICAgICAgICAgIHNjaGVtYTogeyB0eXBlOiAnc3RyaW5nJywgZW51bTogWydwZW5kaW5nJywgJ2luLXByb2dyZXNzJywgJ2NvbXBsZXRlZCddIH0sXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBdLFxuICAgICAgICAgICAgcmVzcG9uc2VzOiB7XG4gICAgICAgICAgICAgICcyMDAnOiB7IGRlc2NyaXB0aW9uOiAnVGFzayB1cGRhdGVkJyB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICAnL2RlbGV0ZS10YXNrJzoge1xuICAgICAgICAgIGRlbGV0ZToge1xuICAgICAgICAgICAgc3VtbWFyeTogJ0RlbGV0ZSBhIHRhc2snLFxuICAgICAgICAgICAgb3BlcmF0aW9uSWQ6ICdkZWxldGVUYXNrJyxcbiAgICAgICAgICAgIHBhcmFtZXRlcnM6IFtcbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIG5hbWU6ICd0YXNrSWQnLFxuICAgICAgICAgICAgICAgIGluOiAncXVlcnknLFxuICAgICAgICAgICAgICAgIHJlcXVpcmVkOiB0cnVlLFxuICAgICAgICAgICAgICAgIHNjaGVtYTogeyB0eXBlOiAnc3RyaW5nJyB9LFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIHJlc3BvbnNlczoge1xuICAgICAgICAgICAgICAnMjAwJzogeyBkZXNjcmlwdGlvbjogJ1Rhc2sgZGVsZXRlZCcgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgJy9hbmFseXplLXRhc2tzJzoge1xuICAgICAgICAgIGdldDoge1xuICAgICAgICAgICAgc3VtbWFyeTogJ0dldCB0YXNrIGFuYWx5dGljcycsXG4gICAgICAgICAgICBvcGVyYXRpb25JZDogJ2FuYWx5emVUYXNrcycsXG4gICAgICAgICAgICByZXNwb25zZXM6IHtcbiAgICAgICAgICAgICAgJzIwMCc6IHsgZGVzY3JpcHRpb246ICdUYXNrIHN0YXRpc3RpY3MnIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH07XG5cbiAgICBuZXcgY2RrLkNmblJlc291cmNlKHRoaXMsICdUYXNrQWN0aW9ucycsIHtcbiAgICAgIHR5cGU6ICdBV1M6OkJlZHJvY2s6OkFnZW50QWN0aW9uR3JvdXAnLFxuICAgICAgcHJvcGVydGllczoge1xuICAgICAgICBBZ2VudElkOiBhZ2VudC5hdHRyQWdlbnRJZCxcbiAgICAgICAgQWdlbnRWZXJzaW9uOiAnRFJBRlQnLFxuICAgICAgICBBY3Rpb25Hcm91cE5hbWU6ICd0YXNrLW1hbmFnZW1lbnQnLFxuICAgICAgICBBY3Rpb25Hcm91cEV4ZWN1dG9yOiB7XG4gICAgICAgICAgTGFtYmRhOiBhY3Rpb25MYW1iZGEuZnVuY3Rpb25Bcm4sXG4gICAgICAgIH0sXG4gICAgICAgIEFwaVNjaGVtYToge1xuICAgICAgICAgIFBheWxvYWQ6IEpTT04uc3RyaW5naWZ5KGFwaVNjaGVtYSksXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FnZW50SWQnLCB7XG4gICAgICB2YWx1ZTogYWdlbnQuYXR0ckFnZW50SWQsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVGFza1RhYmxlTmFtZScsIHtcbiAgICAgIHZhbHVlOiB0YXNrVGFibGUudGFibGVOYW1lLFxuICAgIH0pO1xuICB9XG59XG4iXX0=