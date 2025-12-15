terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "dev"
  
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "enable_backup" {
  description = "Enable backup for resources"
  type        = bool
  default     = false
}

variable "enable_monitoring" {
  description = "Enable CloudWatch monitoring"
  type        = bool
  default     = false
}

data "aws_caller_identity" "current" {}

locals {
  instance_type = (
    var.environment == "prod" ? "t3.large" :
    var.environment == "staging" ? "t3.medium" :
    "t2.micro"
  )
  
  instance_count = var.environment == "prod" ? 3 : 1
  
  enable_encryption = var.environment == "prod" ? true : false
  
  backup_retention_days = (
    var.environment == "prod" ? 30 :
    var.environment == "staging" ? 7 :
    1
  )
  
  tags = merge(
    {
      Environment = var.environment
      ManagedBy   = "Terraform"
    },
    var.environment == "prod" ? {
      Criticality = "High"
      Backup      = "Required"
    } : {},
    var.enable_monitoring ? {
      Monitoring = "Enabled"
    } : {}
  )
}

resource "aws_s3_bucket" "conditional_demo" {
  bucket = "terraform-conditional-${var.environment}-${data.aws_caller_identity.current.account_id}"

  tags = local.tags
}

resource "aws_s3_bucket_versioning" "conditional_demo" {
  bucket = aws_s3_bucket.conditional_demo.id

  versioning_configuration {
    status = var.environment == "prod" ? "Enabled" : "Disabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "conditional_demo" {
  count  = local.enable_encryption ? 1 : 0
  bucket = aws_s3_bucket.conditional_demo.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "conditional_demo" {
  count  = var.enable_backup ? 1 : 0
  bucket = aws_s3_bucket.conditional_demo.id

  rule {
    id     = "backup-retention"
    status = "Enabled"

    transition {
      days          = local.backup_retention_days
      storage_class = "GLACIER"
    }

    expiration {
      days = local.backup_retention_days * 2
    }
  }
}

resource "aws_cloudwatch_metric_alarm" "bucket_size" {
  count               = var.enable_monitoring ? 1 : 0
  alarm_name          = "${aws_s3_bucket.conditional_demo.id}-size-alarm"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "BucketSizeBytes"
  namespace           = "AWS/S3"
  period              = "86400"
  statistic           = "Average"
  threshold           = var.environment == "prod" ? 1000000000 : 100000000
  alarm_description   = "Alert when bucket size exceeds threshold"

  dimensions = {
    BucketName  = aws_s3_bucket.conditional_demo.id
    StorageType = "StandardStorage"
  }
}

output "configuration" {
  description = "Current configuration based on conditions"
  value = {
    environment           = var.environment
    instance_type         = local.instance_type
    instance_count        = local.instance_count
    encryption_enabled    = local.enable_encryption
    backup_enabled        = var.enable_backup
    backup_retention_days = local.backup_retention_days
    monitoring_enabled    = var.enable_monitoring
    versioning_enabled    = var.environment == "prod"
  }
}

output "bucket_features" {
  description = "Enabled bucket features"
  value = {
    name               = aws_s3_bucket.conditional_demo.id
    encryption_enabled = length(aws_s3_bucket_server_side_encryption_configuration.conditional_demo) > 0
    lifecycle_enabled  = length(aws_s3_bucket_lifecycle_configuration.conditional_demo) > 0
    monitoring_enabled = length(aws_cloudwatch_metric_alarm.bucket_size) > 0
  }
}

output "cost_optimization_tips" {
  description = "Cost optimization recommendations"
  value = var.environment != "prod" ? [
    "Consider using smaller instance types",
    "Disable versioning if not needed",
    "Reduce backup retention period",
    "Use spot instances for non-critical workloads"
  ] : [
    "Current configuration is optimized for production",
    "Consider reserved instances for cost savings",
    "Review backup retention policies quarterly"
  ]
}
