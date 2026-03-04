# Infrastructure as Code & Configuration Management Course Index

Complete learning path for Terraform, Terragrunt, and Ansible.

## 📚 Terraform Course

**Location:** `terraform-course/`

### 01-terraform-basics
- First resource deployment
- Variables and outputs
- Data sources
- State management

### 02-terraform-features
- Count and for_each
- Dynamic blocks
- Functions
- Conditionals
- Lifecycle rules
- Locals

### 03-advanced-deployments
- Module development
- Workspaces
- Remote state
- Import infrastructure
- Multi-cloud

### 04-best-practices
- Security
- Testing
- CI/CD
- Drift detection
- Cost optimization

## 🚀 Terragrunt Course

**Location:** `terragrunt-course/`

### 01-basics
- Terragrunt fundamentals
- Basic configuration
- First deployment

### 02-modules
- Reusable modules
- Dependencies
- Run-all commands

### 03-multi-env
- Environment management
- DRY configuration
- Remote state

### 04-advanced
- Hooks
- Complex dependencies
- Generate blocks
- Mock outputs

## ⚙️ Ansible Course

**Location:** `ansible-course/`

### 01-ansible-basics
- Installation and setup
- Inventory management (static)
- Ad-hoc commands
- First playbook
- Common modules (apt, yum, copy, file, service)

### 02-playbooks-variables
- Playbook structure
- Variables and variable files
- Ansible facts
- Conditionals (when statements)
- Loops (loop, with_items)
- Handlers

### 03-templates-roles
- Jinja2 templates
- Creating roles
- Role structure and organization
- Ansible Galaxy
- Role dependencies

### 04-advanced-topics
- Ansible Vault (secrets management)
- Dynamic inventory (AWS, Azure)
- Error handling (block/rescue/always)
- Tags for selective execution
- Async and parallel tasks
- Custom modules

### 05-best-practices
- Directory structure
- Testing (ansible-lint, Molecule)
- CI/CD integration (GitHub Actions, Jenkins)
- Performance optimization
- Security best practices
- Troubleshooting

## 🎯 Recommended Learning Path

### Path 1: Infrastructure Provisioning
1. **Terraform Basics** - Learn infrastructure as code fundamentals
2. **Terraform Features** - Master advanced Terraform capabilities
3. **Terraform Advanced** - Deploy complex infrastructure
4. **Terragrunt** - Add DRY principles and multi-environment management
5. **Best Practices** - Production-ready infrastructure code

### Path 2: Configuration Management
1. **Ansible Basics** - Learn automation fundamentals
2. **Playbooks & Variables** - Write sophisticated automation
3. **Templates & Roles** - Create reusable automation
4. **Advanced Topics** - Master complex scenarios
5. **Best Practices** - Production-ready configuration management

### Path 3: Complete DevOps Stack (Recommended)
1. **Terraform Basics** - Provision infrastructure
2. **Ansible Basics** - Configure systems
3. **Terraform Features** - Advanced provisioning
4. **Ansible Playbooks** - Advanced configuration
5. **Terraform Advanced** - Complex deployments
6. **Ansible Roles** - Modular automation
7. **Terragrunt** - Multi-environment infrastructure
8. **Ansible Advanced** - Vault, dynamic inventory
9. **Best Practices** - Production-ready for both

## 🔄 Integration Patterns

### Terraform + Ansible
- Use Terraform to provision infrastructure
- Use Ansible to configure provisioned resources
- Terraform outputs → Ansible inventory
- Dynamic inventory from cloud providers

### Terragrunt + Ansible
- Terragrunt for environment-specific infrastructure
- Ansible for environment-specific configuration
- Shared variable management
- Coordinated deployments

## 📖 Additional Resources

### Terraform
- [Terraform Documentation](https://www.terraform.io/docs)
- [Terraform Registry](https://registry.terraform.io/)
- [HashiCorp Learn](https://learn.hashicorp.com/terraform)

### Terragrunt
- [Terragrunt Documentation](https://terragrunt.gruntwork.io/)
- [Gruntwork Blog](https://blog.gruntwork.io/)

### Ansible
- [Ansible Documentation](https://docs.ansible.com/)
- [Ansible Galaxy](https://galaxy.ansible.com/)
- [Ansible GitHub](https://github.com/ansible/ansible)

### General
- AWS Documentation
- Azure Documentation
- GCP Documentation
- DevOps Best Practices

## 🎓 Course Completion

After completing all three courses, you will be able to:
- ✅ Provision infrastructure with Terraform
- ✅ Manage multi-environment deployments with Terragrunt
- ✅ Automate configuration with Ansible
- ✅ Implement CI/CD pipelines
- ✅ Apply security best practices
- ✅ Build production-ready infrastructure
- ✅ Troubleshoot and optimize deployments
