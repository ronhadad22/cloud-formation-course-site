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

variable "instance_count" {
  description = "Number of instances to create"
  type        = number
  default     = 3
}

variable "create_instances" {
  description = "Whether to create instances"
  type        = bool
  default     = true
}

data "aws_ami" "amazon_linux_2" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["amzn2-ami-hvm-*-x86_64-gp2"]
  }
}

resource "aws_instance" "web" {
  count         = var.create_instances ? var.instance_count : 0
  ami           = data.aws_ami.amazon_linux_2.id
  instance_type = "t2.micro"

  tags = {
    Name      = "web-server-${count.index + 1}"
    Index     = count.index
    ManagedBy = "Terraform"
    Lesson    = "count"
  }
}

resource "aws_s3_bucket" "logs" {
  count  = var.instance_count
  bucket = "terraform-count-logs-${count.index}-${data.aws_caller_identity.current.account_id}"

  tags = {
    Name      = "logs-bucket-${count.index}"
    ManagedBy = "Terraform"
  }
}

data "aws_caller_identity" "current" {}

output "instance_ids" {
  description = "IDs of all created instances"
  value       = aws_instance.web[*].id
}

output "instance_public_ips" {
  description = "Public IPs of all instances"
  value       = aws_instance.web[*].public_ip
}

output "first_instance_id" {
  description = "ID of the first instance"
  value       = length(aws_instance.web) > 0 ? aws_instance.web[0].id : null
}

output "bucket_names" {
  description = "Names of all S3 buckets"
  value       = aws_s3_bucket.logs[*].id
}
