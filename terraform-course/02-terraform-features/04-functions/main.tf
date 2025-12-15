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

data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

locals {
  bucket_name = lower("${var.project_name}-${var.environment}-${formatdate("YYYY-MM-DD", timestamp())}")
  
  formatted_name = title(replace(var.project_name, "-", " "))
  
  subnet_cidrs = [
    for i in range(3) : cidrsubnet(var.vpc_cidr, 8, i)
  ]
  
  availability_zones = slice(data.aws_availability_zones.available.names, 0, min(3, length(data.aws_availability_zones.available.names)))
  
  common_tags = {
    Environment = upper(var.environment)
    Project     = local.formatted_name
    ManagedBy   = "Terraform"
    CreatedAt   = formatdate("YYYY-MM-DD hh:mm:ss ZZZ", timestamp())
    AccountId   = data.aws_caller_identity.current.account_id
  }
  
  subnet_map = {
    for idx, az in local.availability_zones :
    az => {
      cidr_block        = local.subnet_cidrs[idx]
      availability_zone = az
      name              = join("-", [var.project_name, var.environment, "subnet", idx])
    }
  }
  
  is_production = var.environment == "prod"
  instance_count = local.is_production ? 3 : 1
  
  merged_tags = merge(
    local.common_tags,
    {
      CostCenter = local.is_production ? "Production" : "Development"
    }
  )
  
  user_list = ["alice", "bob", "charlie"]
  user_emails = [
    for user in local.user_list : "${user}@example.com"
  ]
  
  config_json = jsonencode({
    environment = var.environment
    project     = var.project_name
    subnets     = local.subnet_cidrs
  })
}

resource "aws_s3_bucket" "functions_demo" {
  bucket = "${var.project_name}-functions-${data.aws_caller_identity.current.account_id}"

  tags = local.merged_tags
}

output "string_functions" {
  description = "Examples of string functions"
  value = {
    uppercase_env    = upper(var.environment)
    lowercase_env    = lower(var.environment)
    title_project    = local.formatted_name
    formatted_bucket = local.bucket_name
    joined_name      = join("-", [var.project_name, var.environment])
    split_example    = split("-", var.project_name)
  }
}

output "collection_functions" {
  description = "Examples of collection functions"
  value = {
    subnet_count     = length(local.subnet_cidrs)
    first_subnet     = element(local.subnet_cidrs, 0)
    all_subnets      = local.subnet_cidrs
    availability_zones = local.availability_zones
    user_emails      = local.user_emails
    contains_prod    = contains(["dev", "staging", "prod"], var.environment)
  }
}

output "numeric_functions" {
  description = "Examples of numeric functions"
  value = {
    min_value      = min(1, 2, 3)
    max_value      = max(1, 2, 3)
    instance_count = local.instance_count
  }
}

output "ip_network_functions" {
  description = "Examples of IP network functions"
  value = {
    vpc_cidr      = var.vpc_cidr
    subnet_cidrs  = local.subnet_cidrs
    first_host    = cidrhost(var.vpc_cidr, 1)
    last_host     = cidrhost(var.vpc_cidr, -1)
  }
}

output "encoding_functions" {
  description = "Examples of encoding functions"
  value = {
    config_json   = local.config_json
    base64_encode = base64encode("terraform")
  }
}

output "date_functions" {
  description = "Examples of date/time functions"
  value = {
    current_timestamp = timestamp()
    formatted_date    = formatdate("YYYY-MM-DD", timestamp())
    formatted_time    = formatdate("hh:mm:ss", timestamp())
  }
}

output "subnet_map" {
  description = "Subnet configuration map"
  value       = local.subnet_map
}
