# Lesson 1: Ansible Basics

## 📚 Overview

This lesson introduces you to Ansible fundamentals, including installation, inventory management, ad-hoc commands, and your first playbook.

## 🎯 Learning Objectives

- Install and configure Ansible
- Understand inventory files and host patterns
- Execute ad-hoc commands
- Write and run basic playbooks
- Use common Ansible modules

## 📖 Topics Covered

### 1. Installation & Setup
- Installing Ansible on the control node
- Configuring SSH key-based authentication
- Setting up ansible.cfg
- Verifying the installation

### 2. Inventory Management
- Static inventory files (INI and YAML formats)
- Host groups and patterns
- Inventory variables
- Testing connectivity with ping module

### 3. Ad-Hoc Commands
- Running commands without playbooks
- Common use cases for ad-hoc commands
- Module syntax and parameters
- Gathering facts

### 4. First Playbook
- Playbook structure and YAML syntax
- Tasks, plays, and modules
- Running playbooks
- Understanding output and verbosity

### 5. Common Modules
- Package management: `apt`, `yum`, `dnf`
- File operations: `copy`, `file`, `template`
- Service management: `service`, `systemd`
- Command execution: `command`, `shell`, `script`

## 🔧 Prerequisites

- Linux control node with Ansible installed
- One or more target Linux systems
- SSH access to target systems
- Basic Linux command line knowledge

## 📝 Exercises

### Exercise 1: Install Ansible
1. Install Ansible on your control node
2. Verify installation with `ansible --version`
3. Create a basic ansible.cfg file

### Exercise 2: Create Inventory
1. Create an inventory file with multiple hosts
2. Organize hosts into groups (webservers, databases)
3. Test connectivity using `ansible all -m ping`

### Exercise 3: Ad-Hoc Commands
1. Check disk space on all hosts
2. Install a package on webservers group
3. Restart a service on specific hosts

### Exercise 4: First Playbook
1. Write a playbook to install and start nginx
2. Run the playbook with different verbosity levels
3. Verify the service is running on target hosts

### Exercise 5: Multi-Task Playbook
1. Create a playbook that:
   - Updates package cache
   - Installs multiple packages
   - Creates a directory
   - Copies a configuration file
   - Restarts a service

## ✅ Checklist

- [ ] Ansible installed and configured
- [ ] SSH key-based authentication working
- [ ] Inventory file created with multiple hosts
- [ ] Successfully pinged all hosts
- [ ] Executed ad-hoc commands
- [ ] Created and ran first playbook
- [ ] Understand basic module usage
- [ ] Can read and interpret playbook output

## 🧪 Quiz

1. What is the difference between the control node and managed nodes?
2. What are the two main formats for inventory files?
3. When would you use an ad-hoc command vs a playbook?
4. What does idempotency mean in Ansible?
5. What is the difference between the `command` and `shell` modules?

## 📚 Key Takeaways

- Ansible is agentless and uses SSH for communication
- Inventory files define your infrastructure
- Ad-hoc commands are great for quick tasks
- Playbooks provide repeatable, version-controlled automation
- Modules are the building blocks of Ansible automation
- Always test with `--check` mode first

## ➡️ Next Steps

Once you've completed this lesson, move on to [Lesson 2: Playbooks & Variables](../02-playbooks-variables/README.md) to learn about advanced playbook features.
