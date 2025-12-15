locals {
  environment = "dev"
  aws_region  = "us-east-1"
  
  vpc_cidr = "10.0.0.0/16"
  
  instance_type = "t2.micro"
  
  tags = {
    Environment = "Development"
    CostCenter  = "Engineering"
  }
}
