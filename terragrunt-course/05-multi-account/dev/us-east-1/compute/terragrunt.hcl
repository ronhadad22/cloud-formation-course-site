# Compute Configuration for Dev Account - us-east-1

# Include root configuration
include "root" {
  path = find_in_parent_folders()
}

# Load account and region variables
locals {
  account_vars = read_terragrunt_config(find_in_parent_folders("account.hcl"))
  region_vars  = read_terragrunt_config(find_in_parent_folders("region.hcl"))
}

# Dependency on VPC
dependency "vpc" {
  config_path = "../vpc"
  
  mock_outputs = {
    vpc_id             = "vpc-mock-12345"
    public_subnet_ids  = ["subnet-mock-1", "subnet-mock-2"]
    private_subnet_ids = ["subnet-mock-3", "subnet-mock-4"]
  }
}

# Terraform module source
terraform {
  source = "${get_repo_root()}//terragrunt-course/05-multi-account/_modules/compute"
}

# Input values for the Compute module
inputs = {
  component_name = "web"
  
  # VPC configuration from dependency
  vpc_id     = dependency.vpc.outputs.vpc_id
  subnet_ids = dependency.vpc.outputs.public_subnet_ids
  
  # Instance configuration from account.hcl
  instance_type      = local.account_vars.locals.default_instance_type
  instance_count     = 1
  enable_monitoring  = local.account_vars.locals.enable_monitoring
  assign_public_ip   = true
  root_volume_size   = 20
  
  # AMI from region.hcl
  ami_id = local.region_vars.locals.ami_id
  
  # User data for web server
  user_data = <<-EOF
    #!/bin/bash
    yum update -y
    yum install -y httpd
    systemctl start httpd
    systemctl enable httpd
    echo "<h1>Dev Environment - ${local.account_vars.locals.account_name}</h1>" > /var/www/html/index.html
  EOF
  
  # Additional tags
  tags = merge(
    local.account_vars.locals.account_tags,
    local.region_vars.locals.region_tags,
    {
      Component = "compute"
      Purpose   = "web-server"
    }
  )
}
