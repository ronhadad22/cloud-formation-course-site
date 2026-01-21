#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ActionGroupsStack } from '../basic/02-action-groups';

const app = new cdk.App();

new ActionGroupsStack(app, 'ActionGroupsStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
  description: 'Weather agent with action groups using inline property',
});
