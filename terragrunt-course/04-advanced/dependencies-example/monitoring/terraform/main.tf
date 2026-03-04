variable "instance_id" {
  description = "EC2 instance ID to monitor"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "alarm_threshold" {
  description = "CPU alarm threshold percentage"
  type        = number
  default     = 80
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}

resource "aws_cloudwatch_metric_alarm" "cpu" {
  alarm_name          = "${var.instance_id}-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = "120"
  statistic           = "Average"
  threshold           = var.alarm_threshold
  alarm_description   = "This metric monitors ec2 cpu utilization"
  
  dimensions = {
    InstanceId = var.instance_id
  }
  
  tags = merge(
    var.tags,
    {
      Name        = "${var.instance_id}-cpu-alarm"
      Environment = var.environment
    }
  )
}

output "alarm_arn" {
  description = "ARN of the CloudWatch alarm"
  value       = aws_cloudwatch_metric_alarm.cpu.arn
}

output "alarm_name" {
  description = "Name of the CloudWatch alarm"
  value       = aws_cloudwatch_metric_alarm.cpu.alarm_name
}
