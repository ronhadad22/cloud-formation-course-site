# Root Terragrunt Configuration
# This file contains shared configuration for all accounts and environments

locals {
  # Parse the relative path to extract account and region
  parsed = regex(".*/(?P<account>[^/]+)/(?P<region>[^/]+)/(?P<component>[^/]+)", get_terragrunt_dir())
  
  account   = local.parsed.account
  region    = local.parsed.region
  component = local.parsed.component
  
  # Load account-level variables
  account_vars = read_terragrunt_config(find_in_parent_folders("account.hcl"))
  
  # Load region-level variables
  region_vars = read_terragrunt_config(find_in_parent_folders("region.hcl"))
  
  # Extract commonly used values
  aws_account_id = local.account_vars.locals.aws_account_id
  account_name   = local.account_vars.locals.account_name
  aws_region     = local.region_vars.locals.aws_region
  
  # Common tags applied to all resources
  common_tags = {
    ManagedBy   = "Terragrunt"
    Account     = local.account_name
    Region      = local.aws_region
    Component   = local.component
    Terraform   = "true"
  }
}

# Generate AWS provider configuration
generate "provider" {
  path      = "provider.tf"
  if_exists = "overwrite_terragrunt"
  contents  = <<EOF
provider "aws" {
  region = "${local.aws_region}"
  
  # Use assume role if specified in account.hcl
  %{if try(local.account_vars.locals.iam_role, "") != ""}
  assume_role {
    role_arn = "${local.account_vars.locals.iam_role}"
  }
  %{endif}
  
  default_tags {
    tags = ${jsonencode(local.common_tags)}
  }
}
EOF
}

# Configure remote state backend
remote_state {
  backend = "s3"
  
  generate = {
    path      = "backend.tf"
    if_exists = "overwrite_terragrunt"
  }
  
  config = {
    # Use account-specific state bucket
    bucket         = "terraform-state-${local.aws_account_id}-${local.aws_region}"
    key            = "${local.account}/${local.region}/${local.component}/terraform.tfstate"
    region         = local.aws_region
    encrypt        = true
    dynamodb_table = "terraform-locks-${local.aws_account_id}"
    
    # S3 bucket versioning
    s3_bucket_tags = merge(
      local.common_tags,
      {
        Name    = "Terraform State"
        Purpose = "Remote State Storage"
      }
    )
    
    # DynamoDB table tags
    dynamodb_table_tags = merge(
      local.common_tags,
      {
        Name    = "Terraform Locks"
        Purpose = "State Locking"
      }
    )
  }
}

# Configure Terraform settings
terraform {
  # Automatically create S3 bucket and DynamoDB table if they don't exist
  extra_arguments "auto_init" {
    commands = [
      "init",
      "plan",
      "apply",
      "destroy"
    ]
    
    env_vars = {
      AWS_DEFAULT_REGION = local.aws_region
    }
  }
  
  # Automatically retry on transient errors
  extra_arguments "retry_lock" {
    commands = get_terraform_commands_that_need_locking()
    
    arguments = [
      "-lock-timeout=20m"
    ]
  }
  
  # Add common variables to all Terraform commands
  extra_arguments "common_vars" {
    commands = get_terraform_commands_that_need_vars()
    
    arguments = [
      "-var", "account_id=${local.aws_account_id}",
      "-var", "account_name=${local.account_name}",
      "-var", "region=${local.aws_region}"
    ]
  }
}

# Input values that will be merged with component-specific inputs
inputs = merge(
  local.common_tags,
  {
    aws_account_id = local.aws_account_id
    account_name   = local.account_name
    aws_region     = local.aws_region
  }
)
