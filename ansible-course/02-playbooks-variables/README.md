# Lesson 2: Playbooks & Variables

## 📚 Overview

This lesson dives deep into Ansible playbooks, variables, facts, conditionals, loops, and handlers. You'll learn how to write sophisticated automation with dynamic behavior.

## 🎯 Learning Objectives

- Understand playbook structure and anatomy
- Define and use variables effectively
- Work with Ansible facts
- Implement conditional logic
- Use loops for repetitive tasks
- Trigger actions with handlers

## 📖 Topics Covered

### 1. Playbook Structure
- YAML syntax and best practices
- Plays, tasks, and modules
- Play-level vs task-level directives
- Using multiple plays in one playbook

### 2. Variables
- Defining variables in playbooks
- Variable files (vars_files)
- Group and host variables
- Variable precedence
- Registering task output
- Special variables (hostvars, groups, inventory_hostname)

### 3. Facts
- Automatic fact gathering
- Custom facts
- Fact caching
- Using facts in playbooks and templates
- Disabling fact gathering for performance

### 4. Conditionals
- When statements
- Conditional operators (==, !=, <, >, in)
- Boolean logic (and, or, not)
- Testing variables (defined, undefined)
- Failed_when and changed_when

### 5. Loops
- Simple loops with loop
- Looping over lists and dictionaries
- Loop control (index, pause, label)
- Until loops
- Legacy loop syntax (with_items, with_dict)

### 6. Handlers
- Defining handlers
- Notifying handlers
- Handler execution order
- Listening to notifications
- Flushing handlers

## 🔧 Prerequisites

- Completed Lesson 1: Ansible Basics
- Understanding of YAML syntax
- Familiarity with basic playbooks

## 📝 Exercises

### Exercise 1: Variable Usage
1. Create a playbook with variables defined at multiple levels
2. Use variables in tasks
3. Override variables from command line

### Exercise 2: Working with Facts
1. Gather facts from hosts
2. Use facts to make decisions
3. Create custom facts

### Exercise 3: Conditionals
1. Install different packages based on OS family
2. Skip tasks based on conditions
3. Use complex conditional logic

### Exercise 4: Loops
1. Create multiple users with a loop
2. Install packages from a list
3. Loop over dictionaries

### Exercise 5: Handlers
1. Restart services only when configuration changes
2. Use multiple handlers
3. Implement handler dependencies

## ✅ Checklist

- [ ] Understand playbook YAML structure
- [ ] Can define variables in multiple ways
- [ ] Know variable precedence rules
- [ ] Can use Ansible facts effectively
- [ ] Implement conditional logic
- [ ] Use loops for repetitive tasks
- [ ] Properly use handlers for service restarts
- [ ] Register and use task output

## 🧪 Quiz

1. What is the order of variable precedence in Ansible?
2. How do you access a fact about the operating system?
3. What's the difference between `when` and `failed_when`?
4. When are handlers executed in a playbook?
5. How do you loop over a dictionary in Ansible?

## 📚 Key Takeaways

- Variables make playbooks flexible and reusable
- Facts provide runtime information about managed nodes
- Conditionals enable intelligent decision-making
- Loops reduce code duplication
- Handlers ensure services restart only when needed
- Variable precedence matters for predictable behavior

## ➡️ Next Steps

Continue to [Lesson 3: Templates & Roles](../03-templates-roles/README.md) to learn about Jinja2 templates and role-based organization.
