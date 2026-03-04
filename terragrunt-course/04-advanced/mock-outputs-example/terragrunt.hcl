terraform {
  source = "../../02-modules/modules/ec2"
}

dependency "vpc" {
  config_path = "../../02-modules/vpc"
  
  mock_outputs = {
    vpc_id            = "vpc-mocktest123"
    public_subnet_ids = ["subnet-mocktest1", "subnet-mocktest2"]
    private_subnet_ids = ["subnet-mocktest3", "subnet-mocktest4"]
  }
  
  mock_outputs_allowed_terraform_commands = ["validate", "plan", "init"]
  
  mock_outputs_merge_strategy_with_state = "shallow"
}

inputs = {
  instance_name = "mock-demo-instance"
  instance_type = "t2.micro"
  vpc_id        = dependency.vpc.outputs.vpc_id
  subnet_id     = dependency.vpc.outputs.public_subnet_ids[0]
  environment   = "mock-demo"
  
  tags = {
    ManagedBy = "Terragrunt"
    Example   = "Mock-Outputs"
    Note      = "This can be planned without deploying VPC first!"
  }
}
