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
  region = var.aws_region
}

resource "aws_s3_bucket" "variable_demo" {
  bucket = var.bucket_name

  tags = merge(
    var.common_tags,
    {
      Name = var.bucket_name
    }
  )
}

resource "aws_s3_bucket_versioning" "variable_demo" {
  bucket = aws_s3_bucket.variable_demo.id

  versioning_configuration {
    status = var.enable_versioning ? "Enabled" : "Disabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "variable_demo" {
  bucket = aws_s3_bucket.variable_demo.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}
