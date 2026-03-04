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

resource "aws_s3_bucket" "outputs_demo" {
  bucket = "terraform-outputs-demo-${data.aws_caller_identity.current.account_id}"

  tags = {
    Name      = "Outputs Demo Bucket"
    ManagedBy = "Terraform"
    Lesson    = "03-outputs"
  }
}

resource "aws_s3_bucket_versioning" "outputs_demo" {
  bucket = aws_s3_bucket.outputs_demo.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_public_access_block" "outputs_demo" {
  bucket = aws_s3_bucket.outputs_demo.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
