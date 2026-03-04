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
exports.ErrorHandlingPatternStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const bedrock = __importStar(require("aws-cdk-lib/aws-bedrock"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
class ErrorHandlingPatternStack extends cdk.Stack {
    constructor(scope, id, props) {
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
exports.ErrorHandlingPatternStack = ErrorHandlingPatternStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXJyb3ItaGFuZGxpbmcuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJlcnJvci1oYW5kbGluZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxpREFBbUM7QUFDbkMsaUVBQW1EO0FBQ25ELHlEQUEyQztBQUMzQywrREFBaUQ7QUFDakQsMkRBQTZDO0FBRzdDLE1BQWEseUJBQTBCLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDdEQsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFzQjtRQUM5RCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixNQUFNLFFBQVEsR0FBRyxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLFdBQVcsRUFBRTtZQUNwRCxZQUFZLEVBQUUsb0NBQW9DO1lBQ2xELFNBQVMsRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLFFBQVE7WUFDdEMsYUFBYSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsT0FBTztTQUN6QyxDQUFDLENBQUM7UUFFSCxNQUFNLFlBQVksR0FBRyxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLHFCQUFxQixFQUFFO1lBQ3BFLE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVc7WUFDbkMsT0FBTyxFQUFFLGVBQWU7WUFDeEIsT0FBTyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUNqQyxZQUFZLEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxRQUFRO1lBQ3pDLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7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aEQsSUFBSSxFQUFFLGdDQUFnQztZQUN0QyxVQUFVLEVBQUU7Z0JBQ1YsT0FBTyxFQUFFLEtBQUssQ0FBQyxXQUFXO2dCQUMxQixZQUFZLEVBQUUsT0FBTztnQkFDckIsZUFBZSxFQUFFLGdCQUFnQjtnQkFDakMsbUJBQW1CLEVBQUUsRUFBRSxNQUFNLEVBQUUsWUFBWSxDQUFDLFdBQVcsRUFBRTtnQkFDekQsU0FBUyxFQUFFLEVBQUUsT0FBTyxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLEVBQUU7YUFDbEQ7U0FDRixDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLFNBQVMsRUFBRSxFQUFFLEtBQUssRUFBRSxLQUFLLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQztRQUNqRSxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGNBQWMsRUFBRSxFQUFFLEtBQUssRUFBRSxRQUFRLENBQUMsWUFBWSxFQUFFLENBQUMsQ0FBQztJQUM1RSxDQUFDO0NBQ0Y7QUFuUUQsOERBbVFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGJlZHJvY2sgZnJvbSAnYXdzLWNkay1saWIvYXdzLWJlZHJvY2snO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgbG9ncyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbG9ncyc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcblxuZXhwb3J0IGNsYXNzIEVycm9ySGFuZGxpbmdQYXR0ZXJuU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wcz86IGNkay5TdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICBjb25zdCBsb2dHcm91cCA9IG5ldyBsb2dzLkxvZ0dyb3VwKHRoaXMsICdBZ2VudExvZ3MnLCB7XG4gICAgICBsb2dHcm91cE5hbWU6ICcvYXdzL2JlZHJvY2svYWdlbnRzL2Vycm9yLWhhbmRsaW5nJyxcbiAgICAgIHJldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9XRUVLLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICB9KTtcblxuICAgIGNvbnN0IGFjdGlvbkxhbWJkYSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1JvYnVzdEFjdGlvbkhhbmRsZXInLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5QWVRIT05fM18xMixcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9XRUVLLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUlubGluZShgXG5pbXBvcnQganNvblxuaW1wb3J0IGxvZ2dpbmdcbmZyb20gdHlwaW5nIGltcG9ydCBEaWN0LCBBbnksIE9wdGlvbmFsXG5mcm9tIGRhdGV0aW1lIGltcG9ydCBkYXRldGltZVxuXG5sb2dnZXIgPSBsb2dnaW5nLmdldExvZ2dlcigpXG5sb2dnZXIuc2V0TGV2ZWwobG9nZ2luZy5JTkZPKVxuXG5jbGFzcyBBZ2VudEVycm9yKEV4Y2VwdGlvbik6XG4gICAgXCJcIlwiQmFzZSBleGNlcHRpb24gZm9yIGFnZW50IGVycm9yc1wiXCJcIlxuICAgIGRlZiBfX2luaXRfXyhzZWxmLCBtZXNzYWdlOiBzdHIsIHN0YXR1c19jb2RlOiBpbnQgPSA1MDApOlxuICAgICAgICBzZWxmLm1lc3NhZ2UgPSBtZXNzYWdlXG4gICAgICAgIHNlbGYuc3RhdHVzX2NvZGUgPSBzdGF0dXNfY29kZVxuICAgICAgICBzdXBlcigpLl9faW5pdF9fKHNlbGYubWVzc2FnZSlcblxuY2xhc3MgVmFsaWRhdGlvbkVycm9yKEFnZW50RXJyb3IpOlxuICAgIFwiXCJcIlJhaXNlZCB3aGVuIGlucHV0IHZhbGlkYXRpb24gZmFpbHNcIlwiXCJcbiAgICBkZWYgX19pbml0X18oc2VsZiwgbWVzc2FnZTogc3RyKTpcbiAgICAgICAgc3VwZXIoKS5fX2luaXRfXyhtZXNzYWdlLCA0MDApXG5cbmNsYXNzIFJlc291cmNlTm90Rm91bmRFcnJvcihBZ2VudEVycm9yKTpcbiAgICBcIlwiXCJSYWlzZWQgd2hlbiBhIHJlc291cmNlIGlzIG5vdCBmb3VuZFwiXCJcIlxuICAgIGRlZiBfX2luaXRfXyhzZWxmLCBtZXNzYWdlOiBzdHIpOlxuICAgICAgICBzdXBlcigpLl9faW5pdF9fKG1lc3NhZ2UsIDQwNClcblxuZGVmIHZhbGlkYXRlX3BhcmFtZXRlcnMocGFyYW1ldGVyczogbGlzdCwgcmVxdWlyZWQ6IGxpc3QpIC0+IERpY3Rbc3RyLCBBbnldOlxuICAgIFwiXCJcIlxuICAgIFZhbGlkYXRlIGFuZCBleHRyYWN0IHJlcXVpcmVkIHBhcmFtZXRlcnNcbiAgICBcIlwiXCJcbiAgICBwYXJhbV9kaWN0ID0ge3BbJ25hbWUnXTogcFsndmFsdWUnXSBmb3IgcCBpbiBwYXJhbWV0ZXJzfVxuICAgIFxuICAgIG1pc3NpbmcgPSBbciBmb3IgciBpbiByZXF1aXJlZCBpZiByIG5vdCBpbiBwYXJhbV9kaWN0XVxuICAgIGlmIG1pc3Npbmc6XG4gICAgICAgIHJhaXNlIFZhbGlkYXRpb25FcnJvcihmXCJNaXNzaW5nIHJlcXVpcmVkIHBhcmFtZXRlcnM6IHsnLCAnLmpvaW4obWlzc2luZyl9XCIpXG4gICAgXG4gICAgcmV0dXJuIHBhcmFtX2RpY3RcblxuZGVmIGNyZWF0ZV9yZXNwb25zZShhY3Rpb246IHN0ciwgYXBpX3BhdGg6IHN0ciwgc3RhdHVzX2NvZGU6IGludCwgXG4gICAgICAgICAgICAgICAgICAgYm9keTogRGljdFtzdHIsIEFueV0pIC0+IERpY3Rbc3RyLCBBbnldOlxuICAgIFwiXCJcIlxuICAgIENyZWF0ZSBzdGFuZGFyZGl6ZWQgcmVzcG9uc2VcbiAgICBcIlwiXCJcbiAgICByZXR1cm4ge1xuICAgICAgICAnbWVzc2FnZVZlcnNpb24nOiAnMS4wJyxcbiAgICAgICAgJ3Jlc3BvbnNlJzoge1xuICAgICAgICAgICAgJ2FjdGlvbkdyb3VwJzogYWN0aW9uLFxuICAgICAgICAgICAgJ2FwaVBhdGgnOiBhcGlfcGF0aCxcbiAgICAgICAgICAgICdodHRwU3RhdHVzQ29kZSc6IHN0YXR1c19jb2RlLFxuICAgICAgICAgICAgJ3Jlc3BvbnNlQm9keSc6IHtcbiAgICAgICAgICAgICAgICAnYXBwbGljYXRpb24vanNvbic6IHtcbiAgICAgICAgICAgICAgICAgICAgJ2JvZHknOiBqc29uLmR1bXBzKGJvZHkpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG5kZWYgbG9nX3JlcXVlc3QoZXZlbnQ6IERpY3Rbc3RyLCBBbnldKSAtPiBOb25lOlxuICAgIFwiXCJcIlxuICAgIExvZyBpbmNvbWluZyByZXF1ZXN0IGRldGFpbHNcbiAgICBcIlwiXCJcbiAgICBsb2dnZXIuaW5mbyhqc29uLmR1bXBzKHtcbiAgICAgICAgJ3RpbWVzdGFtcCc6IGRhdGV0aW1lLnV0Y25vdygpLmlzb2Zvcm1hdCgpLFxuICAgICAgICAnZXZlbnRfdHlwZSc6ICdyZXF1ZXN0JyxcbiAgICAgICAgJ2FjdGlvbl9ncm91cCc6IGV2ZW50LmdldCgnYWN0aW9uR3JvdXAnKSxcbiAgICAgICAgJ2FwaV9wYXRoJzogZXZlbnQuZ2V0KCdhcGlQYXRoJyksXG4gICAgICAgICdzZXNzaW9uX2lkJzogZXZlbnQuZ2V0KCdzZXNzaW9uSWQnKSxcbiAgICB9KSlcblxuZGVmIGxvZ19lcnJvcihlcnJvcjogRXhjZXB0aW9uLCBldmVudDogRGljdFtzdHIsIEFueV0pIC0+IE5vbmU6XG4gICAgXCJcIlwiXG4gICAgTG9nIGVycm9yIGRldGFpbHNcbiAgICBcIlwiXCJcbiAgICBsb2dnZXIuZXJyb3IoanNvbi5kdW1wcyh7XG4gICAgICAgICd0aW1lc3RhbXAnOiBkYXRldGltZS51dGNub3coKS5pc29mb3JtYXQoKSxcbiAgICAgICAgJ2V2ZW50X3R5cGUnOiAnZXJyb3InLFxuICAgICAgICAnZXJyb3JfdHlwZSc6IHR5cGUoZXJyb3IpLl9fbmFtZV9fLFxuICAgICAgICAnZXJyb3JfbWVzc2FnZSc6IHN0cihlcnJvciksXG4gICAgICAgICdhY3Rpb25fZ3JvdXAnOiBldmVudC5nZXQoJ2FjdGlvbkdyb3VwJyksXG4gICAgICAgICdhcGlfcGF0aCc6IGV2ZW50LmdldCgnYXBpUGF0aCcpLFxuICAgICAgICAnc2Vzc2lvbl9pZCc6IGV2ZW50LmdldCgnc2Vzc2lvbklkJyksXG4gICAgfSkpXG5cbmRlZiBoYW5kbGVyKGV2ZW50OiBEaWN0W3N0ciwgQW55XSwgY29udGV4dDogQW55KSAtPiBEaWN0W3N0ciwgQW55XTpcbiAgICBcIlwiXCJcbiAgICBNYWluIGhhbmRsZXIgd2l0aCBjb21wcmVoZW5zaXZlIGVycm9yIGhhbmRsaW5nXG4gICAgXCJcIlwiXG4gICAgYWN0aW9uID0gZXZlbnQuZ2V0KCdhY3Rpb25Hcm91cCcsICd1bmtub3duJylcbiAgICBhcGlfcGF0aCA9IGV2ZW50LmdldCgnYXBpUGF0aCcsICd1bmtub3duJylcbiAgICBcbiAgICB0cnk6XG4gICAgICAgIGxvZ19yZXF1ZXN0KGV2ZW50KVxuICAgICAgICBcbiAgICAgICAgcGFyYW1ldGVycyA9IGV2ZW50LmdldCgncGFyYW1ldGVycycsIFtdKVxuICAgICAgICBcbiAgICAgICAgaWYgYXBpX3BhdGggPT0gJy9zYWZlLWRpdmlkZSc6XG4gICAgICAgICAgICBwYXJhbXMgPSB2YWxpZGF0ZV9wYXJhbWV0ZXJzKHBhcmFtZXRlcnMsIFsnbnVtZXJhdG9yJywgJ2Rlbm9taW5hdG9yJ10pXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHRyeTpcbiAgICAgICAgICAgICAgICBudW1lcmF0b3IgPSBmbG9hdChwYXJhbXNbJ251bWVyYXRvciddKVxuICAgICAgICAgICAgICAgIGRlbm9taW5hdG9yID0gZmxvYXQocGFyYW1zWydkZW5vbWluYXRvciddKVxuICAgICAgICAgICAgZXhjZXB0IFZhbHVlRXJyb3I6XG4gICAgICAgICAgICAgICAgcmFpc2UgVmFsaWRhdGlvbkVycm9yKCdOdW1lcmF0b3IgYW5kIGRlbm9taW5hdG9yIG11c3QgYmUgbnVtYmVycycpXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmIGRlbm9taW5hdG9yID09IDA6XG4gICAgICAgICAgICAgICAgcmFpc2UgVmFsaWRhdGlvbkVycm9yKCdDYW5ub3QgZGl2aWRlIGJ5IHplcm8nKVxuICAgICAgICAgICAgXG4gICAgICAgICAgICByZXN1bHQgPSBudW1lcmF0b3IgLyBkZW5vbWluYXRvclxuICAgICAgICAgICAgXG4gICAgICAgICAgICByZXR1cm4gY3JlYXRlX3Jlc3BvbnNlKGFjdGlvbiwgYXBpX3BhdGgsIDIwMCwge1xuICAgICAgICAgICAgICAgICdyZXN1bHQnOiByZXN1bHQsXG4gICAgICAgICAgICAgICAgJ29wZXJhdGlvbic6IGYne251bWVyYXRvcn0gLyB7ZGVub21pbmF0b3J9J1xuICAgICAgICAgICAgfSlcbiAgICAgICAgXG4gICAgICAgIGVsaWYgYXBpX3BhdGggPT0gJy9mZXRjaC1yZXNvdXJjZSc6XG4gICAgICAgICAgICBwYXJhbXMgPSB2YWxpZGF0ZV9wYXJhbWV0ZXJzKHBhcmFtZXRlcnMsIFsncmVzb3VyY2VJZCddKVxuICAgICAgICAgICAgcmVzb3VyY2VfaWQgPSBwYXJhbXNbJ3Jlc291cmNlSWQnXVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiBub3QgcmVzb3VyY2VfaWQuc3RhcnRzd2l0aCgncmVzLScpOlxuICAgICAgICAgICAgICAgIHJhaXNlIFZhbGlkYXRpb25FcnJvcignUmVzb3VyY2UgSUQgbXVzdCBzdGFydCB3aXRoIFwicmVzLVwiJylcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgcmVzb3VyY2VfaWQgPT0gJ3Jlcy1ub3Rmb3VuZCc6XG4gICAgICAgICAgICAgICAgcmFpc2UgUmVzb3VyY2VOb3RGb3VuZEVycm9yKGYnUmVzb3VyY2Uge3Jlc291cmNlX2lkfSBub3QgZm91bmQnKVxuICAgICAgICAgICAgXG4gICAgICAgICAgICByZXR1cm4gY3JlYXRlX3Jlc3BvbnNlKGFjdGlvbiwgYXBpX3BhdGgsIDIwMCwge1xuICAgICAgICAgICAgICAgICdyZXNvdXJjZUlkJzogcmVzb3VyY2VfaWQsXG4gICAgICAgICAgICAgICAgJ2RhdGEnOiB7J25hbWUnOiAnU2FtcGxlIFJlc291cmNlJywgJ3N0YXR1cyc6ICdhY3RpdmUnfVxuICAgICAgICAgICAgfSlcbiAgICAgICAgXG4gICAgICAgIGVsaWYgYXBpX3BhdGggPT0gJy9yZXRyeS1vcGVyYXRpb24nOlxuICAgICAgICAgICAgcGFyYW1zID0gdmFsaWRhdGVfcGFyYW1ldGVycyhwYXJhbWV0ZXJzLCBbJ29wZXJhdGlvbklkJ10pXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHJldHVybiBjcmVhdGVfcmVzcG9uc2UoYWN0aW9uLCBhcGlfcGF0aCwgMjAwLCB7XG4gICAgICAgICAgICAgICAgJ29wZXJhdGlvbklkJzogcGFyYW1zWydvcGVyYXRpb25JZCddLFxuICAgICAgICAgICAgICAgICdzdGF0dXMnOiAnY29tcGxldGVkJyxcbiAgICAgICAgICAgICAgICAnbWVzc2FnZSc6ICdPcGVyYXRpb24gY29tcGxldGVkIHN1Y2Nlc3NmdWxseSdcbiAgICAgICAgICAgIH0pXG4gICAgICAgIFxuICAgICAgICBlbHNlOlxuICAgICAgICAgICAgcmFpc2UgUmVzb3VyY2VOb3RGb3VuZEVycm9yKGYnQVBJIHBhdGgge2FwaV9wYXRofSBub3QgZm91bmQnKVxuICAgIFxuICAgIGV4Y2VwdCBWYWxpZGF0aW9uRXJyb3IgYXMgZTpcbiAgICAgICAgbG9nX2Vycm9yKGUsIGV2ZW50KVxuICAgICAgICByZXR1cm4gY3JlYXRlX3Jlc3BvbnNlKGFjdGlvbiwgYXBpX3BhdGgsIGUuc3RhdHVzX2NvZGUsIHtcbiAgICAgICAgICAgICdlcnJvcic6ICdWYWxpZGF0aW9uRXJyb3InLFxuICAgICAgICAgICAgJ21lc3NhZ2UnOiBlLm1lc3NhZ2VcbiAgICAgICAgfSlcbiAgICBcbiAgICBleGNlcHQgUmVzb3VyY2VOb3RGb3VuZEVycm9yIGFzIGU6XG4gICAgICAgIGxvZ19lcnJvcihlLCBldmVudClcbiAgICAgICAgcmV0dXJuIGNyZWF0ZV9yZXNwb25zZShhY3Rpb24sIGFwaV9wYXRoLCBlLnN0YXR1c19jb2RlLCB7XG4gICAgICAgICAgICAnZXJyb3InOiAnUmVzb3VyY2VOb3RGb3VuZEVycm9yJyxcbiAgICAgICAgICAgICdtZXNzYWdlJzogZS5tZXNzYWdlXG4gICAgICAgIH0pXG4gICAgXG4gICAgZXhjZXB0IEFnZW50RXJyb3IgYXMgZTpcbiAgICAgICAgbG9nX2Vycm9yKGUsIGV2ZW50KVxuICAgICAgICByZXR1cm4gY3JlYXRlX3Jlc3BvbnNlKGFjdGlvbiwgYXBpX3BhdGgsIGUuc3RhdHVzX2NvZGUsIHtcbiAgICAgICAgICAgICdlcnJvcic6IHR5cGUoZSkuX19uYW1lX18sXG4gICAgICAgICAgICAnbWVzc2FnZSc6IGUubWVzc2FnZVxuICAgICAgICB9KVxuICAgIFxuICAgIGV4Y2VwdCBFeGNlcHRpb24gYXMgZTpcbiAgICAgICAgbG9nX2Vycm9yKGUsIGV2ZW50KVxuICAgICAgICByZXR1cm4gY3JlYXRlX3Jlc3BvbnNlKGFjdGlvbiwgYXBpX3BhdGgsIDUwMCwge1xuICAgICAgICAgICAgJ2Vycm9yJzogJ0ludGVybmFsU2VydmVyRXJyb3InLFxuICAgICAgICAgICAgJ21lc3NhZ2UnOiAnQW4gdW5leHBlY3RlZCBlcnJvciBvY2N1cnJlZC4gUGxlYXNlIHRyeSBhZ2FpbiBsYXRlci4nXG4gICAgICAgIH0pXG4gICAgICBgKSxcbiAgICB9KTtcblxuICAgIGNvbnN0IGFnZW50Um9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnQWdlbnRSb2xlJywge1xuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2JlZHJvY2suYW1hem9uYXdzLmNvbScpLFxuICAgIH0pO1xuXG4gICAgYWdlbnRSb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFsnYmVkcm9jazpJbnZva2VNb2RlbCddLFxuICAgICAgcmVzb3VyY2VzOiBbJyonXSxcbiAgICB9KSk7XG5cbiAgICBhY3Rpb25MYW1iZGEuZ3JhbnRJbnZva2UoYWdlbnRSb2xlKTtcblxuICAgIGNvbnN0IGFnZW50ID0gbmV3IGJlZHJvY2suQ2ZuQWdlbnQodGhpcywgJ1JvYnVzdEFnZW50Jywge1xuICAgICAgYWdlbnROYW1lOiAnZXJyb3ItaGFuZGxpbmctYWdlbnQnLFxuICAgICAgYWdlbnRSZXNvdXJjZVJvbGVBcm46IGFnZW50Um9sZS5yb2xlQXJuLFxuICAgICAgZm91bmRhdGlvbk1vZGVsOiAnYW50aHJvcGljLmNsYXVkZS0zLXNvbm5ldC0yMDI0MDIyOS12MTowJyxcbiAgICAgIGluc3RydWN0aW9uOiBgWW91IGFyZSBhbiBhc3Npc3RhbnQgdGhhdCBkZW1vbnN0cmF0ZXMgcm9idXN0IGVycm9yIGhhbmRsaW5nLlxuICAgICAgV2hlbiBlcnJvcnMgb2NjdXIsIGV4cGxhaW4gdGhlbSBjbGVhcmx5IHRvIHVzZXJzIGFuZCBzdWdnZXN0IHNvbHV0aW9ucy5cbiAgICAgIEFsd2F5cyB2YWxpZGF0ZSBpbnB1dHMgYmVmb3JlIHByb2Nlc3NpbmcuYCxcbiAgICB9KTtcblxuICAgIGNvbnN0IGFwaVNjaGVtYSA9IHtcbiAgICAgIG9wZW5hcGk6ICczLjAuMCcsXG4gICAgICBpbmZvOiB7IHRpdGxlOiAnRXJyb3IgSGFuZGxpbmcgQVBJJywgdmVyc2lvbjogJzEuMC4wJyB9LFxuICAgICAgcGF0aHM6IHtcbiAgICAgICAgJy9zYWZlLWRpdmlkZSc6IHtcbiAgICAgICAgICBnZXQ6IHtcbiAgICAgICAgICAgIHN1bW1hcnk6ICdTYWZlbHkgZGl2aWRlIHR3byBudW1iZXJzJyxcbiAgICAgICAgICAgIG9wZXJhdGlvbklkOiAnc2FmZURpdmlkZScsXG4gICAgICAgICAgICBwYXJhbWV0ZXJzOiBbXG4gICAgICAgICAgICAgIHsgbmFtZTogJ251bWVyYXRvcicsIGluOiAncXVlcnknLCByZXF1aXJlZDogdHJ1ZSwgc2NoZW1hOiB7IHR5cGU6ICdudW1iZXInIH0gfSxcbiAgICAgICAgICAgICAgeyBuYW1lOiAnZGVub21pbmF0b3InLCBpbjogJ3F1ZXJ5JywgcmVxdWlyZWQ6IHRydWUsIHNjaGVtYTogeyB0eXBlOiAnbnVtYmVyJyB9IH0sXG4gICAgICAgICAgICBdLFxuICAgICAgICAgICAgcmVzcG9uc2VzOiB7ICcyMDAnOiB7IGRlc2NyaXB0aW9uOiAnRGl2aXNpb24gcmVzdWx0JyB9IH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgJy9mZXRjaC1yZXNvdXJjZSc6IHtcbiAgICAgICAgICBnZXQ6IHtcbiAgICAgICAgICAgIHN1bW1hcnk6ICdGZXRjaCBhIHJlc291cmNlIGJ5IElEJyxcbiAgICAgICAgICAgIG9wZXJhdGlvbklkOiAnZmV0Y2hSZXNvdXJjZScsXG4gICAgICAgICAgICBwYXJhbWV0ZXJzOiBbXG4gICAgICAgICAgICAgIHsgbmFtZTogJ3Jlc291cmNlSWQnLCBpbjogJ3F1ZXJ5JywgcmVxdWlyZWQ6IHRydWUsIHNjaGVtYTogeyB0eXBlOiAnc3RyaW5nJyB9IH0sXG4gICAgICAgICAgICBdLFxuICAgICAgICAgICAgcmVzcG9uc2VzOiB7ICcyMDAnOiB7IGRlc2NyaXB0aW9uOiAnUmVzb3VyY2UgZGF0YScgfSB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgICcvcmV0cnktb3BlcmF0aW9uJzoge1xuICAgICAgICAgIHBvc3Q6IHtcbiAgICAgICAgICAgIHN1bW1hcnk6ICdSZXRyeSBhIGZhaWxlZCBvcGVyYXRpb24nLFxuICAgICAgICAgICAgb3BlcmF0aW9uSWQ6ICdyZXRyeU9wZXJhdGlvbicsXG4gICAgICAgICAgICBwYXJhbWV0ZXJzOiBbXG4gICAgICAgICAgICAgIHsgbmFtZTogJ29wZXJhdGlvbklkJywgaW46ICdxdWVyeScsIHJlcXVpcmVkOiB0cnVlLCBzY2hlbWE6IHsgdHlwZTogJ3N0cmluZycgfSB9LFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIHJlc3BvbnNlczogeyAnMjAwJzogeyBkZXNjcmlwdGlvbjogJ09wZXJhdGlvbiBzdGF0dXMnIH0gfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9O1xuXG4gICAgbmV3IGNkay5DZm5SZXNvdXJjZSh0aGlzLCAnRXJyb3JIYW5kbGluZ0FjdGlvbnMnLCB7XG4gICAgICB0eXBlOiAnQVdTOjpCZWRyb2NrOjpBZ2VudEFjdGlvbkdyb3VwJyxcbiAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgQWdlbnRJZDogYWdlbnQuYXR0ckFnZW50SWQsXG4gICAgICAgIEFnZW50VmVyc2lvbjogJ0RSQUZUJyxcbiAgICAgICAgQWN0aW9uR3JvdXBOYW1lOiAnZXJyb3ItaGFuZGxpbmcnLFxuICAgICAgICBBY3Rpb25Hcm91cEV4ZWN1dG9yOiB7IExhbWJkYTogYWN0aW9uTGFtYmRhLmZ1bmN0aW9uQXJuIH0sXG4gICAgICAgIEFwaVNjaGVtYTogeyBQYXlsb2FkOiBKU09OLnN0cmluZ2lmeShhcGlTY2hlbWEpIH0sXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FnZW50SWQnLCB7IHZhbHVlOiBhZ2VudC5hdHRyQWdlbnRJZCB9KTtcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnTG9nR3JvdXBOYW1lJywgeyB2YWx1ZTogbG9nR3JvdXAubG9nR3JvdXBOYW1lIH0pO1xuICB9XG59XG4iXX0=