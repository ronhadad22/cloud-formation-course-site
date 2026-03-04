# Ansible Project Directory Structure

## Recommended Layout

```
ansible-project/
├── ansible.cfg                 # Ansible configuration
├── inventory/                  # Inventory files
│   ├── production/
│   │   ├── hosts.yml          # Production inventory
│   │   ├── group_vars/
│   │   │   ├── all.yml
│   │   │   ├── webservers.yml
│   │   │   └── databases.yml
│   │   └── host_vars/
│   │       └── web1.example.com.yml
│   ├── staging/
│   │   ├── hosts.yml
│   │   └── group_vars/
│   │       └── all.yml
│   └── development/
│       ├── hosts.yml
│       └── group_vars/
│           └── all.yml
├── group_vars/                 # Global group variables
│   ├── all.yml
│   └── vault.yml              # Encrypted variables
├── host_vars/                  # Global host variables
│   └── special-host.yml
├── roles/                      # Custom roles
│   ├── common/
│   │   ├── tasks/
│   │   │   └── main.yml
│   │   ├── handlers/
│   │   │   └── main.yml
│   │   ├── templates/
│   │   ├── files/
│   │   ├── vars/
│   │   │   └── main.yml
│   │   ├── defaults/
│   │   │   └── main.yml
│   │   ├── meta/
│   │   │   └── main.yml
│   │   └── README.md
│   ├── webserver/
│   └── database/
├── playbooks/                  # Playbooks
│   ├── site.yml               # Master playbook
│   ├── webservers.yml
│   ├── databases.yml
│   └── common.yml
├── library/                    # Custom modules
│   └── custom_module.py
├── module_utils/              # Shared module code
├── filter_plugins/            # Custom filters
├── callback_plugins/          # Custom callbacks
├── vars/                      # Additional variables
│   ├── common.yml
│   └── secrets.yml
├── files/                     # Static files
│   └── config.conf
├── templates/                 # Jinja2 templates
│   └── app.conf.j2
├── scripts/                   # Helper scripts
│   └── deploy.sh
├── tests/                     # Test playbooks
│   └── test.yml
├── requirements.yml           # Galaxy role requirements
├── .gitignore
├── .ansible-lint
└── README.md
```

## Key Principles

### 1. Separation of Concerns
- Keep inventory separate from playbooks
- Separate variables by environment
- Isolate sensitive data in vault files

### 2. Environment Isolation
```
inventory/
├── production/
├── staging/
└── development/
```

### 3. Variable Precedence
Understanding where to put variables:
- `group_vars/all.yml` - Variables for all hosts
- `group_vars/webservers.yml` - Variables for webserver group
- `host_vars/web1.yml` - Variables for specific host
- `inventory/production/group_vars/` - Environment-specific

### 4. Role Organization
```
roles/
└── webserver/
    ├── tasks/          # Main tasks
    ├── handlers/       # Service handlers
    ├── templates/      # Jinja2 templates
    ├── files/          # Static files
    ├── vars/           # Role variables (high precedence)
    ├── defaults/       # Default variables (low precedence)
    ├── meta/           # Role metadata and dependencies
    ├── library/        # Custom modules for this role
    └── README.md       # Documentation
```

## Example Files

### ansible.cfg
```ini
[defaults]
inventory = ./inventory/production/hosts.yml
roles_path = ./roles
host_key_checking = False
retry_files_enabled = False
gathering = smart
fact_caching = jsonfile
fact_caching_connection = /tmp/ansible_facts
fact_caching_timeout = 3600

[privilege_escalation]
become = True
become_method = sudo

[ssh_connection]
pipelining = True
```

### inventory/production/hosts.yml
```yaml
all:
  children:
    webservers:
      hosts:
        web1.example.com:
        web2.example.com:
    databases:
      hosts:
        db1.example.com:
```

### group_vars/all.yml
```yaml
---
ntp_server: pool.ntp.org
timezone: UTC
admin_email: admin@example.com
```

### playbooks/site.yml
```yaml
---
- import_playbook: common.yml
- import_playbook: webservers.yml
- import_playbook: databases.yml
```

## Best Practices

1. **Use meaningful names** for files, roles, and variables
2. **Document everything** with README files and comments
3. **Version control** all code except secrets
4. **Encrypt sensitive data** with Ansible Vault
5. **Test in development** before production
6. **Keep playbooks idempotent**
7. **Use roles** for reusability
8. **Separate environments** completely
9. **Follow naming conventions** consistently
10. **Keep it simple** - don't over-engineer
