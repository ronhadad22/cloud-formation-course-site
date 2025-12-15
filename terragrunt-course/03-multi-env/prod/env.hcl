locals {
  environment = "prod"
  aws_region  = "us-east-1"
  
  vpc_cidr = "10.2.0.0/16"
  
  instance_type = "t3.medium"
  
  tags = {
    Environment = "Production"
    CostCenter  = "Operations"
  }
}
