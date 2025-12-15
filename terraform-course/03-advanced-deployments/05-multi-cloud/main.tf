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
  alias  = "us_east"
  region = "us-east-1"
}

provider "aws" {
  alias  = "us_west"
  region = "us-west-2"
}

provider "aws" {
  alias  = "eu_west"
  region = "eu-west-1"
}

data "aws_caller_identity" "current" {}

locals {
  regions = {
    us_east = "us-east-1"
    us_west = "us-west-2"
    eu_west = "eu-west-1"
  }
  
  common_tags = {
    ManagedBy   = "Terraform"
    Project     = "Multi-Region-Demo"
    DeployedAt  = timestamp()
  }
}

resource "aws_s3_bucket" "us_east" {
  provider = aws.us_east
  bucket   = "multi-region-us-east-${data.aws_caller_identity.current.account_id}"

  tags = merge(
    local.common_tags,
    {
      Name   = "US East Bucket"
      Region = local.regions.us_east
    }
  )
}

resource "aws_s3_bucket" "us_west" {
  provider = aws.us_west
  bucket   = "multi-region-us-west-${data.aws_caller_identity.current.account_id}"

  tags = merge(
    local.common_tags,
    {
      Name   = "US West Bucket"
      Region = local.regions.us_west
    }
  )
}

resource "aws_s3_bucket" "eu_west" {
  provider = aws.eu_west
  bucket   = "multi-region-eu-west-${data.aws_caller_identity.current.account_id}"

  tags = merge(
    local.common_tags,
    {
      Name   = "EU West Bucket"
      Region = local.regions.eu_west
    }
  )
}

output "multi_region_buckets" {
  description = "Buckets created across multiple regions"
  value = {
    us_east = {
      name   = aws_s3_bucket.us_east.id
      region = local.regions.us_east
      arn    = aws_s3_bucket.us_east.arn
    }
    us_west = {
      name   = aws_s3_bucket.us_west.id
      region = local.regions.us_west
      arn    = aws_s3_bucket.us_west.arn
    }
    eu_west = {
      name   = aws_s3_bucket.eu_west.id
      region = local.regions.eu_west
      arn    = aws_s3_bucket.eu_west.arn
    }
  }
}

output "multi_cloud_example" {
  description = "Example of multi-cloud deployment"
  value = <<-EOT
    For true multi-cloud (AWS + Azure + GCP), configure providers:
    
    terraform {
      required_providers {
        aws = {
          source  = "hashicorp/aws"
          version = "~> 5.0"
        }
        azurerm = {
          source  = "hashicorp/azurerm"
          version = "~> 3.0"
        }
        google = {
          source  = "hashicorp/google"
          version = "~> 5.0"
        }
      }
    }
    
    Then create resources in each cloud:
    - aws_s3_bucket (AWS)
    - azurerm_storage_account (Azure)
    - google_storage_bucket (GCP)
  EOT
}
