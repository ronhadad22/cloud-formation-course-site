terraform {
  source = "../../01-basics/terraform"
}

locals {
  aws_region  = "us-east-1"
  environment = "generate-demo"
}

generate "provider" {
  path      = "provider.tf"
  if_exists = "overwrite_terragrunt"
  
  contents = <<EOF
provider "aws" {
  region = "${local.aws_region}"
  
  default_tags {
    tags = {
      ManagedBy   = "Terragrunt"
      Environment = "${local.environment}"
      GeneratedBy = "Terragrunt-Generate-Block"
    }
  }
}
EOF
}

generate "versions" {
  path      = "versions_override.tf"
  if_exists = "overwrite_terragrunt"
  
  contents = <<EOF
terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}
EOF
}

generate "locals" {
  path      = "locals.tf"
  if_exists = "overwrite_terragrunt"
  
  contents = <<EOF
locals {
  generated_timestamp = "${timestamp()}"
  generated_by        = "Terragrunt Generate Block"
}
EOF
}

inputs = {
  bucket_name = "terragrunt-generate-demo-${get_aws_account_id()}"
  environment = local.environment
  
  tags = {
    Example = "Generate-Blocks"
  }
}
