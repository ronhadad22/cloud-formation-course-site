# Lesson 3: Templates & Roles

## 📚 Overview

This lesson covers Jinja2 templating for dynamic configuration files and Ansible roles for organizing and reusing automation code.

## 🎯 Learning Objectives

- Master Jinja2 template syntax
- Create dynamic configuration files
- Understand role structure and organization
- Create reusable roles
- Use Ansible Galaxy for community roles
- Manage role dependencies

## 📖 Topics Covered

### 1. Jinja2 Templates
- Template syntax and variables
- Filters and tests
- Control structures (if, for, etc.)
- Template inheritance
- Whitespace control
- Common use cases

### 2. Role Basics
- What are roles and why use them
- Role directory structure
- Creating your first role
- Using roles in playbooks
- Role variables and defaults

### 3. Role Organization
- Best practices for role structure
- Role metadata
- Role documentation
- Testing roles
- Versioning roles

### 4. Ansible Galaxy
- Finding roles on Galaxy
- Installing roles
- Role requirements file
- Publishing roles
- Galaxy alternatives

### 5. Role Dependencies
- Defining dependencies
- Dependency resolution
- Conditional dependencies
- Managing complex dependencies

## 🔧 Prerequisites

- Completed Lessons 1 and 2
- Understanding of variables and facts
- Familiarity with YAML and file operations

## 📝 Exercises

### Exercise 1: Jinja2 Templates
1. Create a template for nginx configuration
2. Use variables and conditionals in templates
3. Implement loops in templates

### Exercise 2: First Role
1. Create a role using ansible-galaxy init
2. Organize tasks, handlers, and variables
3. Use the role in a playbook

### Exercise 3: Complex Role
1. Create a role with dependencies
2. Implement role defaults and variables
3. Add templates and files to the role

### Exercise 4: Ansible Galaxy
1. Search for roles on Galaxy
2. Install a community role
3. Use the role in your playbook

## ✅ Checklist

- [ ] Understand Jinja2 template syntax
- [ ] Can create dynamic configuration files
- [ ] Know role directory structure
- [ ] Created custom roles
- [ ] Used Ansible Galaxy roles
- [ ] Understand role dependencies
- [ ] Can organize complex automation with roles

## 🧪 Quiz

1. What is the difference between {{ }} and {% %} in Jinja2?
2. What are the main directories in an Ansible role?
3. How do you specify role dependencies?
4. What is the purpose of defaults/main.yml vs vars/main.yml?
5. How do you install a role from Ansible Galaxy?

## 📚 Key Takeaways

- Templates enable dynamic configuration management
- Jinja2 is powerful but keep templates simple
- Roles promote code reuse and organization
- Galaxy provides thousands of community roles
- Role structure is standardized for consistency
- Dependencies allow composing complex automation

## ➡️ Next Steps

Continue to [Lesson 4: Advanced Topics](../04-advanced-topics/README.md) for Vault, dynamic inventory, and more.
