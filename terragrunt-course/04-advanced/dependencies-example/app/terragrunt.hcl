terraform {
  source = "../../../02-modules/modules/ec2"
}

dependency "database" {
  config_path = "../database"
  
  mock_outputs = {
    vpc_id            = "vpc-mock123"
    public_subnet_ids = ["subnet-mock1", "subnet-mock2"]
  }
  
  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
}

inputs = {
  instance_name = "app-server"
  instance_type = "t2.micro"
  vpc_id        = dependency.database.outputs.vpc_id
  subnet_id     = dependency.database.outputs.public_subnet_ids[0]
  environment   = "dependencies-demo"
  
  tags = {
    ManagedBy  = "Terragrunt"
    Example    = "Dependencies"
    Layer      = "Application"
    DependsOn  = "Database"
  }
}
