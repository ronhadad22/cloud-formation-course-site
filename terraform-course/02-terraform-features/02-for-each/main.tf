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

variable "user_names" {
  description = "Set of IAM user names to create"
  type        = set(string)
  default     = ["alice", "bob", "charlie"]
}

variable "project_buckets" {
  description = "Map of project buckets to create"
  type = map(object({
    versioning_enabled = bool
    lifecycle_days     = number
  }))
  default = {
    frontend = {
      versioning_enabled = true
      lifecycle_days     = 30
    }
    backend = {
      versioning_enabled = true
      lifecycle_days     = 90
    }
    analytics = {
      versioning_enabled = false
      lifecycle_days     = 7
    }
  }
}

data "aws_caller_identity" "current" {}

resource "aws_iam_user" "developers" {
  for_each = var.user_names
  name     = each.value

  tags = {
    Name      = each.value
    ManagedBy = "Terraform"
    Lesson    = "for-each"
  }
}

resource "aws_s3_bucket" "projects" {
  for_each = var.project_buckets
  bucket   = "terraform-${each.key}-${data.aws_caller_identity.current.account_id}"

  tags = {
    Name               = each.key
    VersioningEnabled  = each.value.versioning_enabled
    LifecycleDays      = each.value.lifecycle_days
    ManagedBy          = "Terraform"
  }
}

resource "aws_s3_bucket_versioning" "projects" {
  for_each = var.project_buckets
  bucket   = aws_s3_bucket.projects[each.key].id

  versioning_configuration {
    status = each.value.versioning_enabled ? "Enabled" : "Disabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "projects" {
  for_each = var.project_buckets
  bucket   = aws_s3_bucket.projects[each.key].id

  rule {
    id     = "expire-old-objects"
    status = "Enabled"

    expiration {
      days = each.value.lifecycle_days
    }
  }
}

output "user_arns" {
  description = "ARNs of created IAM users"
  value = {
    for name, user in aws_iam_user.developers :
    name => user.arn
  }
}

output "bucket_details" {
  description = "Details of all project buckets"
  value = {
    for name, bucket in aws_s3_bucket.projects :
    name => {
      id                 = bucket.id
      arn                = bucket.arn
      versioning_enabled = var.project_buckets[name].versioning_enabled
      lifecycle_days     = var.project_buckets[name].lifecycle_days
    }
  }
}

output "bucket_names_list" {
  description = "List of bucket names"
  value       = [for bucket in aws_s3_bucket.projects : bucket.id]
}
