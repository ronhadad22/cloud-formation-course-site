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

locals {
  workspace_config = {
    dev = {
      instance_type  = "t2.micro"
      instance_count = 1
      environment    = "development"
    }
    staging = {
      instance_type  = "t3.small"
      instance_count = 2
      environment    = "staging"
    }
    prod = {
      instance_type  = "t3.large"
      instance_count = 3
      environment    = "production"
    }
  }

  config = local.workspace_config[terraform.workspace]
}

data "aws_caller_identity" "current" {}

data "aws_ami" "amazon_linux_2" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["amzn2-ami-hvm-*-x86_64-gp2"]
  }
}

resource "aws_s3_bucket" "workspace_demo" {
  bucket = "terraform-workspace-${terraform.workspace}-${data.aws_caller_identity.current.account_id}"

  tags = {
    Name        = "workspace-demo-${terraform.workspace}"
    Environment = local.config.environment
    Workspace   = terraform.workspace
    ManagedBy   = "Terraform"
  }
}

resource "aws_instance" "workspace_demo" {
  count         = local.config.instance_count
  ami           = data.aws_ami.amazon_linux_2.id
  instance_type = local.config.instance_type

  tags = {
    Name        = "workspace-demo-${terraform.workspace}-${count.index + 1}"
    Environment = local.config.environment
    Workspace   = terraform.workspace
    ManagedBy   = "Terraform"
  }
}

output "workspace_info" {
  description = "Current workspace information"
  value = {
    workspace      = terraform.workspace
    environment    = local.config.environment
    instance_type  = local.config.instance_type
    instance_count = local.config.instance_count
  }
}

output "resources" {
  description = "Created resources"
  value = {
    bucket_name  = aws_s3_bucket.workspace_demo.id
    instance_ids = aws_instance.workspace_demo[*].id
  }
}

output "workspace_commands" {
  description = "Useful workspace commands"
  value = [
    "terraform workspace list - List all workspaces",
    "terraform workspace new <name> - Create new workspace",
    "terraform workspace select <name> - Switch workspace",
    "terraform workspace show - Show current workspace",
    "terraform workspace delete <name> - Delete workspace"
  ]
}
