# Lesson 04: Advanced Terragrunt Features

## 🎯 Learning Goals

- Use hooks to run commands before/after Terraform operations
- Implement complex dependencies between modules
- Use generate blocks to create files dynamically
- Understand mock outputs for testing
- Apply extra arguments to Terraform commands
- Use before/after hooks for validation and notifications

## 📖 Advanced Features Overview

Terragrunt provides powerful features beyond basic module management:
- **Hooks**: Run commands at specific points in the workflow
- **Dependencies**: Complex dependency graphs between modules
- **Generate Blocks**: Create files dynamically (providers, backends, etc.)
- **Mock Outputs**: Test modules without deploying dependencies
- **Extra Arguments**: Pass additional flags to Terraform
- **Locals**: Compute values dynamically

## 🏗️ Project Structure

```
04-advanced/
├── README.md
├── hooks-example/
│   └── terragrunt.hcl       # Before/after hooks
├── dependencies-example/
│   ├── database/
│   ├── app/
│   └── monitoring/
├── generate-example/
│   └── terragrunt.hcl       # Dynamic file generation
└── mock-outputs-example/
    └── terragrunt.hcl       # Testing with mocks
```

## 📝 Exercise 1: Hooks

Hooks allow you to run commands before or after Terraform operations.

### Common Use Cases
- Validate configuration before apply
- Send notifications after deployment
- Run security scans
- Update documentation
- Trigger CI/CD pipelines

### Example: Validation Hook

```hcl
terraform {
  before_hook "validate_environment" {
    commands = ["apply", "plan"]
    execute  = ["echo", "Validating environment variables..."]
  }
  
  after_hook "notify_success" {
    commands     = ["apply"]
    execute      = ["echo", "Deployment successful!"]
    run_on_error = false
  }
}
```

### Try It

```bash
cd hooks-example
terragrunt plan
# Notice the hook messages before and after
```

## 📝 Exercise 2: Complex Dependencies

Create a dependency graph where modules depend on each other.

### Scenario
```
database (RDS)
    ↓
application (ECS)
    ↓
monitoring (CloudWatch)
```

### Dependency Configuration

```hcl
# In app/terragrunt.hcl
dependency "database" {
  config_path = "../database"
  
  # Optional: Mock outputs for testing
  mock_outputs = {
    db_endpoint = "mock-endpoint"
    db_port     = 5432
  }
  
  # Optional: Skip if dependency doesn't exist
  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
}

inputs = {
  db_endpoint = dependency.database.outputs.db_endpoint
  db_port     = dependency.database.outputs.db_port
}
```

### Deploy with Dependencies

```bash
cd dependencies-example

# Terragrunt automatically determines order
terragrunt run-all plan
terragrunt run-all apply
```

## 📝 Exercise 3: Generate Blocks

Generate blocks create files dynamically before Terraform runs.

### Use Cases
- Generate provider configurations
- Create backend configurations
- Generate tfvars files
- Create version constraints

### Example: Generate Provider

```hcl
generate "provider" {
  path      = "provider.tf"
  if_exists = "overwrite"
  
  contents = <<EOF
provider "aws" {
  region = "us-east-1"
  
  assume_role {
    role_arn = "arn:aws:iam::123456789012:role/TerraformRole"
  }
}
EOF
}
```

### Try It

```bash
cd generate-example
terragrunt init

# Check generated files
ls -la .terragrunt-cache/*/provider.tf
```

## 📝 Exercise 4: Mock Outputs

Mock outputs allow you to test modules without deploying dependencies.

### Why Mock Outputs?

- Test module configuration without deploying everything
- Speed up plan operations
- Validate changes in isolation

### Example

```hcl
dependency "vpc" {
  config_path = "../vpc"
  
  mock_outputs = {
    vpc_id            = "vpc-mock123"
    public_subnet_ids = ["subnet-mock1", "subnet-mock2"]
  }
  
  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
}
```

Now you can run `terragrunt plan` even if VPC doesn't exist!

## 🔍 Advanced Patterns

### Pattern 1: Environment-Specific Hooks

```hcl
locals {
  env = read_terragrunt_config(find_in_parent_folders("env.hcl"))
}

terraform {
  after_hook "prod_approval" {
    commands = ["apply"]
    execute  = local.env.locals.environment == "prod" ? 
               ["echo", "Production deployment complete!"] : 
               ["echo", "Non-prod deployment complete"]
  }
}
```

### Pattern 2: Conditional Dependencies

```hcl
dependencies {
  paths = local.environment == "prod" ? 
          ["../monitoring", "../backup"] : 
          ["../monitoring"]
}
```

### Pattern 3: Dynamic Inputs

```hcl
locals {
  common_tags = {
    ManagedBy   = "Terragrunt"
    Environment = local.environment
    Timestamp   = timestamp()
  }
}

inputs = {
  tags = merge(local.common_tags, {
    Module = "vpc"
  })
}
```

## 💡 Best Practices

### 1. Use Mock Outputs for Fast Feedback
```hcl
mock_outputs_allowed_terraform_commands = ["validate", "plan"]
```

### 2. Validate Before Apply
```hcl
before_hook "validate" {
  commands = ["apply"]
  execute  = ["terraform", "validate"]
}
```

### 3. Use Locals for Complex Logic
```hcl
locals {
  is_prod = local.environment == "prod"
  instance_count = local.is_prod ? 3 : 1
}
```

### 4. Handle Errors Gracefully
```hcl
after_hook "cleanup" {
  commands     = ["apply"]
  execute      = ["./cleanup.sh"]
  run_on_error = true  # Run even if apply fails
}
```

### 5. Document Dependencies
```hcl
# This module depends on:
# - VPC (for networking)
# - RDS (for database connection)
# - S3 (for file storage)
dependency "vpc" { ... }
dependency "rds" { ... }
dependency "s3" { ... }
```

## 🚀 Real-World Example

Complete production-ready configuration:

```hcl
include "root" {
  path = find_in_parent_folders()
}

locals {
  env_vars    = read_terragrunt_config(find_in_parent_folders("env.hcl"))
  environment = local.env_vars.locals.environment
  region      = local.env_vars.locals.aws_region
  
  common_tags = {
    Environment = local.environment
    ManagedBy   = "Terragrunt"
    Repository  = "github.com/company/infrastructure"
  }
}

terraform {
  source = "git::git@github.com:company/terraform-modules.git//vpc?ref=v1.0.0"
  
  before_hook "validate_aws_creds" {
    commands = ["plan", "apply"]
    execute  = ["aws", "sts", "get-caller-identity"]
  }
  
  after_hook "notify_slack" {
    commands     = ["apply"]
    execute      = ["./notify-slack.sh", local.environment]
    run_on_error = false
  }
}

dependency "kms" {
  config_path = "../kms"
  
  mock_outputs = {
    key_id = "mock-key-id"
  }
  
  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
}

inputs = {
  vpc_name    = "${local.environment}-vpc"
  vpc_cidr    = local.env_vars.locals.vpc_cidr
  environment = local.environment
  kms_key_id  = dependency.kms.outputs.key_id
  
  tags = local.common_tags
}
```

## ✅ Checklist

- [ ] Understand and use before/after hooks
- [ ] Create complex dependency graphs
- [ ] Use generate blocks for dynamic files
- [ ] Test with mock outputs
- [ ] Apply conditional logic with locals
- [ ] Implement error handling in hooks
- [ ] Use run-all commands with dependencies

## 🎓 Quiz

1. When would you use a `before_hook` vs `after_hook`?
2. What's the purpose of mock outputs?
3. How does Terragrunt determine the order to apply modules?
4. What does `if_exists = "overwrite"` do in a generate block?
5. How can you run a hook only on errors?

## 🏆 Challenge

Create a complete infrastructure setup with:
1. VPC module with validation hooks
2. Database module depending on VPC
3. Application module depending on both
4. Monitoring module depending on application
5. Use mock outputs for fast planning
6. Add notification hooks for production

## 📚 Additional Resources

- [Terragrunt Hooks Documentation](https://terragrunt.gruntwork.io/docs/features/hooks/)
- [Dependencies Documentation](https://terragrunt.gruntwork.io/docs/features/execute-terraform-commands-on-multiple-modules-at-once/)
- [Generate Blocks Documentation](https://terragrunt.gruntwork.io/docs/features/keep-your-terraform-code-dry/)

## 🎉 Congratulations!

You've completed the Terragrunt course! You now know how to:
- Write DRY infrastructure code
- Manage multiple environments efficiently
- Use advanced features like hooks and dependencies
- Apply best practices for production infrastructure

Keep practicing and building more complex infrastructure!
