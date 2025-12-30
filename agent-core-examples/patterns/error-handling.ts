import * as cdk from 'aws-cdk-lib';
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export class ErrorHandlingPatternStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const logGroup = new logs.LogGroup(this, 'AgentLogs', {
      logGroupName: '/aws/bedrock/agents/error-handling',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const actionLambda = new lambda.Function(this, 'RobustActionHandler', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'index.handler',
      timeout: cdk.Duration.seconds(30),
      logRetention: logs.RetentionDays.ONE_WEEK,
      code: lambda.Code.fromInline(`
import json
import logging
from typing import Dict, Any, Optional
from datetime import datetime

logger = logging.getLogger()
logger.setLevel(logging.INFO)

class AgentError(Exception):
    """Base exception for agent errors"""
    def __init__(self, message: str, status_code: int = 500):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)

class ValidationError(AgentError):
    """Raised when input validation fails"""
    def __init__(self, message: str):
        super().__init__(message, 400)

class ResourceNotFoundError(AgentError):
    """Raised when a resource is not found"""
    def __init__(self, message: str):
        super().__init__(message, 404)

def validate_parameters(parameters: list, required: list) -> Dict[str, Any]:
    """
    Validate and extract required parameters
    """
    param_dict = {p['name']: p['value'] for p in parameters}
    
    missing = [r for r in required if r not in param_dict]
    if missing:
        raise ValidationError(f"Missing required parameters: {', '.join(missing)}")
    
    return param_dict

def create_response(action: str, api_path: str, status_code: int, 
                   body: Dict[str, Any]) -> Dict[str, Any]:
    """
    Create standardized response
    """
    return {
        'messageVersion': '1.0',
        'response': {
            'actionGroup': action,
            'apiPath': api_path,
            'httpStatusCode': status_code,
            'responseBody': {
                'application/json': {
                    'body': json.dumps(body)
                }
            }
        }
    }

def log_request(event: Dict[str, Any]) -> None:
    """
    Log incoming request details
    """
    logger.info(json.dumps({
        'timestamp': datetime.utcnow().isoformat(),
        'event_type': 'request',
        'action_group': event.get('actionGroup'),
        'api_path': event.get('apiPath'),
        'session_id': event.get('sessionId'),
    }))

def log_error(error: Exception, event: Dict[str, Any]) -> None:
    """
    Log error details
    """
    logger.error(json.dumps({
        'timestamp': datetime.utcnow().isoformat(),
        'event_type': 'error',
        'error_type': type(error).__name__,
        'error_message': str(error),
        'action_group': event.get('actionGroup'),
        'api_path': event.get('apiPath'),
        'session_id': event.get('sessionId'),
    }))

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Main handler with comprehensive error handling
    """
    action = event.get('actionGroup', 'unknown')
    api_path = event.get('apiPath', 'unknown')
    
    try:
        log_request(event)
        
        parameters = event.get('parameters', [])
        
        if api_path == '/safe-divide':
            params = validate_parameters(parameters, ['numerator', 'denominator'])
            
            try:
                numerator = float(params['numerator'])
                denominator = float(params['denominator'])
            except ValueError:
                raise ValidationError('Numerator and denominator must be numbers')
            
            if denominator == 0:
                raise ValidationError('Cannot divide by zero')
            
            result = numerator / denominator
            
            return create_response(action, api_path, 200, {
                'result': result,
                'operation': f'{numerator} / {denominator}'
            })
        
        elif api_path == '/fetch-resource':
            params = validate_parameters(parameters, ['resourceId'])
            resource_id = params['resourceId']
            
            if not resource_id.startswith('res-'):
                raise ValidationError('Resource ID must start with "res-"')
            
            if resource_id == 'res-notfound':
                raise ResourceNotFoundError(f'Resource {resource_id} not found')
            
            return create_response(action, api_path, 200, {
                'resourceId': resource_id,
                'data': {'name': 'Sample Resource', 'status': 'active'}
            })
        
        elif api_path == '/retry-operation':
            params = validate_parameters(parameters, ['operationId'])
            
            return create_response(action, api_path, 200, {
                'operationId': params['operationId'],
                'status': 'completed',
                'message': 'Operation completed successfully'
            })
        
        else:
            raise ResourceNotFoundError(f'API path {api_path} not found')
    
    except ValidationError as e:
        log_error(e, event)
        return create_response(action, api_path, e.status_code, {
            'error': 'ValidationError',
            'message': e.message
        })
    
    except ResourceNotFoundError as e:
        log_error(e, event)
        return create_response(action, api_path, e.status_code, {
            'error': 'ResourceNotFoundError',
            'message': e.message
        })
    
    except AgentError as e:
        log_error(e, event)
        return create_response(action, api_path, e.status_code, {
            'error': type(e).__name__,
            'message': e.message
        })
    
    except Exception as e:
        log_error(e, event)
        return create_response(action, api_path, 500, {
            'error': 'InternalServerError',
            'message': 'An unexpected error occurred. Please try again later.'
        })
      `),
    });

    const agentRole = new iam.Role(this, 'AgentRole', {
      assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
    });

    agentRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['bedrock:InvokeModel'],
      resources: ['*'],
    }));

    actionLambda.grantInvoke(agentRole);

    const agent = new bedrock.CfnAgent(this, 'RobustAgent', {
      agentName: 'error-handling-agent',
      agentResourceRoleArn: agentRole.roleArn,
      foundationModel: 'anthropic.claude-3-sonnet-20240229-v1:0',
      instruction: `You are an assistant that demonstrates robust error handling.
      When errors occur, explain them clearly to users and suggest solutions.
      Always validate inputs before processing.`,
    });

    const apiSchema = {
      openapi: '3.0.0',
      info: { title: 'Error Handling API', version: '1.0.0' },
      paths: {
        '/safe-divide': {
          get: {
            summary: 'Safely divide two numbers',
            operationId: 'safeDivide',
            parameters: [
              { name: 'numerator', in: 'query', required: true, schema: { type: 'number' } },
              { name: 'denominator', in: 'query', required: true, schema: { type: 'number' } },
            ],
            responses: { '200': { description: 'Division result' } },
          },
        },
        '/fetch-resource': {
          get: {
            summary: 'Fetch a resource by ID',
            operationId: 'fetchResource',
            parameters: [
              { name: 'resourceId', in: 'query', required: true, schema: { type: 'string' } },
            ],
            responses: { '200': { description: 'Resource data' } },
          },
        },
        '/retry-operation': {
          post: {
            summary: 'Retry a failed operation',
            operationId: 'retryOperation',
            parameters: [
              { name: 'operationId', in: 'query', required: true, schema: { type: 'string' } },
            ],
            responses: { '200': { description: 'Operation status' } },
          },
        },
      },
    };

    new cdk.CfnResource(this, 'ErrorHandlingActions', {
      type: 'AWS::Bedrock::AgentActionGroup',
      properties: {
        AgentId: agent.attrAgentId,
        AgentVersion: 'DRAFT',
        ActionGroupName: 'error-handling',
        ActionGroupExecutor: { Lambda: actionLambda.functionArn },
        ApiSchema: { Payload: JSON.stringify(apiSchema) },
      },
    });

    new cdk.CfnOutput(this, 'AgentId', { value: agent.attrAgentId });
    new cdk.CfnOutput(this, 'LogGroupName', { value: logGroup.logGroupName });
  }
}
