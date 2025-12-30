import * as cdk from 'aws-cdk-lib';
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export class SecurityPatternStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
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

    new bedrock.CfnAgentActionGroup(this, 'SecureActions', {
      agentId: agent.attrAgentId,
      agentVersion: 'DRAFT',
      actionGroupName: 'secure-actions',
      actionGroupExecutor: { lambda: secureActionLambda.functionArn },
      apiSchema: { payload: JSON.stringify(apiSchema) },
    });

    new cdk.CfnOutput(this, 'AgentId', { value: agent.attrAgentId });
    new cdk.CfnOutput(this, 'EncryptionKeyId', { value: encryptionKey.keyId });
    new cdk.CfnOutput(this, 'SecretArn', { value: apiKeySecret.secretArn });
  }
}
