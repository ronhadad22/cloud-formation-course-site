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
exports.SecurityPatternStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const bedrock = __importStar(require("aws-cdk-lib/aws-bedrock"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const kms = __importStar(require("aws-cdk-lib/aws-kms"));
const secretsmanager = __importStar(require("aws-cdk-lib/aws-secretsmanager"));
class SecurityPatternStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const encryptionKey = new kms.Key(this, 'AgentEncryptionKey', {
            description: 'KMS key for agent data encryption',
            enableKeyRotation: true,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        const apiKeySecret = new secretsmanager.Secret(this, 'ApiKeySecret', {
            description: 'API keys for external services',
            generateSecretString: {
                secretStringTemplate: JSON.stringify({ apiKey: '' }),
                generateStringKey: 'generatedKey',
            },
        });
        const secureActionLambda = new lambda.Function(this, 'SecureActionHandler', {
            runtime: lambda.Runtime.PYTHON_3_12,
            handler: 'index.handler',
            timeout: cdk.Duration.seconds(30),
            code: lambda.Code.fromInline(`
import json
import boto3
import hashlib
import hmac
import base64
from datetime import datetime

secrets_client = boto3.client('secretsmanager')

def verify_signature(payload: str, signature: str, secret: str) -> bool:
    """
    Verify HMAC signature for request authentication
    """
    expected_signature = hmac.new(
        secret.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(signature, expected_signature)

def get_secret(secret_id: str) -> dict:
    """
    Retrieve secret from Secrets Manager
    """
    try:
        response = secrets_client.get_secret_value(SecretId=secret_id)
        return json.loads(response['SecretString'])
    except Exception as e:
        raise Exception(f'Failed to retrieve secret: {str(e)}')

def sanitize_input(value: str) -> str:
    """
    Sanitize user input to prevent injection attacks
    """
    dangerous_chars = ['<', '>', '"', "'", '&', ';', '|', '\\n', '\\r']
    sanitized = value
    for char in dangerous_chars:
        sanitized = sanitized.replace(char, '')
    return sanitized[:1000]

def validate_permissions(user_id: str, action: str) -> bool:
    """
    Validate user permissions for the requested action
    """
    permissions = {
        'admin': ['read', 'write', 'delete'],
        'user': ['read', 'write'],
        'guest': ['read']
    }
    
    user_role = 'user'
    allowed_actions = permissions.get(user_role, [])
    return action in allowed_actions

def handler(event, context):
    """
    Secure action handler with authentication and authorization
    """
    action = event.get('actionGroup', 'unknown')
    api_path = event.get('apiPath', 'unknown')
    parameters = event.get('parameters', [])
    
    def get_param(name):
        value = next((p['value'] for p in parameters if p['name'] == name), None)
        return sanitize_input(value) if value else None
    
    try:
        if api_path == '/secure-operation':
            user_id = get_param('userId')
            operation = get_param('operation')
            data = get_param('data')
            
            if not all([user_id, operation, data]):
                return create_response(action, api_path, 400, {
                    'error': 'Missing required parameters'
                })
            
            if not validate_permissions(user_id, operation):
                return create_response(action, api_path, 403, {
                    'error': 'Insufficient permissions',
                    'message': f'User {user_id} not authorized for {operation}'
                })
            
            result = {
                'status': 'success',
                'operation': operation,
                'timestamp': datetime.utcnow().isoformat(),
                'data': f'Processed: {data[:100]}'
            }
            
            return create_response(action, api_path, 200, result)
        
        elif api_path == '/external-api-call':
            endpoint = get_param('endpoint')
            
            if not endpoint or not endpoint.startswith('https://'):
                return create_response(action, api_path, 400, {
                    'error': 'Invalid endpoint - must use HTTPS'
                })
            
            secrets = get_secret('${apiKeySecret.secretArn}')
            api_key = secrets.get('apiKey', '')
            
            return create_response(action, api_path, 200, {
                'message': 'External API call would be made here',
                'endpoint': endpoint,
                'authenticated': bool(api_key)
            })
        
        elif api_path == '/data-encryption':
            sensitive_data = get_param('data')
            
            encrypted = base64.b64encode(sensitive_data.encode()).decode()
            
            return create_response(action, api_path, 200, {
                'encrypted': encrypted,
                'algorithm': 'base64',
                'timestamp': datetime.utcnow().isoformat()
            })
        
        else:
            return create_response(action, api_path, 404, {
                'error': 'Endpoint not found'
            })
    
    except Exception as e:
        return create_response(action, api_path, 500, {
            'error': 'Internal server error',
            'message': 'An error occurred processing your request'
        })

def create_response(action: str, api_path: str, status_code: int, body: dict) -> dict:
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
      `),
            environment: {
                SECRET_ARN: apiKeySecret.secretArn,
                KMS_KEY_ID: encryptionKey.keyId,
            },
        });
        apiKeySecret.grantRead(secureActionLambda);
        encryptionKey.grantEncryptDecrypt(secureActionLambda);
        const agentRole = new iam.Role(this, 'AgentRole', {
            assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
            description: 'Least-privilege role for Bedrock Agent',
        });
        agentRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['bedrock:InvokeModel'],
            resources: [
                `arn:aws:bedrock:${cdk.Aws.REGION}::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0`,
            ],
        }));
        secureActionLambda.grantInvoke(agentRole);
        const guardrail = new bedrock.CfnGuardrail(this, 'SecurityGuardrail', {
            name: 'security-guardrail',
            blockedInputMessaging: 'This request cannot be processed due to security policies.',
            blockedOutputsMessaging: 'This response cannot be provided due to security policies.',
            contentPolicyConfig: {
                filtersConfig: [
                    { type: 'SEXUAL', inputStrength: 'HIGH', outputStrength: 'HIGH' },
                    { type: 'VIOLENCE', inputStrength: 'HIGH', outputStrength: 'HIGH' },
                    { type: 'HATE', inputStrength: 'HIGH', outputStrength: 'HIGH' },
                    { type: 'PROMPT_ATTACK', inputStrength: 'HIGH', outputStrength: 'NONE' },
                ],
            },
            sensitiveInformationPolicyConfig: {
                piiEntitiesConfig: [
                    { type: 'EMAIL', action: 'ANONYMIZE' },
                    { type: 'PHONE', action: 'ANONYMIZE' },
                    { type: 'CREDIT_DEBIT_CARD_NUMBER', action: 'BLOCK' },
                    { type: 'US_SOCIAL_SECURITY_NUMBER', action: 'BLOCK' },
                    { type: 'PASSWORD', action: 'BLOCK' },
                ],
            },
        });
        const guardrailVersion = new bedrock.CfnGuardrailVersion(this, 'GuardrailVersion', {
            guardrailIdentifier: guardrail.attrGuardrailId,
        });
        const agent = new bedrock.CfnAgent(this, 'SecureAgent', {
            agentName: 'secure-agent',
            agentResourceRoleArn: agentRole.roleArn,
            foundationModel: 'anthropic.claude-3-sonnet-20240229-v1:0',
            instruction: `You are a security-focused agent. Always:
      1. Validate user permissions before performing actions
      2. Sanitize all inputs
      3. Never expose sensitive information
      4. Use encrypted connections for external calls
      5. Log security-relevant events`,
            guardrailConfiguration: {
                guardrailIdentifier: guardrail.attrGuardrailId,
                guardrailVersion: guardrailVersion.attrVersion,
            },
        });
        const apiSchema = {
            openapi: '3.0.0',
            info: { title: 'Secure API', version: '1.0.0' },
            paths: {
                '/secure-operation': {
                    post: {
                        summary: 'Perform secure operation',
                        operationId: 'secureOperation',
                        parameters: [
                            { name: 'userId', in: 'query', required: true, schema: { type: 'string' } },
                            { name: 'operation', in: 'query', required: true, schema: { type: 'string' } },
                            { name: 'data', in: 'query', required: true, schema: { type: 'string' } },
                        ],
                        responses: { '200': { description: 'Operation completed' } },
                    },
                },
                '/external-api-call': {
                    post: {
                        summary: 'Call external API securely',
                        operationId: 'externalApiCall',
                        parameters: [
                            { name: 'endpoint', in: 'query', required: true, schema: { type: 'string' } },
                        ],
                        responses: { '200': { description: 'API call completed' } },
                    },
                },
                '/data-encryption': {
                    post: {
                        summary: 'Encrypt sensitive data',
                        operationId: 'dataEncryption',
                        parameters: [
                            { name: 'data', in: 'query', required: true, schema: { type: 'string' } },
                        ],
                        responses: { '200': { description: 'Data encrypted' } },
                    },
                },
            },
        };
        new cdk.CfnResource(this, 'SecureActions', {
            type: 'AWS::Bedrock::AgentActionGroup',
            properties: {
                AgentId: agent.attrAgentId,
                AgentVersion: 'DRAFT',
                ActionGroupName: 'secure-actions',
                ActionGroupExecutor: { Lambda: secureActionLambda.functionArn },
                ApiSchema: { Payload: JSON.stringify(apiSchema) },
            },
        });
        new cdk.CfnOutput(this, 'AgentId', { value: agent.attrAgentId });
        new cdk.CfnOutput(this, 'EncryptionKeyId', { value: encryptionKey.keyId });
        new cdk.CfnOutput(this, 'SecretArn', { value: apiKeySecret.secretArn });
    }
}
exports.SecurityPatternStack = SecurityPatternStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VjdXJpdHkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJzZWN1cml0eS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxpREFBbUM7QUFDbkMsaUVBQW1EO0FBQ25ELHlEQUEyQztBQUMzQywrREFBaUQ7QUFDakQseURBQTJDO0FBQzNDLCtFQUFpRTtBQUdqRSxNQUFhLG9CQUFxQixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQ2pELFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBc0I7UUFDOUQsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsTUFBTSxhQUFhLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxvQkFBb0IsRUFBRTtZQUM1RCxXQUFXLEVBQUUsbUNBQW1DO1lBQ2hELGlCQUFpQixFQUFFLElBQUk7WUFDdkIsYUFBYSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsT0FBTztTQUN6QyxDQUFDLENBQUM7UUFFSCxNQUFNLFlBQVksR0FBRyxJQUFJLGNBQWMsQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLGNBQWMsRUFBRTtZQUNuRSxXQUFXLEVBQUUsZ0NBQWdDO1lBQzdDLG9CQUFvQixFQUFFO2dCQUNwQixvQkFBb0IsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLEVBQUUsTUFBTSxFQUFFLEVBQUUsRUFBRSxDQUFDO2dCQUNwRCxpQkFBaUIsRUFBRSxjQUFjO2FBQ2xDO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsTUFBTSxrQkFBa0IsR0FBRyxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLHFCQUFxQixFQUFFO1lBQzFFLE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVc7WUFDbkMsT0FBTyxFQUFFLGVBQWU7WUFDeEIsT0FBTyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FB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LENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxTQUFTLEVBQUUsRUFBRSxLQUFLLEVBQUUsS0FBSyxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUM7UUFDakUsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxpQkFBaUIsRUFBRSxFQUFFLEtBQUssRUFBRSxhQUFhLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQztRQUMzRSxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLFdBQVcsRUFBRSxFQUFFLEtBQUssRUFBRSxZQUFZLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQztJQUMxRSxDQUFDO0NBQ0Y7QUFsU0Qsb0RBa1NDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGJlZHJvY2sgZnJvbSAnYXdzLWNkay1saWIvYXdzLWJlZHJvY2snO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMga21zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1rbXMnO1xuaW1wb3J0ICogYXMgc2VjcmV0c21hbmFnZXIgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNlY3JldHNtYW5hZ2VyJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuXG5leHBvcnQgY2xhc3MgU2VjdXJpdHlQYXR0ZXJuU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wcz86IGNkay5TdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICBjb25zdCBlbmNyeXB0aW9uS2V5ID0gbmV3IGttcy5LZXkodGhpcywgJ0FnZW50RW5jcnlwdGlvbktleScsIHtcbiAgICAgIGRlc2NyaXB0aW9uOiAnS01TIGtleSBmb3IgYWdlbnQgZGF0YSBlbmNyeXB0aW9uJyxcbiAgICAgIGVuYWJsZUtleVJvdGF0aW9uOiB0cnVlLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICB9KTtcblxuICAgIGNvbnN0IGFwaUtleVNlY3JldCA9IG5ldyBzZWNyZXRzbWFuYWdlci5TZWNyZXQodGhpcywgJ0FwaUtleVNlY3JldCcsIHtcbiAgICAgIGRlc2NyaXB0aW9uOiAnQVBJIGtleXMgZm9yIGV4dGVybmFsIHNlcnZpY2VzJyxcbiAgICAgIGdlbmVyYXRlU2VjcmV0U3RyaW5nOiB7XG4gICAgICAgIHNlY3JldFN0cmluZ1RlbXBsYXRlOiBKU09OLnN0cmluZ2lmeSh7IGFwaUtleTogJycgfSksXG4gICAgICAgIGdlbmVyYXRlU3RyaW5nS2V5OiAnZ2VuZXJhdGVkS2V5JyxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBjb25zdCBzZWN1cmVBY3Rpb25MYW1iZGEgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdTZWN1cmVBY3Rpb25IYW5kbGVyJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfMTIsXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tSW5saW5lKGBcbmltcG9ydCBqc29uXG5pbXBvcnQgYm90bzNcbmltcG9ydCBoYXNobGliXG5pbXBvcnQgaG1hY1xuaW1wb3J0IGJhc2U2NFxuZnJvbSBkYXRldGltZSBpbXBvcnQgZGF0ZXRpbWVcblxuc2VjcmV0c19jbGllbnQgPSBib3RvMy5jbGllbnQoJ3NlY3JldHNtYW5hZ2VyJylcblxuZGVmIHZlcmlmeV9zaWduYXR1cmUocGF5bG9hZDogc3RyLCBzaWduYXR1cmU6IHN0ciwgc2VjcmV0OiBzdHIpIC0+IGJvb2w6XG4gICAgXCJcIlwiXG4gICAgVmVyaWZ5IEhNQUMgc2lnbmF0dXJlIGZvciByZXF1ZXN0IGF1dGhlbnRpY2F0aW9uXG4gICAgXCJcIlwiXG4gICAgZXhwZWN0ZWRfc2lnbmF0dXJlID0gaG1hYy5uZXcoXG4gICAgICAgIHNlY3JldC5lbmNvZGUoKSxcbiAgICAgICAgcGF5bG9hZC5lbmNvZGUoKSxcbiAgICAgICAgaGFzaGxpYi5zaGEyNTZcbiAgICApLmhleGRpZ2VzdCgpXG4gICAgcmV0dXJuIGhtYWMuY29tcGFyZV9kaWdlc3Qoc2lnbmF0dXJlLCBleHBlY3RlZF9zaWduYXR1cmUpXG5cbmRlZiBnZXRfc2VjcmV0KHNlY3JldF9pZDogc3RyKSAtPiBkaWN0OlxuICAgIFwiXCJcIlxuICAgIFJldHJpZXZlIHNlY3JldCBmcm9tIFNlY3JldHMgTWFuYWdlclxuICAgIFwiXCJcIlxuICAgIHRyeTpcbiAgICAgICAgcmVzcG9uc2UgPSBzZWNyZXRzX2NsaWVudC5nZXRfc2VjcmV0X3ZhbHVlKFNlY3JldElkPXNlY3JldF9pZClcbiAgICAgICAgcmV0dXJuIGpzb24ubG9hZHMocmVzcG9uc2VbJ1NlY3JldFN0cmluZyddKVxuICAgIGV4Y2VwdCBFeGNlcHRpb24gYXMgZTpcbiAgICAgICAgcmFpc2UgRXhjZXB0aW9uKGYnRmFpbGVkIHRvIHJldHJpZXZlIHNlY3JldDoge3N0cihlKX0nKVxuXG5kZWYgc2FuaXRpemVfaW5wdXQodmFsdWU6IHN0cikgLT4gc3RyOlxuICAgIFwiXCJcIlxuICAgIFNhbml0aXplIHVzZXIgaW5wdXQgdG8gcHJldmVudCBpbmplY3Rpb24gYXR0YWNrc1xuICAgIFwiXCJcIlxuICAgIGRhbmdlcm91c19jaGFycyA9IFsnPCcsICc+JywgJ1wiJywgXCInXCIsICcmJywgJzsnLCAnfCcsICdcXFxcbicsICdcXFxcciddXG4gICAgc2FuaXRpemVkID0gdmFsdWVcbiAgICBmb3IgY2hhciBpbiBkYW5nZXJvdXNfY2hhcnM6XG4gICAgICAgIHNhbml0aXplZCA9IHNhbml0aXplZC5yZXBsYWNlKGNoYXIsICcnKVxuICAgIHJldHVybiBzYW5pdGl6ZWRbOjEwMDBdXG5cbmRlZiB2YWxpZGF0ZV9wZXJtaXNzaW9ucyh1c2VyX2lkOiBzdHIsIGFjdGlvbjogc3RyKSAtPiBib29sOlxuICAgIFwiXCJcIlxuICAgIFZhbGlkYXRlIHVzZXIgcGVybWlzc2lvbnMgZm9yIHRoZSByZXF1ZXN0ZWQgYWN0aW9uXG4gICAgXCJcIlwiXG4gICAgcGVybWlzc2lvbnMgPSB7XG4gICAgICAgICdhZG1pbic6IFsncmVhZCcsICd3cml0ZScsICdkZWxldGUnXSxcbiAgICAgICAgJ3VzZXInOiBbJ3JlYWQnLCAnd3JpdGUnXSxcbiAgICAgICAgJ2d1ZXN0JzogWydyZWFkJ11cbiAgICB9XG4gICAgXG4gICAgdXNlcl9yb2xlID0gJ3VzZXInXG4gICAgYWxsb3dlZF9hY3Rpb25zID0gcGVybWlzc2lvbnMuZ2V0KHVzZXJfcm9sZSwgW10pXG4gICAgcmV0dXJuIGFjdGlvbiBpbiBhbGxvd2VkX2FjdGlvbnNcblxuZGVmIGhhbmRsZXIoZXZlbnQsIGNvbnRleHQpOlxuICAgIFwiXCJcIlxuICAgIFNlY3VyZSBhY3Rpb24gaGFuZGxlciB3aXRoIGF1dGhlbnRpY2F0aW9uIGFuZCBhdXRob3JpemF0aW9uXG4gICAgXCJcIlwiXG4gICAgYWN0aW9uID0gZXZlbnQuZ2V0KCdhY3Rpb25Hcm91cCcsICd1bmtub3duJylcbiAgICBhcGlfcGF0aCA9IGV2ZW50LmdldCgnYXBpUGF0aCcsICd1bmtub3duJylcbiAgICBwYXJhbWV0ZXJzID0gZXZlbnQuZ2V0KCdwYXJhbWV0ZXJzJywgW10pXG4gICAgXG4gICAgZGVmIGdldF9wYXJhbShuYW1lKTpcbiAgICAgICAgdmFsdWUgPSBuZXh0KChwWyd2YWx1ZSddIGZvciBwIGluIHBhcmFtZXRlcnMgaWYgcFsnbmFtZSddID09IG5hbWUpLCBOb25lKVxuICAgICAgICByZXR1cm4gc2FuaXRpemVfaW5wdXQodmFsdWUpIGlmIHZhbHVlIGVsc2UgTm9uZVxuICAgIFxuICAgIHRyeTpcbiAgICAgICAgaWYgYXBpX3BhdGggPT0gJy9zZWN1cmUtb3BlcmF0aW9uJzpcbiAgICAgICAgICAgIHVzZXJfaWQgPSBnZXRfcGFyYW0oJ3VzZXJJZCcpXG4gICAgICAgICAgICBvcGVyYXRpb24gPSBnZXRfcGFyYW0oJ29wZXJhdGlvbicpXG4gICAgICAgICAgICBkYXRhID0gZ2V0X3BhcmFtKCdkYXRhJylcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgbm90IGFsbChbdXNlcl9pZCwgb3BlcmF0aW9uLCBkYXRhXSk6XG4gICAgICAgICAgICAgICAgcmV0dXJuIGNyZWF0ZV9yZXNwb25zZShhY3Rpb24sIGFwaV9wYXRoLCA0MDAsIHtcbiAgICAgICAgICAgICAgICAgICAgJ2Vycm9yJzogJ01pc3NpbmcgcmVxdWlyZWQgcGFyYW1ldGVycydcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiBub3QgdmFsaWRhdGVfcGVybWlzc2lvbnModXNlcl9pZCwgb3BlcmF0aW9uKTpcbiAgICAgICAgICAgICAgICByZXR1cm4gY3JlYXRlX3Jlc3BvbnNlKGFjdGlvbiwgYXBpX3BhdGgsIDQwMywge1xuICAgICAgICAgICAgICAgICAgICAnZXJyb3InOiAnSW5zdWZmaWNpZW50IHBlcm1pc3Npb25zJyxcbiAgICAgICAgICAgICAgICAgICAgJ21lc3NhZ2UnOiBmJ1VzZXIge3VzZXJfaWR9IG5vdCBhdXRob3JpemVkIGZvciB7b3BlcmF0aW9ufSdcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgXG4gICAgICAgICAgICByZXN1bHQgPSB7XG4gICAgICAgICAgICAgICAgJ3N0YXR1cyc6ICdzdWNjZXNzJyxcbiAgICAgICAgICAgICAgICAnb3BlcmF0aW9uJzogb3BlcmF0aW9uLFxuICAgICAgICAgICAgICAgICd0aW1lc3RhbXAnOiBkYXRldGltZS51dGNub3coKS5pc29mb3JtYXQoKSxcbiAgICAgICAgICAgICAgICAnZGF0YSc6IGYnUHJvY2Vzc2VkOiB7ZGF0YVs6MTAwXX0nXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHJldHVybiBjcmVhdGVfcmVzcG9uc2UoYWN0aW9uLCBhcGlfcGF0aCwgMjAwLCByZXN1bHQpXG4gICAgICAgIFxuICAgICAgICBlbGlmIGFwaV9wYXRoID09ICcvZXh0ZXJuYWwtYXBpLWNhbGwnOlxuICAgICAgICAgICAgZW5kcG9pbnQgPSBnZXRfcGFyYW0oJ2VuZHBvaW50JylcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgbm90IGVuZHBvaW50IG9yIG5vdCBlbmRwb2ludC5zdGFydHN3aXRoKCdodHRwczovLycpOlxuICAgICAgICAgICAgICAgIHJldHVybiBjcmVhdGVfcmVzcG9uc2UoYWN0aW9uLCBhcGlfcGF0aCwgNDAwLCB7XG4gICAgICAgICAgICAgICAgICAgICdlcnJvcic6ICdJbnZhbGlkIGVuZHBvaW50IC0gbXVzdCB1c2UgSFRUUFMnXG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgc2VjcmV0cyA9IGdldF9zZWNyZXQoJyR7YXBpS2V5U2VjcmV0LnNlY3JldEFybn0nKVxuICAgICAgICAgICAgYXBpX2tleSA9IHNlY3JldHMuZ2V0KCdhcGlLZXknLCAnJylcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgcmV0dXJuIGNyZWF0ZV9yZXNwb25zZShhY3Rpb24sIGFwaV9wYXRoLCAyMDAsIHtcbiAgICAgICAgICAgICAgICAnbWVzc2FnZSc6ICdFeHRlcm5hbCBBUEkgY2FsbCB3b3VsZCBiZSBtYWRlIGhlcmUnLFxuICAgICAgICAgICAgICAgICdlbmRwb2ludCc6IGVuZHBvaW50LFxuICAgICAgICAgICAgICAgICdhdXRoZW50aWNhdGVkJzogYm9vbChhcGlfa2V5KVxuICAgICAgICAgICAgfSlcbiAgICAgICAgXG4gICAgICAgIGVsaWYgYXBpX3BhdGggPT0gJy9kYXRhLWVuY3J5cHRpb24nOlxuICAgICAgICAgICAgc2Vuc2l0aXZlX2RhdGEgPSBnZXRfcGFyYW0oJ2RhdGEnKVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBlbmNyeXB0ZWQgPSBiYXNlNjQuYjY0ZW5jb2RlKHNlbnNpdGl2ZV9kYXRhLmVuY29kZSgpKS5kZWNvZGUoKVxuICAgICAgICAgICAgXG4gICAgICAgICAgICByZXR1cm4gY3JlYXRlX3Jlc3BvbnNlKGFjdGlvbiwgYXBpX3BhdGgsIDIwMCwge1xuICAgICAgICAgICAgICAgICdlbmNyeXB0ZWQnOiBlbmNyeXB0ZWQsXG4gICAgICAgICAgICAgICAgJ2FsZ29yaXRobSc6ICdiYXNlNjQnLFxuICAgICAgICAgICAgICAgICd0aW1lc3RhbXAnOiBkYXRldGltZS51dGNub3coKS5pc29mb3JtYXQoKVxuICAgICAgICAgICAgfSlcbiAgICAgICAgXG4gICAgICAgIGVsc2U6XG4gICAgICAgICAgICByZXR1cm4gY3JlYXRlX3Jlc3BvbnNlKGFjdGlvbiwgYXBpX3BhdGgsIDQwNCwge1xuICAgICAgICAgICAgICAgICdlcnJvcic6ICdFbmRwb2ludCBub3QgZm91bmQnXG4gICAgICAgICAgICB9KVxuICAgIFxuICAgIGV4Y2VwdCBFeGNlcHRpb24gYXMgZTpcbiAgICAgICAgcmV0dXJuIGNyZWF0ZV9yZXNwb25zZShhY3Rpb24sIGFwaV9wYXRoLCA1MDAsIHtcbiAgICAgICAgICAgICdlcnJvcic6ICdJbnRlcm5hbCBzZXJ2ZXIgZXJyb3InLFxuICAgICAgICAgICAgJ21lc3NhZ2UnOiAnQW4gZXJyb3Igb2NjdXJyZWQgcHJvY2Vzc2luZyB5b3VyIHJlcXVlc3QnXG4gICAgICAgIH0pXG5cbmRlZiBjcmVhdGVfcmVzcG9uc2UoYWN0aW9uOiBzdHIsIGFwaV9wYXRoOiBzdHIsIHN0YXR1c19jb2RlOiBpbnQsIGJvZHk6IGRpY3QpIC0+IGRpY3Q6XG4gICAgcmV0dXJuIHtcbiAgICAgICAgJ21lc3NhZ2VWZXJzaW9uJzogJzEuMCcsXG4gICAgICAgICdyZXNwb25zZSc6IHtcbiAgICAgICAgICAgICdhY3Rpb25Hcm91cCc6IGFjdGlvbixcbiAgICAgICAgICAgICdhcGlQYXRoJzogYXBpX3BhdGgsXG4gICAgICAgICAgICAnaHR0cFN0YXR1c0NvZGUnOiBzdGF0dXNfY29kZSxcbiAgICAgICAgICAgICdyZXNwb25zZUJvZHknOiB7XG4gICAgICAgICAgICAgICAgJ2FwcGxpY2F0aW9uL2pzb24nOiB7XG4gICAgICAgICAgICAgICAgICAgICdib2R5JzoganNvbi5kdW1wcyhib2R5KVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICAgIGApLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgU0VDUkVUX0FSTjogYXBpS2V5U2VjcmV0LnNlY3JldEFybixcbiAgICAgICAgS01TX0tFWV9JRDogZW5jcnlwdGlvbktleS5rZXlJZCxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBhcGlLZXlTZWNyZXQuZ3JhbnRSZWFkKHNlY3VyZUFjdGlvbkxhbWJkYSk7XG4gICAgZW5jcnlwdGlvbktleS5ncmFudEVuY3J5cHREZWNyeXB0KHNlY3VyZUFjdGlvbkxhbWJkYSk7XG5cbiAgICBjb25zdCBhZ2VudFJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ0FnZW50Um9sZScsIHtcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdiZWRyb2NrLmFtYXpvbmF3cy5jb20nKSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnTGVhc3QtcHJpdmlsZWdlIHJvbGUgZm9yIEJlZHJvY2sgQWdlbnQnLFxuICAgIH0pO1xuXG4gICAgYWdlbnRSb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFsnYmVkcm9jazpJbnZva2VNb2RlbCddLFxuICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgIGBhcm46YXdzOmJlZHJvY2s6JHtjZGsuQXdzLlJFR0lPTn06OmZvdW5kYXRpb24tbW9kZWwvYW50aHJvcGljLmNsYXVkZS0zLXNvbm5ldC0yMDI0MDIyOS12MTowYCxcbiAgICAgIF0sXG4gICAgfSkpO1xuXG4gICAgc2VjdXJlQWN0aW9uTGFtYmRhLmdyYW50SW52b2tlKGFnZW50Um9sZSk7XG5cbiAgICBjb25zdCBndWFyZHJhaWwgPSBuZXcgYmVkcm9jay5DZm5HdWFyZHJhaWwodGhpcywgJ1NlY3VyaXR5R3VhcmRyYWlsJywge1xuICAgICAgbmFtZTogJ3NlY3VyaXR5LWd1YXJkcmFpbCcsXG4gICAgICBibG9ja2VkSW5wdXRNZXNzYWdpbmc6ICdUaGlzIHJlcXVlc3QgY2Fubm90IGJlIHByb2Nlc3NlZCBkdWUgdG8gc2VjdXJpdHkgcG9saWNpZXMuJyxcbiAgICAgIGJsb2NrZWRPdXRwdXRzTWVzc2FnaW5nOiAnVGhpcyByZXNwb25zZSBjYW5ub3QgYmUgcHJvdmlkZWQgZHVlIHRvIHNlY3VyaXR5IHBvbGljaWVzLicsXG4gICAgICBjb250ZW50UG9saWN5Q29uZmlnOiB7XG4gICAgICAgIGZpbHRlcnNDb25maWc6IFtcbiAgICAgICAgICB7IHR5cGU6ICdTRVhVQUwnLCBpbnB1dFN0cmVuZ3RoOiAnSElHSCcsIG91dHB1dFN0cmVuZ3RoOiAnSElHSCcgfSxcbiAgICAgICAgICB7IHR5cGU6ICdWSU9MRU5DRScsIGlucHV0U3RyZW5ndGg6ICdISUdIJywgb3V0cHV0U3RyZW5ndGg6ICdISUdIJyB9LFxuICAgICAgICAgIHsgdHlwZTogJ0hBVEUnLCBpbnB1dFN0cmVuZ3RoOiAnSElHSCcsIG91dHB1dFN0cmVuZ3RoOiAnSElHSCcgfSxcbiAgICAgICAgICB7IHR5cGU6ICdQUk9NUFRfQVRUQUNLJywgaW5wdXRTdHJlbmd0aDogJ0hJR0gnLCBvdXRwdXRTdHJlbmd0aDogJ05PTkUnIH0sXG4gICAgICAgIF0sXG4gICAgICB9LFxuICAgICAgc2Vuc2l0aXZlSW5mb3JtYXRpb25Qb2xpY3lDb25maWc6IHtcbiAgICAgICAgcGlpRW50aXRpZXNDb25maWc6IFtcbiAgICAgICAgICB7IHR5cGU6ICdFTUFJTCcsIGFjdGlvbjogJ0FOT05ZTUlaRScgfSxcbiAgICAgICAgICB7IHR5cGU6ICdQSE9ORScsIGFjdGlvbjogJ0FOT05ZTUlaRScgfSxcbiAgICAgICAgICB7IHR5cGU6ICdDUkVESVRfREVCSVRfQ0FSRF9OVU1CRVInLCBhY3Rpb246ICdCTE9DSycgfSxcbiAgICAgICAgICB7IHR5cGU6ICdVU19TT0NJQUxfU0VDVVJJVFlfTlVNQkVSJywgYWN0aW9uOiAnQkxPQ0snIH0sXG4gICAgICAgICAgeyB0eXBlOiAnUEFTU1dPUkQnLCBhY3Rpb246ICdCTE9DSycgfSxcbiAgICAgICAgXSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBjb25zdCBndWFyZHJhaWxWZXJzaW9uID0gbmV3IGJlZHJvY2suQ2ZuR3VhcmRyYWlsVmVyc2lvbih0aGlzLCAnR3VhcmRyYWlsVmVyc2lvbicsIHtcbiAgICAgIGd1YXJkcmFpbElkZW50aWZpZXI6IGd1YXJkcmFpbC5hdHRyR3VhcmRyYWlsSWQsXG4gICAgfSk7XG5cbiAgICBjb25zdCBhZ2VudCA9IG5ldyBiZWRyb2NrLkNmbkFnZW50KHRoaXMsICdTZWN1cmVBZ2VudCcsIHtcbiAgICAgIGFnZW50TmFtZTogJ3NlY3VyZS1hZ2VudCcsXG4gICAgICBhZ2VudFJlc291cmNlUm9sZUFybjogYWdlbnRSb2xlLnJvbGVBcm4sXG4gICAgICBmb3VuZGF0aW9uTW9kZWw6ICdhbnRocm9waWMuY2xhdWRlLTMtc29ubmV0LTIwMjQwMjI5LXYxOjAnLFxuICAgICAgaW5zdHJ1Y3Rpb246IGBZb3UgYXJlIGEgc2VjdXJpdHktZm9jdXNlZCBhZ2VudC4gQWx3YXlzOlxuICAgICAgMS4gVmFsaWRhdGUgdXNlciBwZXJtaXNzaW9ucyBiZWZvcmUgcGVyZm9ybWluZyBhY3Rpb25zXG4gICAgICAyLiBTYW5pdGl6ZSBhbGwgaW5wdXRzXG4gICAgICAzLiBOZXZlciBleHBvc2Ugc2Vuc2l0aXZlIGluZm9ybWF0aW9uXG4gICAgICA0LiBVc2UgZW5jcnlwdGVkIGNvbm5lY3Rpb25zIGZvciBleHRlcm5hbCBjYWxsc1xuICAgICAgNS4gTG9nIHNlY3VyaXR5LXJlbGV2YW50IGV2ZW50c2AsXG4gICAgICBndWFyZHJhaWxDb25maWd1cmF0aW9uOiB7XG4gICAgICAgIGd1YXJkcmFpbElkZW50aWZpZXI6IGd1YXJkcmFpbC5hdHRyR3VhcmRyYWlsSWQsXG4gICAgICAgIGd1YXJkcmFpbFZlcnNpb246IGd1YXJkcmFpbFZlcnNpb24uYXR0clZlcnNpb24sXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgY29uc3QgYXBpU2NoZW1hID0ge1xuICAgICAgb3BlbmFwaTogJzMuMC4wJyxcbiAgICAgIGluZm86IHsgdGl0bGU6ICdTZWN1cmUgQVBJJywgdmVyc2lvbjogJzEuMC4wJyB9LFxuICAgICAgcGF0aHM6IHtcbiAgICAgICAgJy9zZWN1cmUtb3BlcmF0aW9uJzoge1xuICAgICAgICAgIHBvc3Q6IHtcbiAgICAgICAgICAgIHN1bW1hcnk6ICdQZXJmb3JtIHNlY3VyZSBvcGVyYXRpb24nLFxuICAgICAgICAgICAgb3BlcmF0aW9uSWQ6ICdzZWN1cmVPcGVyYXRpb24nLFxuICAgICAgICAgICAgcGFyYW1ldGVyczogW1xuICAgICAgICAgICAgICB7IG5hbWU6ICd1c2VySWQnLCBpbjogJ3F1ZXJ5JywgcmVxdWlyZWQ6IHRydWUsIHNjaGVtYTogeyB0eXBlOiAnc3RyaW5nJyB9IH0sXG4gICAgICAgICAgICAgIHsgbmFtZTogJ29wZXJhdGlvbicsIGluOiAncXVlcnknLCByZXF1aXJlZDogdHJ1ZSwgc2NoZW1hOiB7IHR5cGU6ICdzdHJpbmcnIH0gfSxcbiAgICAgICAgICAgICAgeyBuYW1lOiAnZGF0YScsIGluOiAncXVlcnknLCByZXF1aXJlZDogdHJ1ZSwgc2NoZW1hOiB7IHR5cGU6ICdzdHJpbmcnIH0gfSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICByZXNwb25zZXM6IHsgJzIwMCc6IHsgZGVzY3JpcHRpb246ICdPcGVyYXRpb24gY29tcGxldGVkJyB9IH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgJy9leHRlcm5hbC1hcGktY2FsbCc6IHtcbiAgICAgICAgICBwb3N0OiB7XG4gICAgICAgICAgICBzdW1tYXJ5OiAnQ2FsbCBleHRlcm5hbCBBUEkgc2VjdXJlbHknLFxuICAgICAgICAgICAgb3BlcmF0aW9uSWQ6ICdleHRlcm5hbEFwaUNhbGwnLFxuICAgICAgICAgICAgcGFyYW1ldGVyczogW1xuICAgICAgICAgICAgICB7IG5hbWU6ICdlbmRwb2ludCcsIGluOiAncXVlcnknLCByZXF1aXJlZDogdHJ1ZSwgc2NoZW1hOiB7IHR5cGU6ICdzdHJpbmcnIH0gfSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICByZXNwb25zZXM6IHsgJzIwMCc6IHsgZGVzY3JpcHRpb246ICdBUEkgY2FsbCBjb21wbGV0ZWQnIH0gfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICAnL2RhdGEtZW5jcnlwdGlvbic6IHtcbiAgICAgICAgICBwb3N0OiB7XG4gICAgICAgICAgICBzdW1tYXJ5OiAnRW5jcnlwdCBzZW5zaXRpdmUgZGF0YScsXG4gICAgICAgICAgICBvcGVyYXRpb25JZDogJ2RhdGFFbmNyeXB0aW9uJyxcbiAgICAgICAgICAgIHBhcmFtZXRlcnM6IFtcbiAgICAgICAgICAgICAgeyBuYW1lOiAnZGF0YScsIGluOiAncXVlcnknLCByZXF1aXJlZDogdHJ1ZSwgc2NoZW1hOiB7IHR5cGU6ICdzdHJpbmcnIH0gfSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICByZXNwb25zZXM6IHsgJzIwMCc6IHsgZGVzY3JpcHRpb246ICdEYXRhIGVuY3J5cHRlZCcgfSB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH07XG5cbiAgICBuZXcgY2RrLkNmblJlc291cmNlKHRoaXMsICdTZWN1cmVBY3Rpb25zJywge1xuICAgICAgdHlwZTogJ0FXUzo6QmVkcm9jazo6QWdlbnRBY3Rpb25Hcm91cCcsXG4gICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgIEFnZW50SWQ6IGFnZW50LmF0dHJBZ2VudElkLFxuICAgICAgICBBZ2VudFZlcnNpb246ICdEUkFGVCcsXG4gICAgICAgIEFjdGlvbkdyb3VwTmFtZTogJ3NlY3VyZS1hY3Rpb25zJyxcbiAgICAgICAgQWN0aW9uR3JvdXBFeGVjdXRvcjogeyBMYW1iZGE6IHNlY3VyZUFjdGlvbkxhbWJkYS5mdW5jdGlvbkFybiB9LFxuICAgICAgICBBcGlTY2hlbWE6IHsgUGF5bG9hZDogSlNPTi5zdHJpbmdpZnkoYXBpU2NoZW1hKSB9LFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBZ2VudElkJywgeyB2YWx1ZTogYWdlbnQuYXR0ckFnZW50SWQgfSk7XG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0VuY3J5cHRpb25LZXlJZCcsIHsgdmFsdWU6IGVuY3J5cHRpb25LZXkua2V5SWQgfSk7XG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1NlY3JldEFybicsIHsgdmFsdWU6IGFwaUtleVNlY3JldC5zZWNyZXRBcm4gfSk7XG4gIH1cbn1cbiJdfQ==