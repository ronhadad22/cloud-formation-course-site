locals {
  aws_region = "us-east-1"
}

remote_state {
  backend = "s3"
  
  generate = {
    path      = "backend.tf"
    if_exists = "overwrite_terragrunt"
  }
  
  config = {
    bucket         = "terragrunt-course-state-${get_aws_account_id()}"
    key            = "${path_relative_to_include()}/terraform.tfstate"
    region         = local.aws_region
    encrypt        = true
    dynamodb_table = "terragrunt-course-locks"
  }
}

generate "provider" {
  path      = "provider.tf"
  if_exists = "overwrite_terragrunt"
  
  contents = <<EOF
provider "aws" {
  region = "${local.aws_region}"
  
  default_tags {
    tags = {
      ManagedBy = "Terragrunt"
      Course    = "Terragrunt-MultiEnv"
    }
  }
}
EOF
}

terraform {
  extra_arguments "common_vars" {
    commands = get_terraform_commands_that_need_vars()
  }
}
