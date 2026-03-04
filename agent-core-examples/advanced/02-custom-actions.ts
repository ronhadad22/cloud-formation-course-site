import * as cdk from 'aws-cdk-lib';
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export class CustomActionsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
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
