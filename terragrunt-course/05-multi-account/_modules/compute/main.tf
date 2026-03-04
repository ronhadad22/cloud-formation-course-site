terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

data "aws_ami" "amazon_linux_2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

resource "aws_security_group" "instance" {
  name_prefix = "${var.account_name}-${var.region}-${var.component_name}-"
  description = "Security group for ${var.component_name} instances"
  vpc_id      = var.vpc_id

  ingress {
    description = "SSH from anywhere"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTP from anywhere"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.account_name}-${var.region}-${var.component_name}-sg"
    }
  )

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_instance" "main" {
  count = var.instance_count

  ami           = var.ami_id != "" ? var.ami_id : data.aws_ami.amazon_linux_2023.id
  instance_type = var.instance_type
  subnet_id     = var.subnet_ids[count.index % length(var.subnet_ids)]

  vpc_security_group_ids = [aws_security_group.instance.id]

  monitoring = var.enable_monitoring

  user_data = var.user_data

  root_block_device {
    volume_type           = "gp3"
    volume_size           = var.root_volume_size
    delete_on_termination = true
    encrypted             = true
  }

  tags = merge(
    var.tags,
    {
      Name  = "${var.account_name}-${var.region}-${var.component_name}-${count.index + 1}"
      Index = count.index + 1
    }
  )

  lifecycle {
    ignore_changes = [ami]
  }
}

resource "aws_eip" "instance" {
  count = var.assign_public_ip ? var.instance_count : 0

  instance = aws_instance.main[count.index].id
  domain   = "vpc"

  tags = merge(
    var.tags,
    {
      Name = "${var.account_name}-${var.region}-${var.component_name}-eip-${count.index + 1}"
    }
  )

  depends_on = [aws_instance.main]
}
