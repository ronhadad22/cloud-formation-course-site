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

data "aws_availability_zones" "available" {
  state = "available"
}

module "vpc" {
  source = "./modules/vpc"

  vpc_name           = "terraform-modules-demo"
  vpc_cidr           = "10.0.0.0/16"
  availability_zones = slice(data.aws_availability_zones.available.names, 0, 2)
  enable_nat_gateway = true

  tags = {
    Environment = "demo"
    ManagedBy   = "Terraform"
    Module      = "VPC"
  }
}

module "compute" {
  source = "./modules/compute"

  name               = "web-server"
  vpc_id             = module.vpc.vpc_id
  subnet_ids         = module.vpc.public_subnet_ids
  instance_type      = "t2.micro"
  instance_count     = 2

  tags = {
    Environment = "demo"
    ManagedBy   = "Terraform"
    Module      = "Compute"
  }
}

module "database" {
  source = "./modules/database"

  identifier         = "demo-db"
  vpc_id             = module.vpc.vpc_id
  subnet_ids         = module.vpc.private_subnet_ids
  allowed_cidr_blocks = module.vpc.public_subnet_cidrs

  tags = {
    Environment = "demo"
    ManagedBy   = "Terraform"
    Module      = "Database"
  }
}

output "vpc_details" {
  description = "VPC module outputs"
  value = {
    vpc_id             = module.vpc.vpc_id
    public_subnet_ids  = module.vpc.public_subnet_ids
    private_subnet_ids = module.vpc.private_subnet_ids
  }
}

output "compute_details" {
  description = "Compute module outputs"
  value = {
    instance_ids = module.compute.instance_ids
    public_ips   = module.compute.public_ips
  }
}

output "database_details" {
  description = "Database module outputs"
  value = {
    endpoint = module.database.endpoint
    port     = module.database.port
  }
  sensitive = true
}
