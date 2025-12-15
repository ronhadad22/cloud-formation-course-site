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

data "aws_caller_identity" "current" {}

resource "aws_s3_bucket" "state_bucket" {
  bucket = "terraform-remote-state-demo-${data.aws_caller_identity.current.account_id}"

  tags = {
    Name        = "Terraform Remote State"
    Purpose     = "Store Terraform state files"
    ManagedBy   = "Terraform"
  }
}

resource "aws_s3_bucket_versioning" "state_bucket" {
  bucket = aws_s3_bucket.state_bucket.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "state_bucket" {
  bucket = aws_s3_bucket.state_bucket.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "state_bucket" {
  bucket = aws_s3_bucket.state_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_dynamodb_table" "terraform_locks" {
  name         = "terraform-state-locks"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  tags = {
    Name        = "Terraform State Locks"
    Purpose     = "Lock Terraform state during operations"
    ManagedBy   = "Terraform"
  }
}

output "state_bucket_name" {
  description = "Name of the S3 bucket for state storage"
  value       = aws_s3_bucket.state_bucket.id
}

output "state_bucket_arn" {
  description = "ARN of the S3 bucket"
  value       = aws_s3_bucket.state_bucket.arn
}

output "dynamodb_table_name" {
  description = "Name of the DynamoDB table for state locking"
  value       = aws_dynamodb_table.terraform_locks.name
}

output "backend_configuration" {
  description = "Backend configuration to use in other projects"
  value = <<-EOT
    terraform {
      backend "s3" {
        bucket         = "${aws_s3_bucket.state_bucket.id}"
        key            = "path/to/terraform.tfstate"
        region         = "us-east-1"
        encrypt        = true
        dynamodb_table = "${aws_dynamodb_table.terraform_locks.name}"
      }
    }
  EOT
}
