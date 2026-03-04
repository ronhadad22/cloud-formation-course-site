# Staging Account Configuration

locals {
  # AWS Account ID for staging
  aws_account_id = "222222222222"  # Replace with your actual staging account ID
  
  # Account name
  account_name = "staging"
  
  # Environment
  environment = "staging"
  
  # IAM role for Terragrunt to assume (optional)
  iam_role = ""  # e.g., "arn:aws:iam::222222222222:role/TerraformDeployRole"
  
  # Account-specific tags
  account_tags = {
    Environment = "staging"
    CostCenter  = "engineering"
    Owner       = "devops-team"
  }
  
  # Account-specific settings
  enable_deletion_protection = false
  enable_backup             = true
  log_retention_days        = 30
  
  # Network settings
  vpc_cidr = "10.1.0.0/16"
  
  # Instance settings
  default_instance_type = "t3.small"
  enable_monitoring     = true
}
