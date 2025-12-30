#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { SimpleAgentStack } from '../basic/01-simple-agent';

const app = new cdk.App();

new SimpleAgentStack(app, 'SimpleAgentStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
  description: 'Simple Bedrock Agent example for learning Agent Core concepts',
});
