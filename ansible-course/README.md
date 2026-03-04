# Ansible Course - Configuration Management & Automation

Welcome to the comprehensive Ansible learning course! This course will take you from Ansible basics to advanced automation patterns and best practices.

## 📚 Course Overview

Ansible is an open-source automation tool for configuration management, application deployment, and task automation. It uses a simple, human-readable language (YAML) and operates over SSH without requiring agents on managed nodes.

## 🎯 Learning Objectives

By the end of this course, you will be able to:

- Understand Ansible architecture and core concepts
- Write and execute Ansible playbooks
- Manage inventory (static and dynamic)
- Use variables, facts, and templates effectively
- Create reusable roles for modular automation
- Implement security with Ansible Vault
- Apply best practices for production environments
- Integrate Ansible with CI/CD pipelines
- Manage cloud infrastructure with Ansible

## 📖 Course Structure

### Lesson 1: Ansible Basics
- **01-installation**: Installing Ansible and prerequisites
- **02-inventory**: Static inventory files and host patterns
- **03-ad-hoc-commands**: Running quick commands without playbooks
- **04-first-playbook**: Your first Ansible playbook
- **05-modules**: Common Ansible modules (apt, yum, copy, file, service)

### Lesson 2: Playbooks & Variables
- **01-playbook-structure**: Understanding playbook anatomy
- **02-variables**: Defining and using variables
- **03-facts**: Gathering and using system facts
- **04-conditionals**: When statements and conditional execution
- **05-loops**: Iterating over lists and dictionaries
- **06-handlers**: Triggering actions on changes

### Lesson 3: Templates & Roles
- **01-jinja2-templates**: Using Jinja2 for dynamic configurations
- **02-roles-basics**: Creating and using roles
- **03-role-structure**: Best practices for role organization
- **04-ansible-galaxy**: Using community roles from Galaxy
- **05-role-dependencies**: Managing role dependencies

### Lesson 4: Advanced Topics
- **01-ansible-vault**: Encrypting sensitive data
- **02-dynamic-inventory**: AWS, Azure, and custom dynamic inventories
- **03-error-handling**: Blocks, rescue, and always
- **04-tags**: Selective playbook execution
- **05-async-parallel**: Asynchronous tasks and parallelism
- **06-custom-modules**: Writing custom Ansible modules

### Lesson 5: Best Practices & Production
- **01-directory-structure**: Organizing large projects
- **02-testing**: Molecule, Ansible-lint, and testing strategies
- **03-ci-cd-integration**: Jenkins, GitLab CI, GitHub Actions
- **04-performance**: Optimization and performance tuning
- **05-security**: Security best practices
- **06-troubleshooting**: Debugging and common issues

## 🔧 Prerequisites

### Required Knowledge
- Basic Linux command line skills
- Understanding of YAML syntax
- SSH and basic networking concepts
- Familiarity with system administration

### Software Requirements
- **Ansible**: Version 2.9 or higher (2.15+ recommended)
- **Python**: 3.8 or higher
- **SSH Client**: OpenSSH or equivalent
- **Text Editor**: VS Code, Vim, or your preferred editor
- **Target Systems**: Linux VMs or cloud instances for practice

## 🚀 Installation

### On Control Node (Ubuntu/Debian)
```bash
# Update package index
sudo apt update

# Install Ansible
sudo apt install -y ansible

# Verify installation
ansible --version
```

### On Control Node (RHEL/CentOS)
```bash
# Install EPEL repository
sudo yum install -y epel-release

# Install Ansible
sudo yum install -y ansible

# Verify installation
ansible --version
```

### Using pip (All platforms)
```bash
# Install Ansible via pip
pip3 install ansible

# Verify installation
ansible --version
```

## 🔑 Key Concepts

### Control Node vs Managed Nodes
- **Control Node**: Machine where Ansible is installed and playbooks are run
- **Managed Nodes**: Target machines that Ansible configures

### Inventory
- List of managed nodes organized into groups
- Can be static (INI/YAML files) or dynamic (scripts/plugins)

### Playbooks
- YAML files containing automation tasks
- Declarative description of desired state

### Modules
- Reusable units of code that perform specific tasks
- Examples: `apt`, `yum`, `copy`, `template`, `service`

### Roles
- Organized collection of tasks, variables, files, and templates
- Promotes code reuse and modularity

### Idempotency
- Running the same playbook multiple times produces the same result
- Only makes changes when necessary

### Facts
- System information automatically gathered by Ansible
- Used for conditional logic and templates

## 📝 Quick Start Example

```yaml
# playbook.yml
---
- name: Configure web servers
  hosts: webservers
  become: yes
  
  tasks:
    - name: Install nginx
      apt:
        name: nginx
        state: present
        update_cache: yes
    
    - name: Start nginx service
      service:
        name: nginx
        state: started
        enabled: yes
```

Run with:
```bash
ansible-playbook -i inventory.ini playbook.yml
```

## 🎓 Learning Path

1. **Week 1**: Complete Lesson 1 (Ansible Basics)
2. **Week 2**: Complete Lesson 2 (Playbooks & Variables)
3. **Week 3**: Complete Lesson 3 (Templates & Roles)
4. **Week 4**: Complete Lesson 4 (Advanced Topics)
5. **Week 5**: Complete Lesson 5 (Best Practices & Production)
6. **Week 6**: Final project - Deploy a complete application stack

## 📚 Additional Resources

- [Official Ansible Documentation](https://docs.ansible.com/)
- [Ansible Galaxy](https://galaxy.ansible.com/) - Community roles
- [Ansible GitHub Repository](https://github.com/ansible/ansible)
- [Ansible Best Practices](https://docs.ansible.com/ansible/latest/user_guide/playbooks_best_practices.html)
- [Molecule Testing Framework](https://molecule.readthedocs.io/)

## 🤝 Contributing

This course is designed for educational purposes. Feel free to extend examples and add your own use cases.

## 📄 License

Educational use only. Examples are provided as-is for learning purposes.

---

**Ready to automate?** Start with [Lesson 1: Ansible Basics](./01-ansible-basics/README.md)!
