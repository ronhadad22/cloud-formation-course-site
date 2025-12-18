# Lesson 05: Multi-Account Deployment with Shared Modules

## 🎯 Learning Goals

- Understand multi-account AWS architecture patterns
- Use `account.hcl` for account-level configuration
- Deploy shared modules across multiple AWS accounts
- Manage environment-specific configurations with DRY principles
- Implement proper state isolation per account/environment

## 📖 What is Multi-Account Deployment?

In production environments, it's a best practice to separate workloads across multiple AWS accounts:

- **Development Account** - For development and testing
- **Staging Account** - Pre-production environment
- **Production Account** - Live production workloads
- **Shared Services Account** - Common infrastructure (logging, monitoring)

## 🏗️ Directory Structure

```
05-multi-account/
├── terragrunt.hcl              # Root configuration
├── _modules/                    # Shared Terraform modules
│   ├── vpc/
│   ├── compute/
│   └── database/
├── dev/                         # Development account
│   ├── account.hcl             # Dev account configuration
│   ├── us-east-1/              # Region-specific
│   │   ├── region.hcl
│   │   ├── vpc/
│   │   │   └── terragrunt.hcl
│   │   └── compute/
│   │       └── terragrunt.hcl
│   └── us-west-2/
│       └── region.hcl
├── staging/                     # Staging account
│   ├── account.hcl
│   └── us-east-1/
│       ├── region.hcl
│       ├── vpc/
│       └── compute/
└── prod/                        # Production account
    ├── account.hcl
    └── us-east-1/
        ├── region.hcl
        ├── vpc/
        └── compute/
```

## 🔑 Key Concepts

### 1. account.hcl
Contains account-specific configuration:
- AWS Account ID
- Account name
- Default tags
- IAM role for deployment

### 2. region.hcl
Contains region-specific configuration:
- AWS region
- Availability zones
- Region-specific settings

### 3. Root terragrunt.hcl
Contains shared configuration:
- Remote state backend
- Provider generation
- Common functions

### 4. Shared Modules (_modules/)
Reusable Terraform modules used across all accounts and environments.

## 📝 Exercise 1: Deploy to Development Account

### Step 1: Configure AWS Credentials

```bash
# Set up AWS profiles for each account
aws configure --profile dev-account
aws configure --profile staging-account
aws configure --profile prod-account

# Or use AWS SSO
aws sso login --profile dev-account
```

### Step 2: Review Configuration Files

Look at the hierarchy:
1. `terragrunt.hcl` (root) - Shared config
2. `dev/account.hcl` - Dev account config
3. `dev/us-east-1/region.hcl` - Region config
4. `dev/us-east-1/vpc/terragrunt.hcl` - Component config

### Step 3: Deploy VPC in Dev

```bash
cd dev/us-east-1/vpc

# Initialize
terragrunt init

# Plan
terragrunt plan

# Apply
terragrunt apply
```

### Step 4: Deploy Compute in Dev

```bash
cd ../compute

# This will automatically use VPC outputs via dependency
terragrunt init
terragrunt plan
terragrunt apply
```

## 📝 Exercise 2: Deploy to Multiple Accounts

### Deploy to Staging

```bash
cd staging/us-east-1/vpc
terragrunt apply --terragrunt-non-interactive

cd ../compute
terragrunt apply --terragrunt-non-interactive
```

### Deploy to Production

```bash
cd prod/us-east-1/vpc
terragrunt apply --terragrunt-non-interactive

cd ../compute
terragrunt apply --terragrunt-non-interactive
```

## 🚀 Advanced: Deploy All Environments

### Deploy Everything in Dev Account

```bash
cd dev
terragrunt run-all apply
```

### Deploy Specific Component Across All Accounts

```bash
# Deploy VPC in all accounts
terragrunt run-all apply --terragrunt-include-dir "**/vpc"
```

## 🔍 Key Features

### 1. State Isolation

Each account/region/component has its own state file:
```
s3://terraform-state-bucket/
├── dev/us-east-1/vpc/terraform.tfstate
├── dev/us-east-1/compute/terraform.tfstate
├── staging/us-east-1/vpc/terraform.tfstate
└── prod/us-east-1/vpc/terraform.tfstate
```

### 2. Configuration Inheritance

```
terragrunt.hcl (root)
  ↓ includes
account.hcl (dev/staging/prod)
  ↓ includes
region.hcl (us-east-1/us-west-2)
  ↓ includes
component terragrunt.hcl (vpc/compute)
```

### 3. Variable Merging

Variables are merged from multiple levels:
- Root defaults
- Account-specific values
- Region-specific values
- Component-specific values

### 4. Cross-Account Dependencies

```hcl
# Reference resources from different accounts
dependency "shared_services" {
  config_path = "../../../shared-services/us-east-1/logging"
}
```

## 💡 Best Practices

### 1. Naming Conventions
```
{account}-{region}-{component}-{resource}
dev-us-east-1-vpc-main
prod-us-east-1-compute-web
```

### 2. Tagging Strategy
```hcl
tags = {
  Account     = "dev"
  Environment = "development"
  Region      = "us-east-1"
  ManagedBy   = "Terragrunt"
  CostCenter  = "engineering"
}
```

### 3. State Backend per Account
Use different S3 buckets for each account to prevent cross-account access issues.

### 4. IAM Roles
Use assume role for cross-account deployments:
```hcl
iam_role = "arn:aws:iam::123456789012:role/TerraformDeployRole"
```

## ✅ Checklist

- [ ] Understand multi-account architecture
- [ ] Configure account.hcl files
- [ ] Deploy shared modules to dev account
- [ ] Deploy to staging account
- [ ] Deploy to production account
- [ ] Use run-all for bulk operations
- [ ] Verify state isolation
- [ ] Understand configuration inheritance

## 🎓 Quiz

1. What is the purpose of account.hcl?
2. How does Terragrunt handle configuration inheritance?
3. Why is state isolation important in multi-account setups?
4. How do you deploy to all environments at once?
5. What's the benefit of using shared modules?

## 🔧 Troubleshooting

### Issue: AWS Credentials
```bash
# Check which profile is being used
aws sts get-caller-identity --profile dev-account

# Set profile in environment
export AWS_PROFILE=dev-account
```

### Issue: State Lock
```bash
# Force unlock if needed (use carefully!)
terragrunt force-unlock <LOCK_ID>
```

### Issue: Dependency Errors
```bash
# Deploy dependencies first
cd dev/us-east-1/vpc
terragrunt apply

# Then deploy dependent resources
cd ../compute
terragrunt apply
```

## 🎯 Real-World Scenarios

### Scenario 1: New Region Deployment
```bash
# Copy region configuration
cp -r dev/us-east-1 dev/eu-west-1

# Update region.hcl
# Deploy
cd dev/eu-west-1
terragrunt run-all apply
```

### Scenario 2: Disaster Recovery
```bash
# Deploy to DR region
cd prod/us-west-2
terragrunt run-all apply
```

### Scenario 3: Environment Promotion
```bash
# Test in dev
cd dev/us-east-1
terragrunt run-all apply

# Promote to staging
cd ../../staging/us-east-1
terragrunt run-all apply

# Promote to prod (with approval)
cd ../../prod/us-east-1
terragrunt run-all plan
# Review and approve
terragrunt run-all apply
```

## ➡️ Next Steps

This is the final lesson! You now have the skills to:
- Manage infrastructure across multiple AWS accounts
- Use Terragrunt for DRY infrastructure code
- Implement proper state management
- Deploy at scale with run-all commands

## 📚 Additional Resources

- [AWS Multi-Account Strategy](https://aws.amazon.com/organizations/getting-started/best-practices/)
- [Terragrunt Documentation](https://terragrunt.gruntwork.io/)
- [AWS Control Tower](https://aws.amazon.com/controltower/)
- [Infrastructure as Code Best Practices](https://www.terraform.io/docs/cloud/guides/recommended-practices/index.html)
