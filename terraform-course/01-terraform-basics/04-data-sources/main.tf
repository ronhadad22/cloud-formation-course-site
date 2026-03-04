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
  region = "eu-west-2"
}

data "aws_caller_identity" "current" {}

data "aws_region" "current" {}

data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_ami" "amazon_linux_2" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["amzn2-ami-hvm-*-x86_64-gp2"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

resource "aws_instance" "amazon_linux_2" {
  ami           = data.aws_ami.amazon_linux_2.id
  instance_type = "t2.micro"
}



output "current_account_id" {
  description = "Current AWS Account ID"
  value       = data.aws_caller_identity.current.account_id
}

output "current_region" {
  description = "Current AWS Region"
  value       = data.aws_region.current.name
}

output "available_azs" {
  description = "Available Availability Zones"
  value       = data.aws_availability_zones.available.names
}

output "amazon_linux_2_ami" {
  description = "Latest Amazon Linux 2 AMI ID"
  value = {
    id           = data.aws_ami.amazon_linux_2.id
    name         = data.aws_ami.amazon_linux_2.name
    architecture = data.aws_ami.amazon_linux_2.architecture
  }
}
