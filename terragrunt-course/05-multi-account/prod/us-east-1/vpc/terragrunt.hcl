# VPC Configuration for Production Account - us-east-1

# Include root configuration
include "root" {
  path = find_in_parent_folders()
}

# Load account-level variables
locals {
  account_vars = read_terragrunt_config(find_in_parent_folders("account.hcl"))
  region_vars  = read_terragrunt_config(find_in_parent_folders("region.hcl"))
}

# Terraform module source
terraform {
  source = "${get_repo_root()}//terragrunt-course/05-multi-account/_modules/vpc"
}

# Input values for the VPC module
inputs = {
  # From account.hcl
  vpc_cidr = local.account_vars.locals.vpc_cidr
  
  # From region.hcl
  availability_zones   = local.region_vars.locals.availability_zones
  public_subnet_cidrs  = local.region_vars.locals.public_subnet_cidrs
  private_subnet_cidrs = local.region_vars.locals.private_subnet_cidrs
  
  # Production-specific settings
  enable_nat_gateway = true  # Always enable NAT in production
  
  # Additional tags
  tags = merge(
    local.account_vars.locals.account_tags,
    local.region_vars.locals.region_tags,
    {
      Component  = "vpc"
      Purpose    = "networking"
      Compliance = "required"
    }
  )
}
