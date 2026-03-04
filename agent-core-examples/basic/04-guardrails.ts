import * as cdk from 'aws-cdk-lib';
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class GuardrailsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const guardrail = new bedrock.CfnGuardrail(this, 'AgentGuardrail', {
      name: 'agent-safety-guardrail',
      description: 'Guardrails to ensure safe agent interactions',
      blockedInputMessaging: 'I cannot process this request as it violates our content policy.',
      blockedOutputsMessaging: 'I cannot provide this response as it violates our content policy.',
      
      contentPolicyConfig: {
        filtersConfig: [
          {
            type: 'SEXUAL',
            inputStrength: 'HIGH',
            outputStrength: 'HIGH',
          },
          {
            type: 'VIOLENCE',
            inputStrength: 'HIGH',
            outputStrength: 'HIGH',
          },
          {
            type: 'HATE',
            inputStrength: 'HIGH',
            outputStrength: 'HIGH',
          },
          {
            type: 'INSULTS',
            inputStrength: 'MEDIUM',
            outputStrength: 'MEDIUM',
          },
          {
            type: 'MISCONDUCT',
            inputStrength: 'MEDIUM',
            outputStrength: 'MEDIUM',
          },
          {
            type: 'PROMPT_ATTACK',
            inputStrength: 'HIGH',
            outputStrength: 'NONE',
          },
        ],
      },

      topicPolicyConfig: {
        topicsConfig: [
          {
            name: 'financial-advice',
            definition: 'Providing specific financial investment advice or recommendations',
            examples: [
              'Should I invest in this stock?',
              'What cryptocurrency should I buy?',
            ],
            type: 'DENY',
          },
          {
            name: 'medical-diagnosis',
            definition: 'Providing medical diagnoses or treatment recommendations',
            examples: [
              'Do I have cancer?',
              'What medication should I take?',
            ],
            type: 'DENY',
          },
        ],
      },

      wordPolicyConfig: {
        wordsConfig: [
          {
            text: 'confidential',
          },
          {
            text: 'secret',
          },
        ],
        managedWordListsConfig: [
          {
            type: 'PROFANITY',
          },
        ],
      },

      sensitiveInformationPolicyConfig: {
        piiEntitiesConfig: [
          {
            type: 'EMAIL',
            action: 'ANONYMIZE',
          },
          {
            type: 'PHONE',
            action: 'ANONYMIZE',
          },
          {
            type: 'CREDIT_DEBIT_CARD_NUMBER',
            action: 'BLOCK',
          },
          {
            type: 'US_SOCIAL_SECURITY_NUMBER',
            action: 'BLOCK',
          },
        ],
        regexesConfig: [
          {
            name: 'api-key-pattern',
            description: 'Detect API keys',
            pattern: '[A-Z0-9]{20,}',
            action: 'BLOCK',
          },
        ],
      },
    });

    const guardrailVersion = new bedrock.CfnGuardrailVersion(this, 'GuardrailVersion', {
      guardrailIdentifier: guardrail.attrGuardrailId,
    });

    const agentRole = new iam.Role(this, 'AgentRole', {
      assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
    });

    agentRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['bedrock:InvokeModel', 'bedrock:ApplyGuardrail'],
      resources: ['*'],
    }));

    const agent = new bedrock.CfnAgent(this, 'SafeAgent', {
      agentName: 'agent-with-guardrails',
      agentResourceRoleArn: agentRole.roleArn,
      foundationModel: 'anthropic.claude-3-sonnet-20240229-v1:0',
      instruction: 'You are a helpful assistant. Always prioritize user safety and follow all guardrails.',
      guardrailConfiguration: {
        guardrailIdentifier: guardrail.attrGuardrailId,
        guardrailVersion: guardrailVersion.attrVersion,
      },
    });

    new cdk.CfnOutput(this, 'GuardrailId', {
      value: guardrail.attrGuardrailId,
    });

    new cdk.CfnOutput(this, 'GuardrailVersion', {
      value: guardrailVersion.attrVersion,
    });

    new cdk.CfnOutput(this, 'AgentId', {
      value: agent.attrAgentId,
    });
  }
}
