# Lesson 4: Advanced Topics

## 📚 Overview

This lesson covers advanced Ansible features including Ansible Vault for secrets management, dynamic inventory, error handling, tags, async tasks, and custom modules.

## 🎯 Learning Objectives

- Secure sensitive data with Ansible Vault
- Use dynamic inventory for cloud environments
- Implement robust error handling
- Use tags for selective execution
- Run asynchronous and parallel tasks
- Write custom Ansible modules

## 📖 Topics Covered

### 1. Ansible Vault
- Encrypting files and variables
- Vault passwords and password files
- Encrypting specific variables
- Using vault in playbooks
- Best practices for secrets management

### 2. Dynamic Inventory
- Understanding dynamic inventory
- AWS EC2 dynamic inventory
- Azure dynamic inventory
- Custom inventory scripts
- Inventory plugins

### 3. Error Handling
- Block, rescue, and always
- Ignoring errors
- Failed_when and changed_when
- Any_errors_fatal
- Max_fail_percentage

### 4. Tags
- Defining tags
- Running specific tags
- Skipping tags
- Special tags (always, never)
- Tag inheritance

### 5. Async & Parallel
- Asynchronous task execution
- Polling and fire-and-forget
- Parallel execution with serial
- Throttle and forks
- Performance optimization

### 6. Custom Modules
- Module structure
- Writing Python modules
- Module arguments and return values
- Testing custom modules
- Distributing modules

## 🔧 Prerequisites

- Completed Lessons 1-3
- Understanding of Python (for custom modules)
- Cloud account for dynamic inventory (optional)

## 📝 Exercises

### Exercise 1: Ansible Vault
1. Encrypt a file with sensitive data
2. Use encrypted variables in playbook
3. Manage multiple vault passwords

### Exercise 2: Dynamic Inventory
1. Set up AWS dynamic inventory
2. Use inventory groups from cloud tags
3. Create custom inventory script

### Exercise 3: Error Handling
1. Implement block/rescue/always
2. Handle failures gracefully
3. Use conditional failure logic

### Exercise 4: Tags
1. Tag tasks for different environments
2. Run playbook with specific tags
3. Use tag inheritance

### Exercise 5: Async Tasks
1. Run long-running tasks asynchronously
2. Implement fire-and-forget tasks
3. Optimize parallel execution

## ✅ Checklist

- [ ] Can encrypt and decrypt with Vault
- [ ] Understand dynamic inventory
- [ ] Implement error handling strategies
- [ ] Use tags effectively
- [ ] Run async tasks
- [ ] Written a custom module

## 🧪 Quiz

1. How do you encrypt a file with Ansible Vault?
2. What's the difference between block and rescue?
3. When should you use async tasks?
4. How do you run only tasks with a specific tag?
5. What are the components of a custom module?

## 📚 Key Takeaways

- Vault protects sensitive data in version control
- Dynamic inventory adapts to cloud environments
- Error handling makes playbooks robust
- Tags enable selective execution
- Async tasks improve performance
- Custom modules extend Ansible functionality

## ➡️ Next Steps

Continue to [Lesson 5: Best Practices & Production](../05-best-practices/README.md) for production-ready patterns.
