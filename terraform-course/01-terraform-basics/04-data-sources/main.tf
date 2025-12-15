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

data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }
}

resource "aws_s3_bucket" "data_source_demo" {
  bucket = "terraform-data-sources-${data.aws_caller_identity.current.account_id}"

  tags = {
    Name             = "Data Sources Demo"
    ManagedBy        = "Terraform"
    Lesson           = "04-data-sources"
    Region           = data.aws_region.current.name
    AvailabilityZone = data.aws_availability_zones.available.names[0]
  }
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

output "ubuntu_ami" {
  description = "Latest Ubuntu 22.04 AMI ID"
  value = {
    id           = data.aws_ami.ubuntu.id
    name         = data.aws_ami.ubuntu.name
    architecture = data.aws_ami.ubuntu.architecture
  }
}

output "data_summary" {
  description = "Summary of all data sources"
  value = {
    account_id     = data.aws_caller_identity.current.account_id
    region         = data.aws_region.current.name
    az_count       = length(data.aws_availability_zones.available.names)
    amazon_linux_2 = data.aws_ami.amazon_linux_2.id
    ubuntu         = data.aws_ami.ubuntu.id
  }
}
