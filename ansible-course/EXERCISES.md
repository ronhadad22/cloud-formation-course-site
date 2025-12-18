# Ansible Course - Hands-On Exercises

## Overview

This document contains practical exercises for each lesson in the Ansible course. Complete these exercises to reinforce your learning.

## Lesson 1: Ansible Basics

### Exercise 1.1: Installation and Setup
**Objective**: Install Ansible and configure your environment

**Tasks**:
1. Install Ansible on your control node
2. Create an `ansible.cfg` file with basic settings
3. Set up SSH key-based authentication to target hosts
4. Verify installation with `ansible --version`

**Validation**:
```bash
ansible --version
ssh -i ~/.ssh/id_rsa user@target-host
```

### Exercise 1.2: Inventory Management
**Objective**: Create and manage inventory files

**Tasks**:
1. Create an INI format inventory with 3 hosts in 2 groups
2. Create a YAML format inventory with the same structure
3. Add group variables for each group
4. Test connectivity with `ansible all -m ping`

**Expected Output**: All hosts respond with "pong"

### Exercise 1.3: Ad-Hoc Commands
**Objective**: Execute quick tasks without playbooks

**Tasks**:
1. Check disk space on all hosts
2. Install vim on webservers group
3. Create a directory `/opt/myapp` on all hosts
4. Gather facts and filter for OS information

**Commands**:
```bash
ansible all -m shell -a "df -h"
ansible webservers -m apt -a "name=vim state=present" --become
ansible all -m file -a "path=/opt/myapp state=directory" --become
ansible all -m setup -a "filter=ansible_distribution*"
```

### Exercise 1.4: First Playbook
**Objective**: Write and execute your first playbook

**Tasks**:
1. Create a playbook that installs nginx
2. Ensure nginx is started and enabled
3. Deploy a custom index.html page
4. Run the playbook with different verbosity levels

**Playbook Structure**:
```yaml
---
- name: Setup Web Server
  hosts: webservers
  become: yes
  tasks:
    # Your tasks here
```

## Lesson 2: Playbooks & Variables

### Exercise 2.1: Variables
**Objective**: Use variables effectively in playbooks

**Tasks**:
1. Create a playbook with play-level variables
2. Create a separate variables file and include it
3. Override variables from command line
4. Use registered variables

**Challenge**: Create a playbook that uses variables for package names, service names, and configuration paths.

### Exercise 2.2: Facts
**Objective**: Work with Ansible facts

**Tasks**:
1. Gather all facts from a host
2. Use facts to make conditional decisions
3. Create a custom fact
4. Display specific facts using filters

**Example**:
```yaml
- name: Use facts
  debug:
    msg: "OS: {{ ansible_distribution }} {{ ansible_distribution_version }}"
```

### Exercise 2.3: Conditionals
**Objective**: Implement conditional logic

**Tasks**:
1. Install different packages based on OS family
2. Skip tasks based on environment variable
3. Use multiple conditions with 'and'/'or'
4. Implement custom failure conditions

**Challenge**: Create a playbook that configures systems differently for development vs production.

### Exercise 2.4: Loops
**Objective**: Use loops for repetitive tasks

**Tasks**:
1. Create multiple users using a loop
2. Install a list of packages
3. Loop over a dictionary to create configuration files
4. Use loop with conditional

**Example**:
```yaml
- name: Create users
  user:
    name: "{{ item.name }}"
    groups: "{{ item.groups }}"
  loop:
    - { name: 'alice', groups: 'sudo' }
    - { name: 'bob', groups: 'developers' }
```

### Exercise 2.5: Handlers
**Objective**: Use handlers for service management

**Tasks**:
1. Create a playbook that modifies nginx config
2. Add a handler to reload nginx
3. Ensure handler only runs when config changes
4. Implement multiple handlers with dependencies

## Lesson 3: Templates & Roles

### Exercise 3.1: Jinja2 Templates
**Objective**: Create dynamic configuration files

**Tasks**:
1. Create a Jinja2 template for nginx configuration
2. Use variables in the template
3. Implement conditionals in the template
4. Use loops to generate multiple server blocks

**Template Example**:
```jinja2
server {
    listen {{ http_port }};
    server_name {{ server_name }};
    {% if enable_ssl %}
    listen 443 ssl;
    {% endif %}
}
```

### Exercise 3.2: Create a Role
**Objective**: Build a reusable role

**Tasks**:
1. Use `ansible-galaxy init` to create a role structure
2. Implement tasks to install and configure a service
3. Add templates and handlers
4. Define default variables
5. Use the role in a playbook

**Commands**:
```bash
ansible-galaxy init roles/myapp
```

### Exercise 3.3: Role Dependencies
**Objective**: Manage role dependencies

**Tasks**:
1. Create a role that depends on another role
2. Define dependencies in meta/main.yml
3. Test dependency resolution
4. Use conditional dependencies

### Exercise 3.4: Ansible Galaxy
**Objective**: Use community roles

**Tasks**:
1. Search for a role on Ansible Galaxy
2. Install a role using `ansible-galaxy install`
3. Create a requirements.yml file
4. Use the Galaxy role in your playbook

**Commands**:
```bash
ansible-galaxy search nginx
ansible-galaxy install geerlingguy.nginx
```

## Lesson 4: Advanced Topics

### Exercise 4.1: Ansible Vault
**Objective**: Secure sensitive data

**Tasks**:
1. Create a file with sensitive data
2. Encrypt it with `ansible-vault encrypt`
3. Use encrypted variables in a playbook
4. Edit encrypted file with `ansible-vault edit`
5. Use multiple vault IDs

**Commands**:
```bash
ansible-vault encrypt secrets.yml
ansible-vault edit secrets.yml
ansible-playbook playbook.yml --ask-vault-pass
```

### Exercise 4.2: Dynamic Inventory
**Objective**: Use dynamic inventory for cloud

**Tasks**:
1. Set up AWS dynamic inventory plugin
2. Use cloud tags as inventory groups
3. Create a custom inventory script
4. Test inventory with `ansible-inventory --list`

### Exercise 4.3: Error Handling
**Objective**: Implement robust error handling

**Tasks**:
1. Use block/rescue/always for error handling
2. Implement retry logic
3. Use failed_when for custom failures
4. Set max_fail_percentage

**Example**:
```yaml
- block:
    - name: Risky task
      command: /bin/might-fail
  rescue:
    - name: Handle failure
      debug:
        msg: "Task failed, running recovery"
  always:
    - name: Cleanup
      file:
        path: /tmp/cleanup
        state: absent
```

### Exercise 4.4: Tags
**Objective**: Use tags for selective execution

**Tasks**:
1. Tag tasks by function (install, configure, deploy)
2. Tag tasks by environment (dev, prod)
3. Use special tags (always, never)
4. Run playbook with specific tags

**Commands**:
```bash
ansible-playbook site.yml --tags "install,configure"
ansible-playbook site.yml --skip-tags "development"
```

### Exercise 4.5: Async Tasks
**Objective**: Run tasks asynchronously

**Tasks**:
1. Run a long task asynchronously with polling
2. Implement fire-and-forget task
3. Check async task status
4. Run multiple async tasks and wait for all

## Lesson 5: Best Practices

### Exercise 5.1: Project Organization
**Objective**: Structure a production project

**Tasks**:
1. Create a proper directory structure
2. Organize inventory by environment
3. Use group_vars and host_vars
4. Implement proper separation of concerns

### Exercise 5.2: Testing
**Objective**: Implement testing strategy

**Tasks**:
1. Set up ansible-lint and fix violations
2. Create Molecule tests for a role
3. Implement syntax checking in CI
4. Create validation playbooks

**Commands**:
```bash
ansible-lint playbooks/
molecule init role myrole
molecule test
```

### Exercise 5.3: CI/CD Integration
**Objective**: Automate with CI/CD

**Tasks**:
1. Create a GitHub Actions workflow
2. Implement automated testing
3. Add deployment stages
4. Use secrets management

### Exercise 5.4: Performance Optimization
**Objective**: Optimize playbook performance

**Tasks**:
1. Enable fact caching
2. Use pipelining
3. Optimize with async tasks
4. Profile playbook execution

**Configuration**:
```ini
[defaults]
gathering = smart
fact_caching = jsonfile
fact_caching_connection = /tmp/ansible_facts

[ssh_connection]
pipelining = True
```

## Final Project: Complete Application Stack

### Objective
Deploy a complete multi-tier application with best practices

### Requirements
1. **Infrastructure**:
   - 2 web servers (nginx)
   - 1 application server (Python/Node.js)
   - 1 database server (PostgreSQL)
   - 1 load balancer

2. **Features**:
   - Multiple environments (dev, staging, prod)
   - Encrypted secrets with Vault
   - Proper role organization
   - Jinja2 templates for all configs
   - Handlers for service management
   - Error handling
   - Tags for selective deployment

3. **Testing**:
   - Ansible-lint compliance
   - Molecule tests for roles
   - Syntax validation
   - Integration tests

4. **CI/CD**:
   - Automated testing pipeline
   - Deployment workflow
   - Environment promotion

5. **Documentation**:
   - README with setup instructions
   - Role documentation
   - Inventory documentation
   - Deployment runbook

### Deliverables
- Complete Ansible project repository
- CI/CD pipeline configuration
- Documentation
- Demo deployment

## Quiz Answers

### Lesson 1
1. Control node runs Ansible; managed nodes are configured by Ansible
2. INI and YAML
3. Ad-hoc for quick one-off tasks; playbooks for repeatable automation
4. Running multiple times produces same result
5. `command` doesn't use shell; `shell` allows pipes and redirects

### Lesson 2
1. Command line > role vars > play vars > host vars > group vars > defaults
2. `{{ ansible_distribution }}` or `{{ ansible_facts['distribution'] }}`
3. `when` controls execution; `failed_when` defines failure conditions
4. At the end of the play, after all tasks
5. Use `dict2items` filter or loop over `item.key` and `item.value`

### Lesson 3
1. `{{ }}` for expressions; `{% %}` for statements
2. tasks/, handlers/, templates/, files/, vars/, defaults/, meta/
3. In meta/main.yml under dependencies
4. defaults/ has lowest precedence; vars/ has higher precedence
5. `ansible-galaxy install role_name`

### Lesson 4
1. `ansible-vault encrypt filename`
2. `block` for try, `rescue` for catch
3. For long-running tasks or when parallelism is needed
4. `ansible-playbook playbook.yml --tags tagname`
5. Module file, argument spec, return values, documentation

### Lesson 5
1. Separate inventory, roles, playbooks; use group_vars/host_vars
2. `molecule init role rolename` then `molecule test`
3. Vault for secrets, privilege escalation, SSH hardening, audit logs
4. Fact caching, pipelining, async tasks, reduce forks
5. Verbose mode, check mode, diff mode, debug module, ANSIBLE_DEBUG

## Additional Resources

- Practice on local VMs or containers
- Join Ansible community forums
- Contribute to Galaxy roles
- Read Ansible source code
- Build real-world projects
