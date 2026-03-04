# Terragrunt Course - Infrastructure as Code Made Easy

## 📚 Course Overview

This course teaches you how to use Terragrunt to manage Terraform configurations efficiently. Terragrunt is a thin wrapper for Terraform that provides extra tools for keeping your configurations DRY (Don't Repeat Yourself), working with multiple Terraform modules, and managing remote state.

## 🎯 Learning Objectives

By the end of this course, you will be able to:
- Understand the relationship between Terraform and Terragrunt
- Write DRY infrastructure code using Terragrunt
- Manage multiple environments (dev, staging, prod) efficiently
- Use Terragrunt to handle remote state and locking
- Implement dependency management between modules
- Apply best practices for infrastructure organization

## 📖 Course Structure

### 01-basics
Introduction to Terragrunt fundamentals:
- What is Terragrunt and why use it?
- Basic terragrunt.hcl configuration
- Your first Terragrunt deployment

### 02-modules
Working with Terraform modules:
- Creating reusable Terraform modules
- Referencing modules with Terragrunt
- Passing inputs and outputs

### 03-multi-env
Managing multiple environments:
- DRY configuration with parent terragrunt.hcl
- Environment-specific configurations
- Remote state management per environment

### 04-advanced
Advanced Terragrunt features:
- Dependencies between modules
- Hooks and extra arguments
- Generate blocks
- Mock outputs for testing

## 🚀 Prerequisites

- Basic understanding of Terraform
- AWS account (for examples)
- Installed tools:
  - Terraform (>= 1.0)
  - Terragrunt (>= 0.45)
  - AWS CLI configured

## 📝 Installation

### Install Terraform
```bash
# macOS
brew install terraform

# Linux
wget https://releases.hashicorp.com/terraform/1.6.0/terraform_1.6.0_linux_amd64.zip
unzip terraform_1.6.0_linux_amd64.zip
sudo mv terraform /usr/local/bin/
```

### Install Terragrunt
```bash
# macOS
brew install terragrunt

# Linux
wget https://github.com/gruntwork-io/terragrunt/releases/download/v0.54.0/terragrunt_linux_amd64
chmod +x terragrunt_linux_amd64
sudo mv terragrunt_linux_amd64 /usr/local/bin/terragrunt
```

### Verify Installation
```bash
terraform --version
terragrunt --version
```

## 🏃 Getting Started

1. Start with `01-basics` to understand Terragrunt fundamentals
2. Progress through each module in order
3. Each directory contains a README with specific instructions
4. Try the exercises before looking at solutions

## 💡 Key Concepts

### Terragrunt vs Terraform
- **Terraform**: Infrastructure provisioning tool
- **Terragrunt**: Wrapper that adds functionality to Terraform
- Terragrunt generates Terraform configurations and executes Terraform commands

### DRY Principle
Terragrunt helps you avoid repeating:
- Backend configuration
- Provider configuration
- Common variables
- Module sources

### Common Commands
```bash
# Initialize
terragrunt init

# Plan changes
terragrunt plan

# Apply changes
terragrunt apply

# Destroy resources
terragrunt destroy

# Run command in all modules
terragrunt run-all plan
terragrunt run-all apply
```

## 📚 Additional Resources

- [Terragrunt Documentation](https://terragrunt.gruntwork.io/)
- [Terraform Documentation](https://www.terraform.io/docs)
- [Gruntwork Blog](https://blog.gruntwork.io/)

## 🤝 Support

If you have questions during the course:
1. Check the README in each lesson directory
2. Review the Terragrunt documentation
3. Ask your instructor

## ⚠️ Important Notes

- Always run `terragrunt plan` before `terragrunt apply`
- Be careful with `terragrunt destroy` - it deletes real resources
- Use separate AWS accounts or regions for practice
- Never commit sensitive data (credentials, secrets) to version control

---

**Ready to start?** Head to `01-basics` to begin your Terragrunt journey!
