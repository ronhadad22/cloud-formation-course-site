terraform {
  source = "./terraform"
}

dependency "app" {
  config_path = "../app"
  
  mock_outputs = {
    instance_id = "i-mock123"
  }
  
  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
}

inputs = {
  instance_id = dependency.app.outputs.instance_id
  environment = "dependencies-demo"
  
  alarm_threshold = 80
  
  tags = {
    ManagedBy = "Terragrunt"
    Example   = "Dependencies"
    Layer     = "Monitoring"
    DependsOn = "Application"
  }
}
