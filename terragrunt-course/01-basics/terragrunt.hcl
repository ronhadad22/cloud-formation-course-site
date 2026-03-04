terraform {
  source = "${path_relative_from_include()}/terraform"
}

inputs = {
  bucket_name = "terragrunt-demo-bucket-${get_aws_account_id()}"
  environment = "learning"
  
  tags = {
    ManagedBy   = "Terragrunt"
    Environment = "Learning"
    Course      = "Terragrunt-Basics"
  }
}
