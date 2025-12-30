import * as cdk from 'aws-cdk-lib';
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export class MonitoringPatternStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const alertTopic = new sns.Topic(this, 'AgentAlerts', {
      displayName: 'Agent Monitoring Alerts',
    });

    const logGroup = new logs.LogGroup(this, 'AgentMetricsLogs', {
      logGroupName: '/aws/bedrock/agents/monitoring',
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const metricsLambda = new lambda.Function(this, 'MetricsCollector', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'index.handler',
      timeout: cdk.Duration.seconds(30),
      code: lambda.Code.fromInline(`
import json
import logging
import time
from datetime import datetime
import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

cloudwatch = boto3.client('cloudwatch')

class MetricsCollector:
    """Collect and publish custom metrics"""
    
    def __init__(self, namespace='BedrockAgents'):
        self.namespace = namespace
    
    def record_invocation(self, agent_id: str, action: str, duration: float, 
                         success: bool, session_id: str):
        """Record agent invocation metrics"""
        metrics = [
            {
                'MetricName': 'Invocations',
                'Value': 1,
                'Unit': 'Count',
                'Timestamp': datetime.utcnow(),
                'Dimensions': [
                    {'Name': 'AgentId', 'Value': agent_id},
                    {'Name': 'Action', 'Value': action},
                ]
            },
            {
                'MetricName': 'Duration',
                'Value': duration,
                'Unit': 'Milliseconds',
                'Timestamp': datetime.utcnow(),
                'Dimensions': [
                    {'Name': 'AgentId', 'Value': agent_id},
                    {'Name': 'Action', 'Value': action},
                ]
            },
            {
                'MetricName': 'Success' if success else 'Errors',
                'Value': 1,
                'Unit': 'Count',
                'Timestamp': datetime.utcnow(),
                'Dimensions': [
                    {'Name': 'AgentId', 'Value': agent_id},
                    {'Name': 'Action', 'Value': action},
                ]
            }
        ]
        
        try:
            cloudwatch.put_metric_data(
                Namespace=self.namespace,
                MetricData=metrics
            )
        except Exception as e:
            logger.error(f'Failed to publish metrics: {str(e)}')

metrics_collector = MetricsCollector()

def handler(event, context):
    """
    Action handler with comprehensive monitoring
    """
    start_time = time.time()
    action = event.get('actionGroup', 'unknown')
    api_path = event.get('apiPath', 'unknown')
    session_id = event.get('sessionId', 'unknown')
    agent_id = event.get('agent', {}).get('agentId', 'unknown')
    
    logger.info(json.dumps({
        'event_type': 'invocation_start',
        'timestamp': datetime.utcnow().isoformat(),
        'agent_id': agent_id,
        'action': action,
        'api_path': api_path,
        'session_id': session_id,
    }))
    
    success = False
    status_code = 500
    response_body = {}
    
    try:
        parameters = event.get('parameters', [])
        
        if api_path == '/process-data':
            param_value = next((p['value'] for p in parameters if p['name'] == 'data'), None)
            
            if not param_value:
                raise ValueError('Missing required parameter: data')
            
            result = {
                'processed': True,
                'data': param_value,
                'timestamp': datetime.utcnow().isoformat()
            }
            
            response_body = result
            status_code = 200
            success = True
        
        elif api_path == '/health-check':
            response_body = {
                'status': 'healthy',
                'timestamp': datetime.utcnow().isoformat()
            }
            status_code = 200
            success = True
        
        else:
            response_body = {'error': 'Unknown API path'}
            status_code = 404
    
    except Exception as e:
        logger.error(json.dumps({
            'event_type': 'error',
            'timestamp': datetime.utcnow().isoformat(),
            'agent_id': agent_id,
            'action': action,
            'error': str(e),
            'session_id': session_id,
        }))
        response_body = {'error': str(e)}
        status_code = 500
    
    finally:
        duration = (time.time() - start_time) * 1000
        
        metrics_collector.record_invocation(
            agent_id=agent_id,
            action=action,
            duration=duration,
            success=success,
            session_id=session_id
        )
        
        logger.info(json.dumps({
            'event_type': 'invocation_complete',
            'timestamp': datetime.utcnow().isoformat(),
            'agent_id': agent_id,
            'action': action,
            'duration_ms': duration,
            'success': success,
            'status_code': status_code,
            'session_id': session_id,
        }))
    
    return {
        'messageVersion': '1.0',
        'response': {
            'actionGroup': action,
            'apiPath': api_path,
            'httpStatusCode': status_code,
            'responseBody': {
                'application/json': {
                    'body': json.dumps(response_body)
                }
            }
        }
    }
      `),
    });

    metricsLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['cloudwatch:PutMetricData'],
      resources: ['*'],
    }));

    const agentRole = new iam.Role(this, 'AgentRole', {
      assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
    });

    agentRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['bedrock:InvokeModel'],
      resources: ['*'],
    }));

    metricsLambda.grantInvoke(agentRole);

    const agent = new bedrock.CfnAgent(this, 'MonitoredAgent', {
      agentName: 'monitored-agent',
      agentResourceRoleArn: agentRole.roleArn,
      foundationModel: 'anthropic.claude-3-sonnet-20240229-v1:0',
      instruction: 'You are a monitored agent. All your actions are tracked and measured.',
    });

    const apiSchema = {
      openapi: '3.0.0',
      info: { title: 'Monitored API', version: '1.0.0' },
      paths: {
        '/process-data': {
          post: {
            summary: 'Process data',
            operationId: 'processData',
            parameters: [
              { name: 'data', in: 'query', required: true, schema: { type: 'string' } },
            ],
            responses: { '200': { description: 'Data processed' } },
          },
        },
        '/health-check': {
          get: {
            summary: 'Health check',
            operationId: 'healthCheck',
            responses: { '200': { description: 'Service healthy' } },
          },
        },
      },
    };

    new bedrock.CfnAgentActionGroup(this, 'MonitoredActions', {
      agentId: agent.attrAgentId,
      agentVersion: 'DRAFT',
      actionGroupName: 'monitored-actions',
      actionGroupExecutor: { lambda: metricsLambda.functionArn },
      apiSchema: { payload: JSON.stringify(apiSchema) },
    });

    const errorMetric = new cloudwatch.Metric({
      namespace: 'BedrockAgents',
      metricName: 'Errors',
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    const errorAlarm = new cloudwatch.Alarm(this, 'HighErrorRate', {
      metric: errorMetric,
      threshold: 10,
      evaluationPeriods: 2,
      alarmDescription: 'Alert when agent error rate is high',
      alarmName: 'agent-high-error-rate',
    });

    errorAlarm.addAlarmAction({
      bind: () => ({ alarmActionArn: alertTopic.topicArn }),
    });

    const durationMetric = new cloudwatch.Metric({
      namespace: 'BedrockAgents',
      metricName: 'Duration',
      statistic: 'Average',
      period: cdk.Duration.minutes(5),
    });

    const latencyAlarm = new cloudwatch.Alarm(this, 'HighLatency', {
      metric: durationMetric,
      threshold: 5000,
      evaluationPeriods: 2,
      alarmDescription: 'Alert when agent latency is high',
      alarmName: 'agent-high-latency',
    });

    latencyAlarm.addAlarmAction({
      bind: () => ({ alarmActionArn: alertTopic.topicArn }),
    });

    const dashboard = new cloudwatch.Dashboard(this, 'AgentDashboard', {
      dashboardName: 'bedrock-agent-monitoring',
    });

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Agent Invocations',
        left: [
          new cloudwatch.Metric({
            namespace: 'BedrockAgents',
            metricName: 'Invocations',
            statistic: 'Sum',
          }),
        ],
      }),
      new cloudwatch.GraphWidget({
        title: 'Success vs Errors',
        left: [
          new cloudwatch.Metric({
            namespace: 'BedrockAgents',
            metricName: 'Success',
            statistic: 'Sum',
          }),
          new cloudwatch.Metric({
            namespace: 'BedrockAgents',
            metricName: 'Errors',
            statistic: 'Sum',
          }),
        ],
      }),
      new cloudwatch.GraphWidget({
        title: 'Response Time',
        left: [durationMetric],
      })
    );

    new cdk.CfnOutput(this, 'AgentId', { value: agent.attrAgentId });
    new cdk.CfnOutput(this, 'DashboardURL', {
      value: `https://console.aws.amazon.com/cloudwatch/home?region=${cdk.Aws.REGION}#dashboards:name=${dashboard.dashboardName}`,
    });
    new cdk.CfnOutput(this, 'AlertTopicArn', { value: alertTopic.topicArn });
  }
}
