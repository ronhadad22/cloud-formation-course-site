terraform {
  source = "../modules/ec2"
}

dependency "vpc" {
  config_path = "../vpc"
}

inputs = {
  instance_name = "terragrunt-demo-instance"
  instance_type = "t2.micro"
  vpc_id        = dependency.vpc.outputs.vpc_id
  subnet_id     = dependency.vpc.outputs.public_subnet_ids[0]
  environment   = "learning"
  
  tags = {
    ManagedBy = "Terragrunt"
    Course    = "Terragrunt-Modules"
    Module    = "EC2"
  }
}
