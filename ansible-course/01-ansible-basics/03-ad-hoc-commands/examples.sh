#!/bin/bash
# Ansible Ad-Hoc Commands Examples
# These commands demonstrate quick tasks without writing playbooks

# ============================================
# CONNECTIVITY & INFORMATION
# ============================================

# Ping all hosts to test connectivity
ansible all -m ping

# Ping specific group
ansible webservers -m ping

# Ping specific host
ansible web1.example.com -m ping

# Gather facts from all hosts
ansible all -m setup

# Gather specific facts (filter)
ansible all -m setup -a "filter=ansible_distribution*"

# Check uptime on all hosts
ansible all -m command -a "uptime"

# ============================================
# PACKAGE MANAGEMENT
# ============================================

# Update apt cache (Debian/Ubuntu)
ansible webservers -m apt -a "update_cache=yes" --become

# Install nginx on web servers
ansible webservers -m apt -a "name=nginx state=present" --become

# Install multiple packages
ansible webservers -m apt -a "name=nginx,git,curl state=present" --become

# Remove a package
ansible webservers -m apt -a "name=apache2 state=absent" --become

# Install package on RHEL/CentOS
ansible databases -m yum -a "name=postgresql state=present" --become

# Update all packages (Debian/Ubuntu)
ansible all -m apt -a "upgrade=dist" --become

# ============================================
# SERVICE MANAGEMENT
# ============================================

# Start nginx service
ansible webservers -m service -a "name=nginx state=started" --become

# Stop a service
ansible webservers -m service -a "name=nginx state=stopped" --become

# Restart a service
ansible webservers -m service -a "name=nginx state=restarted" --become

# Enable service on boot
ansible webservers -m service -a "name=nginx enabled=yes" --become

# Check service status
ansible webservers -m service -a "name=nginx" --become

# ============================================
# FILE OPERATIONS
# ============================================

# Create a directory
ansible all -m file -a "path=/opt/myapp state=directory mode=0755" --become

# Create a file
ansible all -m file -a "path=/tmp/testfile state=touch mode=0644" --become

# Remove a file
ansible all -m file -a "path=/tmp/testfile state=absent" --become

# Copy file to remote hosts
ansible webservers -m copy -a "src=/local/file.txt dest=/remote/file.txt mode=0644" --become

# Change file permissions
ansible all -m file -a "path=/opt/myapp mode=0755 owner=www-data group=www-data" --become

# Create symbolic link
ansible all -m file -a "src=/opt/myapp/current dest=/opt/myapp/latest state=link" --become

# ============================================
# USER MANAGEMENT
# ============================================

# Create a user
ansible all -m user -a "name=deploy state=present shell=/bin/bash" --become

# Add user to sudo group
ansible all -m user -a "name=deploy groups=sudo append=yes" --become

# Remove a user
ansible all -m user -a "name=olduser state=absent remove=yes" --become

# Set user password (hashed)
ansible all -m user -a "name=deploy password={{ 'mypassword' | password_hash('sha512') }}" --become

# ============================================
# COMMAND EXECUTION
# ============================================

# Run a simple command
ansible all -m command -a "df -h"

# Run command with shell (allows pipes and redirects)
ansible all -m shell -a "ps aux | grep nginx"

# Run a script from control node
ansible all -m script -a "/local/path/script.sh"

# Execute command with specific working directory
ansible all -m command -a "ls -la" -a "chdir=/var/log"

# ============================================
# SYSTEM INFORMATION
# ============================================

# Check disk usage
ansible all -m shell -a "df -h"

# Check memory usage
ansible all -m shell -a "free -m"

# Get OS information
ansible all -m setup -a "filter=ansible_distribution*"

# Check running processes
ansible all -m shell -a "ps aux | head -20"

# Get network interfaces
ansible all -m setup -a "filter=ansible_interfaces"

# ============================================
# GIT OPERATIONS
# ============================================

# Clone a git repository
ansible webservers -m git -a "repo=https://github.com/example/repo.git dest=/opt/myapp version=main"

# Update git repository
ansible webservers -m git -a "repo=https://github.com/example/repo.git dest=/opt/myapp update=yes"

# ============================================
# ADVANCED OPTIONS
# ============================================

# Run with different user
ansible all -m command -a "whoami" --become-user=deploy

# Limit to specific hosts
ansible webservers -m ping --limit "web1.example.com,web2.example.com"

# Run in check mode (dry-run)
ansible webservers -m apt -a "name=nginx state=present" --check --become

# Increase verbosity
ansible all -m ping -v
ansible all -m ping -vv
ansible all -m ping -vvv

# Run with different inventory
ansible all -m ping -i /path/to/inventory.ini

# Parallel execution (forks)
ansible all -m ping --forks=10

# ============================================
# USEFUL PATTERNS
# ============================================

# Target hosts by pattern
ansible "web*" -m ping                    # All hosts starting with 'web'
ansible "*.example.com" -m ping           # All hosts in example.com domain
ansible "webservers:&production" -m ping  # Intersection of groups
ansible "webservers:!web1*" -m ping       # Exclude pattern

# One-liner to install and start nginx
ansible webservers -m apt -a "name=nginx state=present" --become && \
ansible webservers -m service -a "name=nginx state=started enabled=yes" --become
