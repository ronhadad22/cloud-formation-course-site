# Production Account Configuration

locals {
  # AWS Account ID for production
  aws_account_id = "333333333333"  # Replace with your actual prod account ID
  
  # Account name
  account_name = "prod"
  
  # Environment
  environment = "production"
  
  # IAM role for Terragrunt to assume (optional)
  iam_role = ""  # e.g., "arn:aws:iam::333333333333:role/TerraformDeployRole"
  
  # Account-specific tags
  account_tags = {
    Environment = "production"
    CostCenter  = "operations"
    Owner       = "platform-team"
    Compliance  = "required"
  }
  
  # Account-specific settings
  enable_deletion_protection = true
  enable_backup             = true
  log_retention_days        = 90
  
  # Network settings
  vpc_cidr = "10.2.0.0/16"
  
  # Instance settings
  default_instance_type = "t3.medium"
  enable_monitoring     = true
}
