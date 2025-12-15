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

resource "aws_s3_bucket" "first_bucket" {
  bucket = "terraform-basics-first-bucket-${data.aws_caller_identity.current.account_id}"

  tags = {
    Name        = "My First Terraform Bucket"
    Environment = "Learning"
    ManagedBy   = "Terraform"
    Lesson      = "01-first-resource"
  }
}

resource "aws_s3_bucket_versioning" "first_bucket" {
  bucket = aws_s3_bucket.first_bucket.id

  versioning_configuration {
    status = "Enabled"
  }
}

data "aws_caller_identity" "current" {}

output "bucket_name" {
  description = "Name of the created S3 bucket"
  value       = aws_s3_bucket.first_bucket.id
}

output "bucket_arn" {
  description = "ARN of the created S3 bucket"
  value       = aws_s3_bucket.first_bucket.arn
}
