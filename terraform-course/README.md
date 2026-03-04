# Terraform Course - Infrastructure as Code Fundamentals

## 📚 Course Overview

This course teaches you Terraform from the ground up, covering core concepts, advanced features, and production deployment patterns. Terraform is an infrastructure as code tool that lets you define both cloud and on-prem resources in human-readable configuration files.

## 🎯 Learning Objectives

By the end of this course, you will be able to:
- Write and manage infrastructure as code using Terraform
- Understand Terraform's core concepts: providers, resources, data sources, variables, outputs
- Use advanced features: modules, workspaces, dynamic blocks, for_each, count
- Implement state management and remote backends
- Apply best practices for production deployments
- Integrate Terraform with CI/CD pipelines
- Debug and troubleshoot Terraform configurations

## 📖 Course Structure

### 01-terraform-basics
Terraform fundamentals:
- Installing and configuring Terraform
- Understanding HCL (HashiCorp Configuration Language)
- Providers and resources
- Variables and outputs
- State management basics

### 02-terraform-features
Core Terraform features:
- Data sources and locals
- Count and for_each meta-arguments
- Dynamic blocks
- Conditional expressions
- Functions and expressions
- Lifecycle rules

### 03-advanced-deployments
Production-ready patterns:
- Module development
- Workspaces for environment management
- Remote state and state locking
- Import existing infrastructure
- Terraform Cloud/Enterprise
- Multi-cloud deployments

### 04-best-practices
Production best practices:
- Code organization and structure
- Security and secrets management
- Testing strategies
- CI/CD integration
- Drift detection and remediation
- Cost optimization

## 🚀 Prerequisites

- Basic understanding of cloud infrastructure (AWS, Azure, or GCP)
- Command line familiarity
- Text editor or IDE
- Cloud provider account (AWS recommended for examples)

## 📝 Installation

### Install Terraform

**macOS:**
```bash
brew tap hashicorp/tap
brew install hashicorp/tap/terraform
```

**Linux:**
```bash
wget -O- https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
sudo apt update && sudo apt install terraform
```

**Windows:**
```powershell
choco install terraform
```

### Verify Installation
```bash
terraform version
```

### Configure AWS CLI
```bash
aws configure
# Enter your AWS Access Key ID
# Enter your AWS Secret Access Key
# Enter default region (e.g., us-east-1)
```

## 🏃 Getting Started

1. Start with `01-terraform-basics` to learn fundamentals
2. Progress through each module sequentially
3. Complete exercises in each lesson
4. Build the final project to demonstrate mastery

## 💡 Key Concepts

### Infrastructure as Code (IaC)
- Define infrastructure in version-controlled files
- Automate provisioning and management
- Enable collaboration and review processes
- Ensure consistency across environments

### Terraform Workflow
```bash
# 1. Write configuration
vim main.tf

# 2. Initialize (download providers)
terraform init

# 3. Plan changes
terraform plan

# 4. Apply changes
terraform apply

# 5. Destroy resources (when needed)
terraform destroy
```

### Core Components

**Providers**: Plugins that interact with APIs (AWS, Azure, GCP, etc.)
```hcl
provider "aws" {
  region = "us-east-1"
}
```

**Resources**: Infrastructure components to create
```hcl
resource "aws_instance" "web" {
  ami           = "ami-12345678"
  instance_type = "t2.micro"
}
```

**Variables**: Parameterize configurations
```hcl
variable "instance_type" {
  default = "t2.micro"
}
```

**Outputs**: Export values for use elsewhere
```hcl
output "instance_ip" {
  value = aws_instance.web.public_ip
}
```

## 📚 Additional Resources

- [Terraform Documentation](https://www.terraform.io/docs)
- [Terraform Registry](https://registry.terraform.io/)
- [HashiCorp Learn](https://learn.hashicorp.com/terraform)
- [Terraform Best Practices](https://www.terraform-best-practices.com/)

## 🔗 Related Courses

This course pairs well with:
- **Terragrunt Course** (`../terragrunt-course`) - Learn to keep Terraform DRY
- **AWS Course** - Deep dive into AWS services
- **DevOps Course** - CI/CD and automation

## ⚠️ Important Notes

- Always run `terraform plan` before `terraform apply`
- Never commit sensitive data (credentials, secrets) to version control
- Use remote state for team collaboration
- Tag all resources for cost tracking
- Use workspaces or separate state files for different environments

## 🎓 Certification Path

After completing this course, consider:
- HashiCorp Certified: Terraform Associate
- AWS Certified Solutions Architect
- Certified Kubernetes Administrator (for multi-cloud)

---

**Ready to start?** Head to `01-terraform-basics` to begin your Terraform journey!
