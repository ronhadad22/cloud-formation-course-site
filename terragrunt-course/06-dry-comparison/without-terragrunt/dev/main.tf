# Development Environment - WITHOUT Terragrunt
# Notice: This file contains DUPLICATED configuration that exists in staging and prod

terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # DUPLICATED: Same backend config in staging/backend.tf and prod/backend.tf
  backend "s3" {
    bucket         = "terraform-backend-course-int-2025"
    key            = "dev/vpc/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
  }
}

# DUPLICATED: Same provider config in staging and prod
provider "aws" {
  region = "us-east-1"

  default_tags {
    tags = {
      Environment = "dev"
      ManagedBy   = "Terraform"
      Project     = "DRY-Example"
    }
  }
}

# VPC Configuration
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "dev-vpc"
    Environment = "dev"
  }
}

resource "aws_subnet" "public" {
  count = 2

  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 8, count.index)
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name        = "dev-public-${count.index + 1}"
    Environment = "dev"
  }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name        = "dev-igw"
    Environment = "dev"
  }
}

data "aws_availability_zones" "available" {
  state = "available"
}
