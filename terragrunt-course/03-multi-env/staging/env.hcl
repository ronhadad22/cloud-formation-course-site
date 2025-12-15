locals {
  environment = "staging"
  aws_region  = "us-east-1"
  
  vpc_cidr = "10.1.0.0/16"
  
  instance_type = "t3.small"
  
  tags = {
    Environment = "Staging"
    CostCenter  = "Engineering"
  }
}
