import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
/**
 * Simplified Action Groups Stack
 *
 * This creates the agent and Lambda function.
 * The action group must be added manually via AWS Console because
 * AWS::Bedrock::AgentActionGroup is not yet available in all regions.
 */
export declare class ActionGroupsSimpleStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps);
}
