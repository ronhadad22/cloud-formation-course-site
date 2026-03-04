# Staging Environment - WITHOUT Terragrunt
# Notice: This is ALMOST IDENTICAL to dev/main.tf - only environment name differs!

terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # DUPLICATED: Same backend config as dev, only key path differs
  backend "s3" {
    bucket         = "my-terraform-state-bucket"
    key            = "staging/vpc/terraform.tfstate"  # Only this line is different!
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-state-locks"
  }
}

# DUPLICATED: Same provider config as dev, only tags differ
provider "aws" {
  region = "us-east-1"

  default_tags {
    tags = {
      Environment = "staging"  # Only this value is different!
      ManagedBy   = "Terraform"
      Project     = "DRY-Example"
    }
  }
}

# DUPLICATED: Exact same VPC configuration as dev
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "staging-vpc"  # Only name is different
    Environment = "staging"
  }
}

resource "aws_subnet" "public" {
  count = 2

  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 8, count.index)
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name        = "staging-public-${count.index + 1}"
    Environment = "staging"
  }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name        = "staging-igw"
    Environment = "staging"
  }
}

data "aws_availability_zones" "available" {
  state = "available"
}
