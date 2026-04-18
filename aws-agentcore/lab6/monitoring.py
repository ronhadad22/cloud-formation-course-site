"""
Lab 6: Production Monitoring Setup
Configure LangSmith and CloudWatch for production observability.
"""

import os
import json
import boto3
from datetime import datetime, timedelta
from langsmith import Client
from typing import List, Dict

# Configuration
LANGSMITH_PROJECT = "agentcore-production"
CLOUDWATCH_NAMESPACE = "AgentCore/LangGraph"
AGENT_NAME = "my-langgraph-agent"

class AgentMonitor:
    """Monitoring setup for production LangGraph agents on AgentCore."""
    
    def __init__(self):
        self.langsmith_client = Client()
        self.cloudwatch = boto3.client('cloudwatch', region_name='us-east-1')
        self.logs = boto3.client('logs', region_name='us-east-1')
    
    def setup_langsmith_project(self):
        """Create a dedicated production project in LangSmith."""
        print("🔧 Setting up LangSmith project...")
        
        try:
            # List existing projects
            projects = list(self.langsmith_client.list_projects())
            project_names = [p.name for p in projects]
            
            if LANGSMITH_PROJECT in project_names:
                print(f"  ℹ️  Project '{LANGSMITH_PROJECT}' already exists")
            else:
                # Create new project
                project = self.langsmith_client.create_project(
                    project_name=LANGSMITH_PROJECT,
                    description="Production monitoring for AgentCore LangGraph agents"
                )
                print(f"  ✅ Created LangSmith project: {LANGSMITH_PROJECT}")
            
            # Set project as default
            os.environ["LANGSMITH_PROJECT"] = LANGSMITH_PROJECT
            print(f"  ✅ Set as default project")
            
            return True
            
        except Exception as e:
            print(f"  ❌ Error setting up LangSmith: {e}")
            return False
    
    def create_cloudwatch_dashboard(self):
        """Create a CloudWatch dashboard for agent metrics."""
        print("\n📊 Creating CloudWatch dashboard...")
        
        dashboard_name = f"AgentCore-{AGENT_NAME}-Production"
        
        dashboard_body = {
            "widgets": [
                # Title
                {
                    "type": "text",
                    "x": 0,
                    "y": 0,
                    "width": 24,
                    "height": 1,
                    "properties": {
                        "markdown": f"# 🤖 {AGENT_NAME} - Production Dashboard"
                    }
                },
                # Latency metric
                {
                    "type": "metric",
                    "x": 0,
                    "y": 1,
                    "width": 8,
                    "height": 6,
                    "properties": {
                        "title": "Response Latency (seconds)",
                        "metrics": [
                            [CLOUDWATCH_NAMESPACE, "ResponseTime", "Agent", AGENT_NAME, {"stat": "Average"}],
                            ["...", {"stat": "p99"}],
                            ["...", {"stat": "p95"}]
                        ],
                        "period": 60,
                        "yAxis": {
                            "left": {"min": 0}
                        }
                    }
                },
                # Token usage
                {
                    "type": "metric",
                    "x": 8,
                    "y": 1,
                    "width": 8,
                    "height": 6,
                    "properties": {
                        "title": "Token Usage",
                        "metrics": [
                            [CLOUDWATCH_NAMESPACE, "InputTokens", "Agent", AGENT_NAME, {"stat": "Sum"}],
                            [".", "OutputTokens", ".", ".", {"stat": "Sum"}]
                        ],
                        "period": 300
                    }
                },
                # Request count
                {
                    "type": "metric",
                    "x": 16,
                    "y": 1,
                    "width": 8,
                    "height": 6,
                    "properties": {
                        "title": "Request Count",
                        "metrics": [
                            [CLOUDWATCH_NAMESPACE, "RequestCount", "Agent", AGENT_NAME, {"stat": "Sum"}]
                        ],
                        "period": 60
                    }
                },
                # Error rate
                {
                    "type": "metric",
                    "x": 0,
                    "y": 7,
                    "width": 12,
                    "height": 6,
                    "properties": {
                        "title": "Error Rate",
                        "metrics": [
                            [CLOUDWATCH_NAMESPACE, "Errors", "Agent", AGENT_NAME, {"stat": "Sum"}],
                            [".", "ErrorRate", ".", ".", {"stat": "Average", "yAxis": "right"}]
                        ],
                        "annotations": {
                            "horizontal": [
                                {"value": 0.05, "label": "Alert threshold", "color": "#ff0000"}
                            ]
                        }
                    }
                },
                # Memory usage
                {
                    "type": "metric",
                    "x": 12,
                    "y": 7,
                    "width": 12,
                    "height": 6,
                    "properties": {
                        "title": "Memory Usage",
                        "metrics": [
                            [CLOUDWATCH_NAMESPACE, "MemoryUsed", "Agent", AGENT_NAME, {"stat": "Average"}],
                            ["...", {"stat": "Maximum"}]
                        ],
                        "period": 60
                    }
                }
            ]
        }
        
        try:
            self.cloudwatch.put_dashboard(
                DashboardName=dashboard_name,
                DashboardBody=json.dumps(dashboard_body)
            )
            print(f"  ✅ Created dashboard: {dashboard_name}")
            print(f"  🔗 View at: https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name={dashboard_name}")
            return True
        except Exception as e:
            print(f"  ❌ Error creating dashboard: {e}")
            return False
    
    def setup_alarms(self):
        """Set up CloudWatch alarms for critical metrics."""
        print("\n🚨 Setting up CloudWatch alarms...")
        
        alarms = [
            {
                "name": f"{AGENT_NAME}-HighLatency",
                "metric": "ResponseTime",
                "threshold": 5.0,  # 5 seconds
                "evaluation_periods": 2,
                "comparison": "GreaterThanThreshold",
                "description": "Alert when agent response time exceeds 5 seconds"
            },
            {
                "name": f"{AGENT_NAME}-HighErrorRate",
                "metric": "ErrorRate",
                "threshold": 0.05,  # 5%
                "evaluation_periods": 2,
                "comparison": "GreaterThanThreshold",
                "description": "Alert when error rate exceeds 5%"
            },
            {
                "name": f"{AGENT_NAME}-LowMemory",
                "metric": "MemoryUsed",
                "threshold": 900,  # 900MB
                "evaluation_periods": 1,
                "comparison": "GreaterThanThreshold",
                "description": "Alert when memory usage exceeds 900MB"
            }
        ]
        
        for alarm in alarms:
            try:
                self.cloudwatch.put_metric_alarm(
                    AlarmName=alarm["name"],
                    ComparisonOperator=alarm["comparison"],
                    EvaluationPeriods=alarm["evaluation_periods"],
                    MetricName=alarm["metric"],
                    Namespace=CLOUDWATCH_NAMESPACE,
                    Dimensions=[
                        {"Name": "Agent", "Value": AGENT_NAME}
                    ],
                    Period=60,
                    Statistic="Average",
                    Threshold=alarm["threshold"],
                    ActionsEnabled=True,
                    AlarmDescription=alarm["description"],
                    Tags=[
                        {"Key": "Project", "Value": "AgentCoreLab"},
                        {"Key": "Environment", "Value": "Production"}
                    ]
                )
                print(f"  ✅ Created alarm: {alarm['name']}")
            except Exception as e:
                print(f"  ❌ Error creating alarm {alarm['name']}: {e}")
    
    def setup_log_retention(self):
        """Set up CloudWatch Logs retention policy."""
        print("\n📝 Setting up log retention...")
        
        log_groups = [
            f"/aws/agentcore/{AGENT_NAME}",
            "/aws/lambda/my-langgraph-agent"  # Lambda log group
        ]
        
        for log_group in log_groups:
            try:
                self.logs.put_retention_policy(
                    logGroupName=log_group,
                    retentionInDays=7  # Keep logs for 7 days
                )
                print(f"  ✅ Set retention for {log_group}")
            except self.logs.exceptions.ResourceNotFoundException:
                print(f"  ℹ️  Log group not yet created: {log_group}")
            except Exception as e:
                print(f"  ❌ Error setting retention: {e}")
    
    def generate_sample_metrics(self):
        """Generate sample metrics for testing the dashboard."""
        print("\n📈 Generating sample metrics...")
        
        now = datetime.utcnow()
        
        metrics_data = [
            {
                "MetricName": "ResponseTime",
                "Value": 2.5,
                "Unit": "Seconds",
                "Timestamp": now
            },
            {
                "MetricName": "RequestCount",
                "Value": 1,
                "Unit": "Count",
                "Timestamp": now
            },
            {
                "MetricName": "InputTokens",
                "Value": 500,
                "Unit": "Count",
                "Timestamp": now
            },
            {
                "MetricName": "OutputTokens",
                "Value": 200,
                "Unit": "Count",
                "Timestamp": now
            }
        ]
        
        try:
            self.cloudwatch.put_metric_data(
                Namespace=CLOUDWATCH_NAMESPACE,
                MetricData=[
                    {**m, "Dimensions": [{"Name": "Agent", "Value": AGENT_NAME}]}
                    for m in metrics_data
                ]
            )
            print(f"  ✅ Published sample metrics")
        except Exception as e:
            print(f"  ❌ Error publishing metrics: {e}")
    
    def create_monitoring_report(self):
        """Create a monitoring report with all URLs and settings."""
        report = f"""
================================================================================
                     AGENT MONITORING SETUP COMPLETE
================================================================================

📊 Dashboards:
   LangSmith:   https://smith.langchain.com/o/default/projects/{LANGSMITH_PROJECT}
   CloudWatch:  https://console.aws.amazon.com/cloudwatch/home?region=us-east-1

🚨 Alarms:
   HighLatency:   Triggers when response time > 5s
   HighErrorRate: Triggers when error rate > 5%
   LowMemory:     Triggers when memory > 900MB

📝 Log Groups:
   /aws/agentcore/{AGENT_NAME}
   Retention: 7 days

🔧 Environment Variables (set these in production):
   export LANGSMITH_API_KEY="your-key"
   export LANGSMITH_PROJECT="{LANGSMITH_PROJECT}"
   export LANGSMITH_TRACING_V2="true"

📊 To publish custom metrics from your agent:
   
   import boto3
   cloudwatch = boto3.client('cloudwatch')
   cloudwatch.put_metric_data(
       Namespace='{CLOUDWATCH_NAMESPACE}',
       MetricData=[{{
           'MetricName': 'CustomMetric',
           'Value': 123,
           'Unit': 'Count',
           'Dimensions': [{{'Name': 'Agent', 'Value': '{AGENT_NAME}'}}]
       }}]
   )

================================================================================
        """
        return report

def main():
    """Run the monitoring setup."""
    print("=" * 70)
    print("         LAB 6: PRODUCTION MONITORING SETUP")
    print("=" * 70)
    print()
    
    monitor = AgentMonitor()
    
    # Setup steps
    monitor.setup_langsmith_project()
    monitor.create_cloudwatch_dashboard()
    monitor.setup_alarms()
    monitor.setup_log_retention()
    monitor.generate_sample_metrics()
    
    # Print report
    print("\n" + monitor.create_monitoring_report())
    
    print("✅ Lab 6 complete!")
    print()
    print("Next steps:")
    print("  1. Open the LangSmith dashboard to see your project")
    print("  2. View the CloudWatch dashboard for metrics")
    print("  3. Deploy your agent and watch metrics flow in!")

if __name__ == "__main__":
    main()
