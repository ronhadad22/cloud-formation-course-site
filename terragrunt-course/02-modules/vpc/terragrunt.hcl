terraform {
  source = "../modules/vpc"
}

inputs = {
  vpc_name    = "terragrunt-demo-vpc"
  vpc_cidr    = "10.0.0.0/16"
  environment = "learning"
  
  tags = {
    ManagedBy = "Terragrunt"
    Course    = "Terragrunt-Modules"
    Module    = "VPC"
  }
}
