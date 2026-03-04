# Lesson 03: Multi-Environment Management

## 🎯 Learning Goals

- Manage multiple environments (dev, staging, prod) efficiently
- Use parent terragrunt.hcl for DRY configuration
- Configure environment-specific settings
- Manage remote state per environment
- Understand the power of Terragrunt's inheritance

## 📖 The Problem

Without Terragrunt, managing multiple environments means:
- Duplicating backend configuration in every module
- Copying provider configuration everywhere
- Repeating common variables
- Risk of inconsistency between environments

## 🏗️ Project Structure

```
03-multi-env/
├── README.md
├── terragrunt.hcl           # Root config (backend, provider)
├── dev/
│   ├── env.hcl              # Dev-specific variables
│   └── vpc/
│       └── terragrunt.hcl   # Dev VPC config
├── staging/
│   ├── env.hcl              # Staging-specific variables
│   └── vpc/
│       └── terragrunt.hcl   # Staging VPC config
└── prod/
    ├── env.hcl              # Prod-specific variables
    └── vpc/
        └── terragrunt.hcl   # Prod VPC config
```

## 🔍 Key Concepts

### Root terragrunt.hcl

The root `terragrunt.hcl` contains configuration shared across ALL environments:
- Remote state backend configuration
- Provider configuration
- Common variables

Child configurations automatically inherit from parent!

### Environment Files (env.hcl)

Each environment has an `env.hcl` file with environment-specific settings:
```hcl
locals {
  environment = "dev"
  aws_region  = "us-east-1"
  vpc_cidr    = "10.0.0.0/16"
}
```

### Module Configuration

Each module's `terragrunt.hcl`:
1. Includes the root configuration
2. Reads environment variables
3. Adds module-specific settings

## 📝 Exercise 1: Deploy Dev Environment

### Step 1: Review Root Configuration

Look at the root `terragrunt.hcl`:
- `remote_state` block - S3 backend configuration
- `generate` block - Creates provider.tf automatically

### Step 2: Review Environment Config

Look at `dev/env.hcl` - environment-specific variables.

### Step 3: Deploy Dev VPC

```bash
cd dev/vpc

# Initialize
terragrunt init

# Plan
terragrunt plan

# Apply
terragrunt apply
```

Notice:
- Backend is automatically configured
- Provider is automatically generated
- Environment variables are loaded

## 📝 Exercise 2: Deploy Multiple Environments

### Deploy Staging

```bash
cd ../../staging/vpc

terragrunt init
terragrunt plan
terragrunt apply
```

### Deploy Production

```bash
cd ../../prod/vpc

terragrunt init
terragrunt plan
terragrunt apply
```

Each environment:
- Has its own state file in S3
- Uses environment-specific variables
- Shares the same module code

## 🔍 Understanding Inheritance

```
Root terragrunt.hcl
    ↓ (inherited by)
Environment env.hcl
    ↓ (read by)
Module terragrunt.hcl
```

### include Block

```hcl
include "root" {
  path = find_in_parent_folders()
}
```

This finds and includes the parent `terragrunt.hcl`.

### locals Block

```hcl
locals {
  env_vars = read_terragrunt_config(find_in_parent_folders("env.hcl"))
  environment = local.env_vars.locals.environment
}
```

This reads environment-specific variables.

## 💡 Benefits

1. **DRY**: Backend and provider configured once
2. **Consistency**: All environments use same module
3. **Flexibility**: Easy to customize per environment
4. **Scalability**: Add new environments easily
5. **State Isolation**: Each environment has separate state

## 🔐 Remote State

The root config sets up S3 backend:
```hcl
remote_state {
  backend = "s3"
  config = {
    bucket = "my-terraform-state"
    key    = "${path_relative_to_include()}/terraform.tfstate"
    region = "us-east-1"
  }
}
```

Each module gets its own state file:
- `dev/vpc/terraform.tfstate`
- `staging/vpc/terraform.tfstate`
- `prod/vpc/terraform.tfstate`

## 🧹 Clean Up

```bash
# Destroy each environment
cd dev/vpc
terragrunt destroy

cd ../../staging/vpc
terragrunt destroy

cd ../../prod/vpc
terragrunt destroy
```

## ✅ Checklist

- [ ] Understand the root terragrunt.hcl purpose
- [ ] Understand environment-specific configuration
- [ ] Deploy dev environment
- [ ] Deploy staging environment
- [ ] Deploy prod environment
- [ ] Verify separate state files
- [ ] Understand inheritance with `include`
- [ ] Clean up all environments

## 🎓 Quiz

1. What goes in the root terragrunt.hcl?
2. What goes in env.hcl files?
3. How does a child inherit from parent config?
4. Where are state files stored for each environment?
5. What's the benefit of the `generate` block?

## 🚀 Real-World Usage

In production, you might have:
```
infrastructure/
├── terragrunt.hcl
├── dev/
│   ├── env.hcl
│   ├── vpc/
│   ├── rds/
│   ├── eks/
│   └── s3/
├── staging/
│   ├── env.hcl
│   ├── vpc/
│   ├── rds/
│   └── eks/
└── prod/
    ├── env.hcl
    ├── vpc/
    ├── rds/
    └── eks/
```

Deploy entire environment:
```bash
cd dev
terragrunt run-all apply
```

## ➡️ Next Steps

Move on to `04-advanced` to learn about hooks, dependencies, and other advanced Terragrunt features!
