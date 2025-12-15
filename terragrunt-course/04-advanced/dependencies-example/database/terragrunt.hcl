terraform {
  source = "../../../02-modules/modules/vpc"
}

inputs = {
  vpc_name    = "database-vpc"
  vpc_cidr    = "10.10.0.0/16"
  environment = "dependencies-demo"
  
  tags = {
    ManagedBy = "Terragrunt"
    Example   = "Dependencies"
    Layer     = "Database"
  }
}
