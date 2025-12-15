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
  region = local.aws_region
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "dev"
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "myapp"
}

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.0.0.0/16"
}

data "aws_caller_identity" "current" {}

data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  aws_region = "us-east-1"
  
  name_prefix = "${var.project_name}-${var.environment}"
  
  common_tags = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "Terraform"
    CreatedBy   = data.aws_caller_identity.current.arn
    Region      = local.aws_region
  }
  
  is_production = var.environment == "prod"
  
  instance_config = {
    type  = local.is_production ? "t3.large" : "t2.micro"
    count = local.is_production ? 3 : 1
  }
  
  availability_zones = slice(
    data.aws_availability_zones.available.names,
    0,
    min(3, length(data.aws_availability_zones.available.names))
  )
  
  subnet_cidrs = [
    for i in range(length(local.availability_zones)) :
    cidrsubnet(var.vpc_cidr, 8, i)
  ]
  
  subnets = {
    for idx, az in local.availability_zones :
    "${local.name_prefix}-subnet-${idx}" => {
      cidr_block        = local.subnet_cidrs[idx]
      availability_zone = az
      tags = merge(
        local.common_tags,
        {
          Name = "${local.name_prefix}-subnet-${idx}"
          AZ   = az
        }
      )
    }
  }
  
  security_rules = {
    http = {
      port        = 80
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
      description = "HTTP access"
    }
    https = {
      port        = 443
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
      description = "HTTPS access"
    }
    ssh = {
      port        = 22
      protocol    = "tcp"
      cidr_blocks = local.is_production ? ["10.0.0.0/8"] : ["0.0.0.0/0"]
      description = "SSH access"
    }
  }
  
  bucket_config = {
    versioning = local.is_production
    encryption = true
    lifecycle_days = local.is_production ? 90 : 30
  }
  
  flattened_subnets = flatten([
    for subnet_name, subnet_config in local.subnets : [
      {
        name = subnet_name
        cidr = subnet_config.cidr_block
        az   = subnet_config.availability_zone
      }
    ]
  ])
}

resource "aws_s3_bucket" "locals_demo" {
  bucket = "${local.name_prefix}-locals-${data.aws_caller_identity.current.account_id}"

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-bucket"
    }
  )
}

resource "aws_s3_bucket_versioning" "locals_demo" {
  bucket = aws_s3_bucket.locals_demo.id

  versioning_configuration {
    status = local.bucket_config.versioning ? "Enabled" : "Disabled"
  }
}

output "computed_values" {
  description = "Values computed using locals"
  value = {
    name_prefix      = local.name_prefix
    is_production    = local.is_production
    instance_type    = local.instance_config.type
    instance_count   = local.instance_config.count
    aws_region       = local.aws_region
  }
}

output "subnet_configuration" {
  description = "Subnet configuration from locals"
  value       = local.subnets
}

output "security_rules" {
  description = "Security rules configuration"
  value       = local.security_rules
}

output "common_tags" {
  description = "Common tags applied to resources"
  value       = local.common_tags
}

output "bucket_configuration" {
  description = "S3 bucket configuration"
  value = {
    name           = aws_s3_bucket.locals_demo.id
    versioning     = local.bucket_config.versioning
    encryption     = local.bucket_config.encryption
    lifecycle_days = local.bucket_config.lifecycle_days
  }
}

output "locals_vs_variables" {
  description = "Understanding locals vs variables"
  value = {
    note = "Variables are inputs from outside, locals are computed within the configuration"
    examples = {
      variable_example = "var.environment (input from user)"
      local_example    = "local.name_prefix (computed from variables)"
    }
  }
}
