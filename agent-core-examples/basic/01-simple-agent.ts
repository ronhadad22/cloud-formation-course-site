import * as cdk from 'aws-cdk-lib';
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class SimpleAgentStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const agentRole = new iam.Role(this, 'AgentRole', {
      assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
      description: 'Role for Bedrock Agent',
    });

    agentRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeModel',
      ],
      resources: ['*'],
    }));

    const agent = new bedrock.CfnAgent(this, 'MyFirstAgent', {
      agentName: 'simple-learning-agent',
      agentResourceRoleArn: agentRole.roleArn,
      foundationModel: 'anthropic.claude-3-sonnet-20240229-v1:0',
      instruction: `You are a helpful assistant that can answer questions about AWS services.
      Be concise and accurate in your responses.`,
      description: 'A simple agent for learning Agent Core concepts',
      idleSessionTtlInSeconds: 600,
    });

    new cdk.CfnOutput(this, 'AgentId', {
      value: agent.attrAgentId,
      description: 'The ID of the created agent',
    });

    new cdk.CfnOutput(this, 'AgentArn', {
      value: agent.attrAgentArn,
      description: 'The ARN of the created agent',
    });
  }
}
