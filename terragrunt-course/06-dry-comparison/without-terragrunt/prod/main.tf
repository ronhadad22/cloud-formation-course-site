# Production Environment - WITHOUT Terragrunt
# Notice: This is ALMOST IDENTICAL to dev and staging - massive code duplication!

terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # DUPLICATED: Same backend config as dev and staging, only key path differs
  backend "s3" {
    bucket         = "terraform-backend-course-int-2025"
    key            = "prod/vpc/terraform.tfstate"  # Only this line is different!
    region         = "us-east-1"
    encrypt        = true
  }
}

# DUPLICATED: Same provider config as dev and staging, only tags differ
provider "aws" {
  region = "us-east-1"

  default_tags {
    tags = {
      Environment = "production"  # Only this value is different!
      ManagedBy   = "Terraform"
      Project     = "DRY-Example"
    }
  }
}

# DUPLICATED: Exact same VPC configuration as dev and staging
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "prod-vpc"  # Only name is different
    Environment = "production"
  }
}

resource "aws_subnet" "public" {
  count = 2

  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 8, count.index)
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name        = "prod-public-${count.index + 1}"
    Environment = "production"
  }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name        = "prod-igw"
    Environment = "production"
  }
}

data "aws_availability_zones" "available" {
  state = "available"
}
