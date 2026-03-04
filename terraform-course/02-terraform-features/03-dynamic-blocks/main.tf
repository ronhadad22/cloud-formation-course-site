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

variable "ingress_rules" {
  description = "List of ingress rules for security group"
  type = list(object({
    from_port   = number
    to_port     = number
    protocol    = string
    cidr_blocks = list(string)
    description = string
  }))
  default = [
    {
      from_port   = 80
      to_port     = 80
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
      description = "HTTP from anywhere"
    },
    {
      from_port   = 443
      to_port     = 443
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
      description = "HTTPS from anywhere"
    },
    {
      from_port   = 22
      to_port     = 22
      protocol    = "tcp"
      cidr_blocks = ["10.0.0.0/8"]
      description = "SSH from internal network"
    }
  ]
}

variable "enable_monitoring" {
  description = "Enable CloudWatch monitoring"
  type        = bool
  default     = true
}

variable "alarm_actions" {
  description = "List of alarm actions"
  type        = list(string)
  default     = []
}

data "aws_vpc" "default" {
  default = true
}

resource "aws_security_group" "dynamic_example" {
  name        = "terraform-dynamic-sg"
  description = "Security group with dynamic blocks"
  vpc_id      = data.aws_vpc.default.id

  dynamic "ingress" {
    for_each = var.ingress_rules
    content {
      from_port   = ingress.value.from_port
      to_port     = ingress.value.to_port
      protocol    = ingress.value.protocol
      cidr_blocks = ingress.value.cidr_blocks
      description = ingress.value.description
    }
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound traffic"
  }

  tags = {
    Name      = "dynamic-security-group"
    ManagedBy = "Terraform"
    Lesson    = "dynamic-blocks"
  }
}

resource "aws_launch_template" "example" {
  name_prefix   = "terraform-dynamic-"
  image_id      = data.aws_ami.amazon_linux_2.id
  instance_type = "t2.micro"

  dynamic "block_device_mappings" {
    for_each = var.enable_monitoring ? [1] : []
    content {
      device_name = "/dev/xvda"
      ebs {
        volume_size = 20
        volume_type = "gp3"
        encrypted   = true
      }
    }
  }

  dynamic "monitoring" {
    for_each = var.enable_monitoring ? [1] : []
    content {
      enabled = true
    }
  }

  vpc_security_group_ids = [aws_security_group.dynamic_example.id]

  tag_specifications {
    resource_type = "instance"
    tags = {
      Name      = "dynamic-launch-template-instance"
      ManagedBy = "Terraform"
    }
  }
}

data "aws_ami" "amazon_linux_2" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["amzn2-ami-hvm-*-x86_64-gp2"]
  }
}

output "security_group_id" {
  description = "ID of the security group"
  value       = aws_security_group.dynamic_example.id
}

output "ingress_rules_count" {
  description = "Number of ingress rules"
  value       = length(var.ingress_rules)
}

output "launch_template_id" {
  description = "ID of the launch template"
  value       = aws_launch_template.example.id
}
