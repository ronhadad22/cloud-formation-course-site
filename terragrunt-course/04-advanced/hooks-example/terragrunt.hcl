terraform {
  source = "../../01-basics/terraform"
  
  before_hook "validate_environment" {
    commands = ["apply", "plan"]
    execute  = ["echo", "🔍 Validating environment before Terraform operation..."]
  }
  
  before_hook "check_aws_credentials" {
    commands = ["apply", "plan"]
    execute  = ["echo", "✓ AWS credentials check would run here"]
  }
  
  after_hook "notify_success" {
    commands     = ["apply"]
    execute      = ["echo", "✅ Deployment successful! Resources have been created."]
    run_on_error = false
  }
  
  after_hook "cleanup_temp_files" {
    commands     = ["apply", "destroy"]
    execute      = ["echo", "🧹 Cleanup operations would run here"]
    run_on_error = true
  }
}

inputs = {
  bucket_name = "terragrunt-hooks-demo-${get_aws_account_id()}"
  environment = "hooks-demo"
  
  tags = {
    ManagedBy = "Terragrunt"
    Example   = "Hooks"
    Course    = "Advanced-Terragrunt"
  }
}
