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
exports.MonitoringPatternStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const bedrock = __importStar(require("aws-cdk-lib/aws-bedrock"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const cloudwatch = __importStar(require("aws-cdk-lib/aws-cloudwatch"));
const sns = __importStar(require("aws-cdk-lib/aws-sns"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
class MonitoringPatternStack extends cdk.Stack {
    constructor(scope, id, props) {
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
        new cdk.CfnResource(this, 'MonitoredActions', {
            type: 'AWS::Bedrock::AgentActionGroup',
            properties: {
                AgentId: agent.attrAgentId,
                AgentVersion: 'DRAFT',
                ActionGroupName: 'monitored-actions',
                ActionGroupExecutor: { Lambda: metricsLambda.functionArn },
                ApiSchema: { Payload: JSON.stringify(apiSchema) },
            },
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
        dashboard.addWidgets(new cloudwatch.GraphWidget({
            title: 'Agent Invocations',
            left: [
                new cloudwatch.Metric({
                    namespace: 'BedrockAgents',
                    metricName: 'Invocations',
                    statistic: 'Sum',
                }),
            ],
        }), new cloudwatch.GraphWidget({
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
        }), new cloudwatch.GraphWidget({
            title: 'Response Time',
            left: [durationMetric],
        }));
        new cdk.CfnOutput(this, 'AgentId', { value: agent.attrAgentId });
        new cdk.CfnOutput(this, 'DashboardURL', {
            value: `https://console.aws.amazon.com/cloudwatch/home?region=${cdk.Aws.REGION}#dashboards:name=${dashboard.dashboardName}`,
        });
        new cdk.CfnOutput(this, 'AlertTopicArn', { value: alertTopic.topicArn });
    }
}
exports.MonitoringPatternStack = MonitoringPatternStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9uaXRvcmluZy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm1vbml0b3JpbmcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBQ25DLGlFQUFtRDtBQUNuRCx5REFBMkM7QUFDM0MsK0RBQWlEO0FBQ2pELHVFQUF5RDtBQUN6RCx5REFBMkM7QUFFM0MsMkRBQTZDO0FBRzdDLE1BQWEsc0JBQXVCLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDbkQsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFzQjtRQUM5RCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixNQUFNLFVBQVUsR0FBRyxJQUFJLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLGFBQWEsRUFBRTtZQUNwRCxXQUFXLEVBQUUseUJBQXlCO1NBQ3ZDLENBQUMsQ0FBQztRQUVILE1BQU0sUUFBUSxHQUFHLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsa0JBQWtCLEVBQUU7WUFDM0QsWUFBWSxFQUFFLGdDQUFnQztZQUM5QyxTQUFTLEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxTQUFTO1lBQ3ZDLGFBQWEsRUFBRSxHQUFHLENBQUMsYUFBYSxDQUFDLE9BQU87U0FDekMsQ0FBQyxDQUFDO1FBRUgsTUFBTSxhQUFhLEdBQUcsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxrQkFBa0IsRUFBRTtZQUNsRSxPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXO1lBQ25DLE9BQU8sRUFBRSxlQUFlO1lBQ3hCLE9BQU8sRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7WUFDakMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7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SSxFQUFFLGNBQWMsRUFBRTtZQUN0QyxLQUFLLEVBQUUseURBQXlELEdBQUcsQ0FBQyxHQUFHLENBQUMsTUFBTSxvQkFBb0IsU0FBUyxDQUFDLGFBQWEsRUFBRTtTQUM1SCxDQUFDLENBQUM7UUFDSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGVBQWUsRUFBRSxFQUFFLEtBQUssRUFBRSxVQUFVLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQztJQUMzRSxDQUFDO0NBQ0Y7QUF0VUQsd0RBc1VDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGJlZHJvY2sgZnJvbSAnYXdzLWNkay1saWIvYXdzLWJlZHJvY2snO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgY2xvdWR3YXRjaCBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWR3YXRjaCc7XG5pbXBvcnQgKiBhcyBzbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNucyc7XG5pbXBvcnQgKiBhcyBzdWJzY3JpcHRpb25zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zbnMtc3Vic2NyaXB0aW9ucyc7XG5pbXBvcnQgKiBhcyBsb2dzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sb2dzJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuXG5leHBvcnQgY2xhc3MgTW9uaXRvcmluZ1BhdHRlcm5TdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzPzogY2RrLlN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIGNvbnN0IGFsZXJ0VG9waWMgPSBuZXcgc25zLlRvcGljKHRoaXMsICdBZ2VudEFsZXJ0cycsIHtcbiAgICAgIGRpc3BsYXlOYW1lOiAnQWdlbnQgTW9uaXRvcmluZyBBbGVydHMnLFxuICAgIH0pO1xuXG4gICAgY29uc3QgbG9nR3JvdXAgPSBuZXcgbG9ncy5Mb2dHcm91cCh0aGlzLCAnQWdlbnRNZXRyaWNzTG9ncycsIHtcbiAgICAgIGxvZ0dyb3VwTmFtZTogJy9hd3MvYmVkcm9jay9hZ2VudHMvbW9uaXRvcmluZycsXG4gICAgICByZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5UV09fV0VFS1MsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pO1xuXG4gICAgY29uc3QgbWV0cmljc0xhbWJkYSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ01ldHJpY3NDb2xsZWN0b3InLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5QWVRIT05fM18xMixcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21JbmxpbmUoYFxuaW1wb3J0IGpzb25cbmltcG9ydCBsb2dnaW5nXG5pbXBvcnQgdGltZVxuZnJvbSBkYXRldGltZSBpbXBvcnQgZGF0ZXRpbWVcbmltcG9ydCBib3RvM1xuXG5sb2dnZXIgPSBsb2dnaW5nLmdldExvZ2dlcigpXG5sb2dnZXIuc2V0TGV2ZWwobG9nZ2luZy5JTkZPKVxuXG5jbG91ZHdhdGNoID0gYm90bzMuY2xpZW50KCdjbG91ZHdhdGNoJylcblxuY2xhc3MgTWV0cmljc0NvbGxlY3RvcjpcbiAgICBcIlwiXCJDb2xsZWN0IGFuZCBwdWJsaXNoIGN1c3RvbSBtZXRyaWNzXCJcIlwiXG4gICAgXG4gICAgZGVmIF9faW5pdF9fKHNlbGYsIG5hbWVzcGFjZT0nQmVkcm9ja0FnZW50cycpOlxuICAgICAgICBzZWxmLm5hbWVzcGFjZSA9IG5hbWVzcGFjZVxuICAgIFxuICAgIGRlZiByZWNvcmRfaW52b2NhdGlvbihzZWxmLCBhZ2VudF9pZDogc3RyLCBhY3Rpb246IHN0ciwgZHVyYXRpb246IGZsb2F0LCBcbiAgICAgICAgICAgICAgICAgICAgICAgICBzdWNjZXNzOiBib29sLCBzZXNzaW9uX2lkOiBzdHIpOlxuICAgICAgICBcIlwiXCJSZWNvcmQgYWdlbnQgaW52b2NhdGlvbiBtZXRyaWNzXCJcIlwiXG4gICAgICAgIG1ldHJpY3MgPSBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgJ01ldHJpY05hbWUnOiAnSW52b2NhdGlvbnMnLFxuICAgICAgICAgICAgICAgICdWYWx1ZSc6IDEsXG4gICAgICAgICAgICAgICAgJ1VuaXQnOiAnQ291bnQnLFxuICAgICAgICAgICAgICAgICdUaW1lc3RhbXAnOiBkYXRldGltZS51dGNub3coKSxcbiAgICAgICAgICAgICAgICAnRGltZW5zaW9ucyc6IFtcbiAgICAgICAgICAgICAgICAgICAgeydOYW1lJzogJ0FnZW50SWQnLCAnVmFsdWUnOiBhZ2VudF9pZH0sXG4gICAgICAgICAgICAgICAgICAgIHsnTmFtZSc6ICdBY3Rpb24nLCAnVmFsdWUnOiBhY3Rpb259LFxuICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgJ01ldHJpY05hbWUnOiAnRHVyYXRpb24nLFxuICAgICAgICAgICAgICAgICdWYWx1ZSc6IGR1cmF0aW9uLFxuICAgICAgICAgICAgICAgICdVbml0JzogJ01pbGxpc2Vjb25kcycsXG4gICAgICAgICAgICAgICAgJ1RpbWVzdGFtcCc6IGRhdGV0aW1lLnV0Y25vdygpLFxuICAgICAgICAgICAgICAgICdEaW1lbnNpb25zJzogW1xuICAgICAgICAgICAgICAgICAgICB7J05hbWUnOiAnQWdlbnRJZCcsICdWYWx1ZSc6IGFnZW50X2lkfSxcbiAgICAgICAgICAgICAgICAgICAgeydOYW1lJzogJ0FjdGlvbicsICdWYWx1ZSc6IGFjdGlvbn0sXG4gICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAnTWV0cmljTmFtZSc6ICdTdWNjZXNzJyBpZiBzdWNjZXNzIGVsc2UgJ0Vycm9ycycsXG4gICAgICAgICAgICAgICAgJ1ZhbHVlJzogMSxcbiAgICAgICAgICAgICAgICAnVW5pdCc6ICdDb3VudCcsXG4gICAgICAgICAgICAgICAgJ1RpbWVzdGFtcCc6IGRhdGV0aW1lLnV0Y25vdygpLFxuICAgICAgICAgICAgICAgICdEaW1lbnNpb25zJzogW1xuICAgICAgICAgICAgICAgICAgICB7J05hbWUnOiAnQWdlbnRJZCcsICdWYWx1ZSc6IGFnZW50X2lkfSxcbiAgICAgICAgICAgICAgICAgICAgeydOYW1lJzogJ0FjdGlvbicsICdWYWx1ZSc6IGFjdGlvbn0sXG4gICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgfVxuICAgICAgICBdXG4gICAgICAgIFxuICAgICAgICB0cnk6XG4gICAgICAgICAgICBjbG91ZHdhdGNoLnB1dF9tZXRyaWNfZGF0YShcbiAgICAgICAgICAgICAgICBOYW1lc3BhY2U9c2VsZi5uYW1lc3BhY2UsXG4gICAgICAgICAgICAgICAgTWV0cmljRGF0YT1tZXRyaWNzXG4gICAgICAgICAgICApXG4gICAgICAgIGV4Y2VwdCBFeGNlcHRpb24gYXMgZTpcbiAgICAgICAgICAgIGxvZ2dlci5lcnJvcihmJ0ZhaWxlZCB0byBwdWJsaXNoIG1ldHJpY3M6IHtzdHIoZSl9JylcblxubWV0cmljc19jb2xsZWN0b3IgPSBNZXRyaWNzQ29sbGVjdG9yKClcblxuZGVmIGhhbmRsZXIoZXZlbnQsIGNvbnRleHQpOlxuICAgIFwiXCJcIlxuICAgIEFjdGlvbiBoYW5kbGVyIHdpdGggY29tcHJlaGVuc2l2ZSBtb25pdG9yaW5nXG4gICAgXCJcIlwiXG4gICAgc3RhcnRfdGltZSA9IHRpbWUudGltZSgpXG4gICAgYWN0aW9uID0gZXZlbnQuZ2V0KCdhY3Rpb25Hcm91cCcsICd1bmtub3duJylcbiAgICBhcGlfcGF0aCA9IGV2ZW50LmdldCgnYXBpUGF0aCcsICd1bmtub3duJylcbiAgICBzZXNzaW9uX2lkID0gZXZlbnQuZ2V0KCdzZXNzaW9uSWQnLCAndW5rbm93bicpXG4gICAgYWdlbnRfaWQgPSBldmVudC5nZXQoJ2FnZW50Jywge30pLmdldCgnYWdlbnRJZCcsICd1bmtub3duJylcbiAgICBcbiAgICBsb2dnZXIuaW5mbyhqc29uLmR1bXBzKHtcbiAgICAgICAgJ2V2ZW50X3R5cGUnOiAnaW52b2NhdGlvbl9zdGFydCcsXG4gICAgICAgICd0aW1lc3RhbXAnOiBkYXRldGltZS51dGNub3coKS5pc29mb3JtYXQoKSxcbiAgICAgICAgJ2FnZW50X2lkJzogYWdlbnRfaWQsXG4gICAgICAgICdhY3Rpb24nOiBhY3Rpb24sXG4gICAgICAgICdhcGlfcGF0aCc6IGFwaV9wYXRoLFxuICAgICAgICAnc2Vzc2lvbl9pZCc6IHNlc3Npb25faWQsXG4gICAgfSkpXG4gICAgXG4gICAgc3VjY2VzcyA9IEZhbHNlXG4gICAgc3RhdHVzX2NvZGUgPSA1MDBcbiAgICByZXNwb25zZV9ib2R5ID0ge31cbiAgICBcbiAgICB0cnk6XG4gICAgICAgIHBhcmFtZXRlcnMgPSBldmVudC5nZXQoJ3BhcmFtZXRlcnMnLCBbXSlcbiAgICAgICAgXG4gICAgICAgIGlmIGFwaV9wYXRoID09ICcvcHJvY2Vzcy1kYXRhJzpcbiAgICAgICAgICAgIHBhcmFtX3ZhbHVlID0gbmV4dCgocFsndmFsdWUnXSBmb3IgcCBpbiBwYXJhbWV0ZXJzIGlmIHBbJ25hbWUnXSA9PSAnZGF0YScpLCBOb25lKVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiBub3QgcGFyYW1fdmFsdWU6XG4gICAgICAgICAgICAgICAgcmFpc2UgVmFsdWVFcnJvcignTWlzc2luZyByZXF1aXJlZCBwYXJhbWV0ZXI6IGRhdGEnKVxuICAgICAgICAgICAgXG4gICAgICAgICAgICByZXN1bHQgPSB7XG4gICAgICAgICAgICAgICAgJ3Byb2Nlc3NlZCc6IFRydWUsXG4gICAgICAgICAgICAgICAgJ2RhdGEnOiBwYXJhbV92YWx1ZSxcbiAgICAgICAgICAgICAgICAndGltZXN0YW1wJzogZGF0ZXRpbWUudXRjbm93KCkuaXNvZm9ybWF0KClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgcmVzcG9uc2VfYm9keSA9IHJlc3VsdFxuICAgICAgICAgICAgc3RhdHVzX2NvZGUgPSAyMDBcbiAgICAgICAgICAgIHN1Y2Nlc3MgPSBUcnVlXG4gICAgICAgIFxuICAgICAgICBlbGlmIGFwaV9wYXRoID09ICcvaGVhbHRoLWNoZWNrJzpcbiAgICAgICAgICAgIHJlc3BvbnNlX2JvZHkgPSB7XG4gICAgICAgICAgICAgICAgJ3N0YXR1cyc6ICdoZWFsdGh5JyxcbiAgICAgICAgICAgICAgICAndGltZXN0YW1wJzogZGF0ZXRpbWUudXRjbm93KCkuaXNvZm9ybWF0KClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHN0YXR1c19jb2RlID0gMjAwXG4gICAgICAgICAgICBzdWNjZXNzID0gVHJ1ZVxuICAgICAgICBcbiAgICAgICAgZWxzZTpcbiAgICAgICAgICAgIHJlc3BvbnNlX2JvZHkgPSB7J2Vycm9yJzogJ1Vua25vd24gQVBJIHBhdGgnfVxuICAgICAgICAgICAgc3RhdHVzX2NvZGUgPSA0MDRcbiAgICBcbiAgICBleGNlcHQgRXhjZXB0aW9uIGFzIGU6XG4gICAgICAgIGxvZ2dlci5lcnJvcihqc29uLmR1bXBzKHtcbiAgICAgICAgICAgICdldmVudF90eXBlJzogJ2Vycm9yJyxcbiAgICAgICAgICAgICd0aW1lc3RhbXAnOiBkYXRldGltZS51dGNub3coKS5pc29mb3JtYXQoKSxcbiAgICAgICAgICAgICdhZ2VudF9pZCc6IGFnZW50X2lkLFxuICAgICAgICAgICAgJ2FjdGlvbic6IGFjdGlvbixcbiAgICAgICAgICAgICdlcnJvcic6IHN0cihlKSxcbiAgICAgICAgICAgICdzZXNzaW9uX2lkJzogc2Vzc2lvbl9pZCxcbiAgICAgICAgfSkpXG4gICAgICAgIHJlc3BvbnNlX2JvZHkgPSB7J2Vycm9yJzogc3RyKGUpfVxuICAgICAgICBzdGF0dXNfY29kZSA9IDUwMFxuICAgIFxuICAgIGZpbmFsbHk6XG4gICAgICAgIGR1cmF0aW9uID0gKHRpbWUudGltZSgpIC0gc3RhcnRfdGltZSkgKiAxMDAwXG4gICAgICAgIFxuICAgICAgICBtZXRyaWNzX2NvbGxlY3Rvci5yZWNvcmRfaW52b2NhdGlvbihcbiAgICAgICAgICAgIGFnZW50X2lkPWFnZW50X2lkLFxuICAgICAgICAgICAgYWN0aW9uPWFjdGlvbixcbiAgICAgICAgICAgIGR1cmF0aW9uPWR1cmF0aW9uLFxuICAgICAgICAgICAgc3VjY2Vzcz1zdWNjZXNzLFxuICAgICAgICAgICAgc2Vzc2lvbl9pZD1zZXNzaW9uX2lkXG4gICAgICAgIClcbiAgICAgICAgXG4gICAgICAgIGxvZ2dlci5pbmZvKGpzb24uZHVtcHMoe1xuICAgICAgICAgICAgJ2V2ZW50X3R5cGUnOiAnaW52b2NhdGlvbl9jb21wbGV0ZScsXG4gICAgICAgICAgICAndGltZXN0YW1wJzogZGF0ZXRpbWUudXRjbm93KCkuaXNvZm9ybWF0KCksXG4gICAgICAgICAgICAnYWdlbnRfaWQnOiBhZ2VudF9pZCxcbiAgICAgICAgICAgICdhY3Rpb24nOiBhY3Rpb24sXG4gICAgICAgICAgICAnZHVyYXRpb25fbXMnOiBkdXJhdGlvbixcbiAgICAgICAgICAgICdzdWNjZXNzJzogc3VjY2VzcyxcbiAgICAgICAgICAgICdzdGF0dXNfY29kZSc6IHN0YXR1c19jb2RlLFxuICAgICAgICAgICAgJ3Nlc3Npb25faWQnOiBzZXNzaW9uX2lkLFxuICAgICAgICB9KSlcbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgICAnbWVzc2FnZVZlcnNpb24nOiAnMS4wJyxcbiAgICAgICAgJ3Jlc3BvbnNlJzoge1xuICAgICAgICAgICAgJ2FjdGlvbkdyb3VwJzogYWN0aW9uLFxuICAgICAgICAgICAgJ2FwaVBhdGgnOiBhcGlfcGF0aCxcbiAgICAgICAgICAgICdodHRwU3RhdHVzQ29kZSc6IHN0YXR1c19jb2RlLFxuICAgICAgICAgICAgJ3Jlc3BvbnNlQm9keSc6IHtcbiAgICAgICAgICAgICAgICAnYXBwbGljYXRpb24vanNvbic6IHtcbiAgICAgICAgICAgICAgICAgICAgJ2JvZHknOiBqc29uLmR1bXBzKHJlc3BvbnNlX2JvZHkpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgICAgYCksXG4gICAgfSk7XG5cbiAgICBtZXRyaWNzTGFtYmRhLmFkZFRvUm9sZVBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICBhY3Rpb25zOiBbJ2Nsb3Vkd2F0Y2g6UHV0TWV0cmljRGF0YSddLFxuICAgICAgcmVzb3VyY2VzOiBbJyonXSxcbiAgICB9KSk7XG5cbiAgICBjb25zdCBhZ2VudFJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ0FnZW50Um9sZScsIHtcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdiZWRyb2NrLmFtYXpvbmF3cy5jb20nKSxcbiAgICB9KTtcblxuICAgIGFnZW50Um9sZS5hZGRUb1BvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICBhY3Rpb25zOiBbJ2JlZHJvY2s6SW52b2tlTW9kZWwnXSxcbiAgICAgIHJlc291cmNlczogWycqJ10sXG4gICAgfSkpO1xuXG4gICAgbWV0cmljc0xhbWJkYS5ncmFudEludm9rZShhZ2VudFJvbGUpO1xuXG4gICAgY29uc3QgYWdlbnQgPSBuZXcgYmVkcm9jay5DZm5BZ2VudCh0aGlzLCAnTW9uaXRvcmVkQWdlbnQnLCB7XG4gICAgICBhZ2VudE5hbWU6ICdtb25pdG9yZWQtYWdlbnQnLFxuICAgICAgYWdlbnRSZXNvdXJjZVJvbGVBcm46IGFnZW50Um9sZS5yb2xlQXJuLFxuICAgICAgZm91bmRhdGlvbk1vZGVsOiAnYW50aHJvcGljLmNsYXVkZS0zLXNvbm5ldC0yMDI0MDIyOS12MTowJyxcbiAgICAgIGluc3RydWN0aW9uOiAnWW91IGFyZSBhIG1vbml0b3JlZCBhZ2VudC4gQWxsIHlvdXIgYWN0aW9ucyBhcmUgdHJhY2tlZCBhbmQgbWVhc3VyZWQuJyxcbiAgICB9KTtcblxuICAgIGNvbnN0IGFwaVNjaGVtYSA9IHtcbiAgICAgIG9wZW5hcGk6ICczLjAuMCcsXG4gICAgICBpbmZvOiB7IHRpdGxlOiAnTW9uaXRvcmVkIEFQSScsIHZlcnNpb246ICcxLjAuMCcgfSxcbiAgICAgIHBhdGhzOiB7XG4gICAgICAgICcvcHJvY2Vzcy1kYXRhJzoge1xuICAgICAgICAgIHBvc3Q6IHtcbiAgICAgICAgICAgIHN1bW1hcnk6ICdQcm9jZXNzIGRhdGEnLFxuICAgICAgICAgICAgb3BlcmF0aW9uSWQ6ICdwcm9jZXNzRGF0YScsXG4gICAgICAgICAgICBwYXJhbWV0ZXJzOiBbXG4gICAgICAgICAgICAgIHsgbmFtZTogJ2RhdGEnLCBpbjogJ3F1ZXJ5JywgcmVxdWlyZWQ6IHRydWUsIHNjaGVtYTogeyB0eXBlOiAnc3RyaW5nJyB9IH0sXG4gICAgICAgICAgICBdLFxuICAgICAgICAgICAgcmVzcG9uc2VzOiB7ICcyMDAnOiB7IGRlc2NyaXB0aW9uOiAnRGF0YSBwcm9jZXNzZWQnIH0gfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICAnL2hlYWx0aC1jaGVjayc6IHtcbiAgICAgICAgICBnZXQ6IHtcbiAgICAgICAgICAgIHN1bW1hcnk6ICdIZWFsdGggY2hlY2snLFxuICAgICAgICAgICAgb3BlcmF0aW9uSWQ6ICdoZWFsdGhDaGVjaycsXG4gICAgICAgICAgICByZXNwb25zZXM6IHsgJzIwMCc6IHsgZGVzY3JpcHRpb246ICdTZXJ2aWNlIGhlYWx0aHknIH0gfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9O1xuXG4gICAgbmV3IGNkay5DZm5SZXNvdXJjZSh0aGlzLCAnTW9uaXRvcmVkQWN0aW9ucycsIHtcbiAgICAgIHR5cGU6ICdBV1M6OkJlZHJvY2s6OkFnZW50QWN0aW9uR3JvdXAnLFxuICAgICAgcHJvcGVydGllczoge1xuICAgICAgICBBZ2VudElkOiBhZ2VudC5hdHRyQWdlbnRJZCxcbiAgICAgICAgQWdlbnRWZXJzaW9uOiAnRFJBRlQnLFxuICAgICAgICBBY3Rpb25Hcm91cE5hbWU6ICdtb25pdG9yZWQtYWN0aW9ucycsXG4gICAgICAgIEFjdGlvbkdyb3VwRXhlY3V0b3I6IHsgTGFtYmRhOiBtZXRyaWNzTGFtYmRhLmZ1bmN0aW9uQXJuIH0sXG4gICAgICAgIEFwaVNjaGVtYTogeyBQYXlsb2FkOiBKU09OLnN0cmluZ2lmeShhcGlTY2hlbWEpIH0sXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgY29uc3QgZXJyb3JNZXRyaWMgPSBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgbmFtZXNwYWNlOiAnQmVkcm9ja0FnZW50cycsXG4gICAgICBtZXRyaWNOYW1lOiAnRXJyb3JzJyxcbiAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgIH0pO1xuXG4gICAgY29uc3QgZXJyb3JBbGFybSA9IG5ldyBjbG91ZHdhdGNoLkFsYXJtKHRoaXMsICdIaWdoRXJyb3JSYXRlJywge1xuICAgICAgbWV0cmljOiBlcnJvck1ldHJpYyxcbiAgICAgIHRocmVzaG9sZDogMTAsXG4gICAgICBldmFsdWF0aW9uUGVyaW9kczogMixcbiAgICAgIGFsYXJtRGVzY3JpcHRpb246ICdBbGVydCB3aGVuIGFnZW50IGVycm9yIHJhdGUgaXMgaGlnaCcsXG4gICAgICBhbGFybU5hbWU6ICdhZ2VudC1oaWdoLWVycm9yLXJhdGUnLFxuICAgIH0pO1xuXG4gICAgZXJyb3JBbGFybS5hZGRBbGFybUFjdGlvbih7XG4gICAgICBiaW5kOiAoKSA9PiAoeyBhbGFybUFjdGlvbkFybjogYWxlcnRUb3BpYy50b3BpY0FybiB9KSxcbiAgICB9KTtcblxuICAgIGNvbnN0IGR1cmF0aW9uTWV0cmljID0gbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgIG5hbWVzcGFjZTogJ0JlZHJvY2tBZ2VudHMnLFxuICAgICAgbWV0cmljTmFtZTogJ0R1cmF0aW9uJyxcbiAgICAgIHN0YXRpc3RpYzogJ0F2ZXJhZ2UnLFxuICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICB9KTtcblxuICAgIGNvbnN0IGxhdGVuY3lBbGFybSA9IG5ldyBjbG91ZHdhdGNoLkFsYXJtKHRoaXMsICdIaWdoTGF0ZW5jeScsIHtcbiAgICAgIG1ldHJpYzogZHVyYXRpb25NZXRyaWMsXG4gICAgICB0aHJlc2hvbGQ6IDUwMDAsXG4gICAgICBldmFsdWF0aW9uUGVyaW9kczogMixcbiAgICAgIGFsYXJtRGVzY3JpcHRpb246ICdBbGVydCB3aGVuIGFnZW50IGxhdGVuY3kgaXMgaGlnaCcsXG4gICAgICBhbGFybU5hbWU6ICdhZ2VudC1oaWdoLWxhdGVuY3knLFxuICAgIH0pO1xuXG4gICAgbGF0ZW5jeUFsYXJtLmFkZEFsYXJtQWN0aW9uKHtcbiAgICAgIGJpbmQ6ICgpID0+ICh7IGFsYXJtQWN0aW9uQXJuOiBhbGVydFRvcGljLnRvcGljQXJuIH0pLFxuICAgIH0pO1xuXG4gICAgY29uc3QgZGFzaGJvYXJkID0gbmV3IGNsb3Vkd2F0Y2guRGFzaGJvYXJkKHRoaXMsICdBZ2VudERhc2hib2FyZCcsIHtcbiAgICAgIGRhc2hib2FyZE5hbWU6ICdiZWRyb2NrLWFnZW50LW1vbml0b3JpbmcnLFxuICAgIH0pO1xuXG4gICAgZGFzaGJvYXJkLmFkZFdpZGdldHMoXG4gICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICAgIHRpdGxlOiAnQWdlbnQgSW52b2NhdGlvbnMnLFxuICAgICAgICBsZWZ0OiBbXG4gICAgICAgICAgbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICAgIG5hbWVzcGFjZTogJ0JlZHJvY2tBZ2VudHMnLFxuICAgICAgICAgICAgbWV0cmljTmFtZTogJ0ludm9jYXRpb25zJyxcbiAgICAgICAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICAgICAgfSksXG4gICAgICAgIF0sXG4gICAgICB9KSxcbiAgICAgIG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgICAgdGl0bGU6ICdTdWNjZXNzIHZzIEVycm9ycycsXG4gICAgICAgIGxlZnQ6IFtcbiAgICAgICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgICAgbmFtZXNwYWNlOiAnQmVkcm9ja0FnZW50cycsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiAnU3VjY2VzcycsXG4gICAgICAgICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgICBuYW1lc3BhY2U6ICdCZWRyb2NrQWdlbnRzJyxcbiAgICAgICAgICAgIG1ldHJpY05hbWU6ICdFcnJvcnMnLFxuICAgICAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgICAgICB9KSxcbiAgICAgICAgXSxcbiAgICAgIH0pLFxuICAgICAgbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgICB0aXRsZTogJ1Jlc3BvbnNlIFRpbWUnLFxuICAgICAgICBsZWZ0OiBbZHVyYXRpb25NZXRyaWNdLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FnZW50SWQnLCB7IHZhbHVlOiBhZ2VudC5hdHRyQWdlbnRJZCB9KTtcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRGFzaGJvYXJkVVJMJywge1xuICAgICAgdmFsdWU6IGBodHRwczovL2NvbnNvbGUuYXdzLmFtYXpvbi5jb20vY2xvdWR3YXRjaC9ob21lP3JlZ2lvbj0ke2Nkay5Bd3MuUkVHSU9OfSNkYXNoYm9hcmRzOm5hbWU9JHtkYXNoYm9hcmQuZGFzaGJvYXJkTmFtZX1gLFxuICAgIH0pO1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBbGVydFRvcGljQXJuJywgeyB2YWx1ZTogYWxlcnRUb3BpYy50b3BpY0FybiB9KTtcbiAgfVxufVxuIl19