# Lesson 04: Best Practices

## 🎯 Learning Goals

- Implement security best practices
- Manage secrets and sensitive data
- Apply testing strategies
- Integrate with CI/CD pipelines
- Detect and remediate drift
- Optimize costs
- Structure code for maintainability

## 📖 Production Best Practices

This lesson covers essential practices for production Terraform:
- **Security**: Protect credentials and sensitive data
- **Testing**: Validate configurations before deployment
- **CI/CD**: Automate infrastructure deployments
- **Monitoring**: Detect drift and changes
- **Cost**: Optimize infrastructure spending
- **Organization**: Structure code for teams

## 🔐 Security Best Practices

### 1. Never Hardcode Credentials

**Bad:**
```hcl
provider "aws" {
  access_key = "AKIAIOSFODNN7EXAMPLE"
  secret_key = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
}
```

**Good:**
```hcl
provider "aws" {
  # Uses AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY env vars
  # Or uses IAM role from EC2 instance profile
  # Or uses AWS SSO
}
```

### 2. Use AWS Secrets Manager / Parameter Store

```hcl
data "aws_secretsmanager_secret" "db_password" {
  name = "prod/database/password"
}

data "aws_secretsmanager_secret_version" "db_password" {
  secret_id = data.aws_secretsmanager_secret.db_password.id
}

resource "aws_db_instance" "main" {
  password = data.aws_secretsmanager_secret_version.db_password.secret_string
}
```

### 3. Encrypt State Files

```hcl
terraform {
  backend "s3" {
    bucket         = "my-terraform-state"
    key            = "terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    kms_key_id     = "arn:aws:kms:us-east-1:123456789012:key/12345678"
    dynamodb_table = "terraform-locks"
  }
}
```

### 4. Use Sensitive Variables

```hcl
variable "database_password" {
  description = "Database password"
  type        = string
  sensitive   = true
}

output "db_endpoint" {
  value     = aws_db_instance.main.endpoint
  sensitive = true
}
```

### 5. Implement Least Privilege IAM

```hcl
resource "aws_iam_role" "terraform" {
  name = "terraform-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ec2.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy" "terraform" {
  name = "terraform-policy"
  role = aws_iam_role.terraform.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "s3:GetObject",
        "s3:PutObject",
        "dynamodb:GetItem",
        "dynamodb:PutItem"
      ]
      Resource = [
        "arn:aws:s3:::my-terraform-state/*",
        "arn:aws:dynamodb:*:*:table/terraform-locks"
      ]
    }]
  })
}
```

### 6. Enable MFA for Sensitive Operations

```hcl
terraform {
  backend "s3" {
    bucket         = "my-terraform-state"
    key            = "terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-locks"
    
    # Require MFA for state modifications
    mfa_serial = "arn:aws:iam::123456789012:mfa/user"
  }
}
```

## 🧪 Testing Strategies

### 1. Validation

```bash
# Validate syntax
terraform validate

# Format code
terraform fmt -recursive

# Check for security issues
tfsec .
checkov -d .
```

### 2. Pre-commit Hooks

**.pre-commit-config.yaml:**
```yaml
repos:
  - repo: https://github.com/antonbabenko/pre-commit-terraform
    rev: v1.83.0
    hooks:
      - id: terraform_fmt
      - id: terraform_validate
      - id: terraform_docs
      - id: terraform_tflint
      - id: terraform_tfsec
```

### 3. Terratest (Go-based testing)

```go
package test

import (
    "testing"
    "github.com/gruntwork-io/terratest/modules/terraform"
    "github.com/stretchr/testify/assert"
)

func TestTerraformVPC(t *testing.T) {
    terraformOptions := &terraform.Options{
        TerraformDir: "../modules/vpc",
        Vars: map[string]interface{}{
            "vpc_name": "test-vpc",
            "vpc_cidr": "10.0.0.0/16",
        },
    }

    defer terraform.Destroy(t, terraformOptions)
    terraform.InitAndApply(t, terraformOptions)

    vpcId := terraform.Output(t, terraformOptions, "vpc_id")
    assert.NotEmpty(t, vpcId)
}
```

### 4. Policy as Code (OPA/Sentinel)

**policy.rego (Open Policy Agent):**
```rego
package terraform

deny[msg] {
    resource := input.resource_changes[_]
    resource.type == "aws_s3_bucket"
    not resource.change.after.versioning[_].enabled
    msg := sprintf("S3 bucket %s must have versioning enabled", [resource.address])
}
```

## 🚀 CI/CD Integration

### GitHub Actions Example

**.github/workflows/terraform.yml:**
```yaml
name: Terraform

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  terraform:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Terraform
      uses: hashicorp/setup-terraform@v2
      with:
        terraform_version: 1.6.0
    
    - name: Terraform Format
      run: terraform fmt -check -recursive
    
    - name: Terraform Init
      run: terraform init
      env:
        AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
        AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
    
    - name: Terraform Validate
      run: terraform validate
    
    - name: Terraform Plan
      run: terraform plan -out=tfplan
      env:
        AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
        AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
    
    - name: Terraform Apply
      if: github.ref == 'refs/heads/main' && github.event_name == 'push'
      run: terraform apply -auto-approve tfplan
      env:
        AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
        AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

### GitLab CI Example

**.gitlab-ci.yml:**
```yaml
stages:
  - validate
  - plan
  - apply

variables:
  TF_ROOT: ${CI_PROJECT_DIR}
  TF_STATE_NAME: default

cache:
  paths:
    - ${TF_ROOT}/.terraform

before_script:
  - cd ${TF_ROOT}
  - terraform init

validate:
  stage: validate
  script:
    - terraform validate
    - terraform fmt -check

plan:
  stage: plan
  script:
    - terraform plan -out=tfplan
  artifacts:
    paths:
      - tfplan

apply:
  stage: apply
  script:
    - terraform apply -auto-approve tfplan
  when: manual
  only:
    - main
```

## 📊 Drift Detection

### 1. Scheduled Drift Detection

```bash
#!/bin/bash
# drift-detection.sh

terraform plan -detailed-exitcode

EXIT_CODE=$?

if [ $EXIT_CODE -eq 1 ]; then
    echo "Error running terraform plan"
    exit 1
elif [ $EXIT_CODE -eq 2 ]; then
    echo "Drift detected! Infrastructure has changed outside Terraform"
    # Send alert (Slack, email, etc.)
    exit 2
else
    echo "No drift detected"
    exit 0
fi
```

### 2. Terraform Cloud Drift Detection

```hcl
# Enable drift detection in Terraform Cloud
resource "tfe_workspace" "main" {
  name         = "my-workspace"
  organization = "my-org"
  
  # Run drift detection daily
  assessments_enabled = true
}
```

### 3. AWS Config for Compliance

```hcl
resource "aws_config_configuration_recorder" "main" {
  name     = "config-recorder"
  role_arn = aws_iam_role.config.arn

  recording_group {
    all_supported = true
  }
}

resource "aws_config_delivery_channel" "main" {
  name           = "config-delivery"
  s3_bucket_name = aws_s3_bucket.config.id
}
```

## 💰 Cost Optimization

### 1. Use Infracost

```bash
# Install infracost
brew install infracost

# Generate cost estimate
infracost breakdown --path .

# Compare costs
infracost diff --path .
```

### 2. Right-sizing Resources

```hcl
locals {
  instance_type = var.environment == "prod" ? "t3.large" : "t3.micro"
  
  # Use spot instances for non-critical workloads
  use_spot = var.environment != "prod"
}

resource "aws_instance" "web" {
  instance_type = local.instance_type
  
  instance_market_options {
    market_type = local.use_spot ? "spot" : null
  }
}
```

### 3. Lifecycle Policies

```hcl
resource "aws_s3_bucket_lifecycle_configuration" "logs" {
  bucket = aws_s3_bucket.logs.id

  rule {
    id     = "transition-to-glacier"
    status = "Enabled"

    transition {
      days          = 30
      storage_class = "GLACIER"
    }

    expiration {
      days = 90
    }
  }
}
```

### 4. Auto-scaling

```hcl
resource "aws_autoscaling_group" "web" {
  min_size         = var.environment == "prod" ? 2 : 1
  max_size         = var.environment == "prod" ? 10 : 2
  desired_capacity = var.environment == "prod" ? 3 : 1
  
  # Scale down during off-hours
  enabled_metrics = [
    "GroupMinSize",
    "GroupMaxSize",
    "GroupDesiredCapacity"
  ]
}
```

## 📁 Code Organization

### Project Structure

```
infrastructure/
├── modules/                    # Reusable modules
│   ├── vpc/
│   ├── compute/
│   └── database/
├── environments/               # Environment-specific configs
│   ├── dev/
│   │   ├── backend.tf
│   │   ├── main.tf
│   │   └── terraform.tfvars
│   ├── staging/
│   └── prod/
├── policies/                   # OPA/Sentinel policies
│   └── security.rego
├── scripts/                    # Helper scripts
│   ├── drift-detection.sh
│   └── cost-estimate.sh
├── tests/                      # Terratest tests
│   └── vpc_test.go
├── .github/
│   └── workflows/
│       └── terraform.yml
├── .pre-commit-config.yaml
├── .gitignore
└── README.md
```

### Naming Conventions

```hcl
# Resources: type_purpose
resource "aws_instance" "web_server" {}
resource "aws_s3_bucket" "application_logs" {}

# Variables: descriptive_name
variable "vpc_cidr_block" {}
variable "instance_count" {}

# Modules: purpose
module "networking" {}
module "compute_cluster" {}

# Outputs: resource_attribute
output "vpc_id" {}
output "instance_public_ips" {}
```

## ✅ Checklist

- [ ] Never commit secrets to version control
- [ ] Use remote state with encryption
- [ ] Implement automated testing
- [ ] Set up CI/CD pipeline
- [ ] Enable drift detection
- [ ] Monitor costs regularly
- [ ] Follow consistent naming conventions
- [ ] Document all modules
- [ ] Use pre-commit hooks
- [ ] Implement policy as code

## 🎓 Final Quiz

1. How should you manage database passwords in Terraform?
2. What's the purpose of state locking?
3. How do you detect infrastructure drift?
4. What tools can you use for cost estimation?
5. Why use pre-commit hooks?
6. How do you test Terraform code?
7. What's the benefit of separating environments?

## 🎉 Congratulations!

You've completed the Terraform course! You now know:
- Terraform fundamentals and syntax
- Advanced features (count, for_each, dynamic blocks)
- Module development and reuse
- Production deployment patterns
- Security and best practices
- Testing and CI/CD integration

## 📚 Next Steps

1. **Practice**: Build real infrastructure projects
2. **Certification**: HashiCorp Certified: Terraform Associate
3. **Advanced Topics**: 
   - Terraform Cloud/Enterprise
   - Custom providers
   - Complex state management
4. **Integration**: Combine with Terragrunt (see ../terragrunt-course)
5. **Community**: Join Terraform community forums and contribute

Keep learning and building! 🚀
