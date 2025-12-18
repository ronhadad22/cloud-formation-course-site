# Development Account Configuration

locals {
  # AWS Account ID for development
  aws_account_id = "111111111111"  # Replace with your actual dev account ID
  
  # Account name
  account_name = "dev"
  
  # Environment
  environment = "development"
  
  # IAM role for Terragrunt to assume (optional)
  # Useful for cross-account deployments
  iam_role = ""  # e.g., "arn:aws:iam::111111111111:role/TerraformDeployRole"
  
  # Account-specific tags
  account_tags = {
    Environment = "development"
    CostCenter  = "engineering"
    Owner       = "devops-team"
  }
  
  # Account-specific settings
  enable_deletion_protection = false
  enable_backup             = false
  log_retention_days        = 7
  
  # Network settings
  vpc_cidr = "10.0.0.0/16"
  
  # Instance settings
  default_instance_type = "t3.micro"
  enable_monitoring     = false
}
