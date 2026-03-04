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

data "aws_ami" "amazon_linux_2" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["amzn2-ami-hvm-*-x86_64-gp2"]
  }
}

resource "aws_s3_bucket" "critical_data" {
  bucket = "terraform-lifecycle-critical-${data.aws_caller_identity.current.account_id}"

  lifecycle {
    prevent_destroy = true
  }

  tags = {
    Name        = "Critical Data Bucket"
    ManagedBy   = "Terraform"
    Criticality = "High"
  }
}

resource "aws_s3_bucket" "ignore_tags" {
  bucket = "terraform-lifecycle-ignore-${data.aws_caller_identity.current.account_id}"

  lifecycle {
    ignore_changes = [
      tags,
      tags_all
    ]
  }

  tags = {
    Name      = "Ignore Changes Demo"
    ManagedBy = "Terraform"
  }
}

resource "aws_launch_template" "zero_downtime" {
  name_prefix   = "terraform-lifecycle-"
  image_id      = data.aws_ami.amazon_linux_2.id
  instance_type = "t2.micro"

  lifecycle {
    create_before_destroy = true
  }

  tag_specifications {
    resource_type = "instance"
    tags = {
      Name      = "Zero Downtime Instance"
      ManagedBy = "Terraform"
    }
  }
}

resource "aws_security_group" "trigger_example" {
  name        = "terraform-lifecycle-sg"
  description = "Security group for lifecycle demo"

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name      = "Lifecycle Security Group"
    ManagedBy = "Terraform"
  }
}

resource "aws_instance" "replace_triggered" {
  ami           = data.aws_ami.amazon_linux_2.id
  instance_type = "t2.micro"

  vpc_security_group_ids = [aws_security_group.trigger_example.id]

  lifecycle {
    replace_triggered_by = [
      aws_security_group.trigger_example.id
    ]
  }

  tags = {
    Name      = "Replace Triggered Instance"
    ManagedBy = "Terraform"
  }
}

resource "aws_s3_bucket" "multiple_lifecycle_rules" {
  bucket = "terraform-lifecycle-multi-${data.aws_caller_identity.current.account_id}"

  lifecycle {
    create_before_destroy = true
    
    ignore_changes = [
      tags["LastModified"]
    ]
  }

  tags = {
    Name         = "Multiple Lifecycle Rules"
    ManagedBy    = "Terraform"
    LastModified = timestamp()
  }
}

output "lifecycle_examples" {
  description = "Summary of lifecycle rule examples"
  value = {
    prevent_destroy = {
      resource    = "aws_s3_bucket.critical_data"
      description = "Cannot be destroyed via terraform destroy"
      bucket_name = aws_s3_bucket.critical_data.id
    }
    ignore_changes = {
      resource    = "aws_s3_bucket.ignore_tags"
      description = "Tags can be modified outside Terraform without drift"
      bucket_name = aws_s3_bucket.ignore_tags.id
    }
    create_before_destroy = {
      resource    = "aws_launch_template.zero_downtime"
      description = "New resource created before old one is destroyed"
      template_id = aws_launch_template.zero_downtime.id
    }
    replace_triggered_by = {
      resource    = "aws_instance.replace_triggered"
      description = "Instance replaced when security group changes"
      instance_id = aws_instance.replace_triggered.id
    }
  }
}

output "important_notes" {
  description = "Important notes about lifecycle rules"
  value = [
    "prevent_destroy: Protects resources from accidental deletion",
    "ignore_changes: Prevents drift detection for specified attributes",
    "create_before_destroy: Ensures zero-downtime updates",
    "replace_triggered_by: Forces replacement when dependencies change"
  ]
}
