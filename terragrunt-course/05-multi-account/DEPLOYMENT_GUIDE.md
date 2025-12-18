# Multi-Account Deployment Guide

## Quick Start

### Prerequisites

1. **AWS Accounts**: You need at least 2 AWS accounts (dev and prod recommended)
2. **AWS CLI**: Configured with profiles for each account
3. **Terragrunt**: Version 0.45.0 or higher
4. **Terraform**: Version 1.0 or higher

### AWS Profile Setup

```bash
# Configure AWS profiles
aws configure --profile dev-account
# Enter: Access Key ID, Secret Access Key, Region (us-east-1)

aws configure --profile staging-account
aws configure --profile prod-account

# Test profiles
aws sts get-caller-identity --profile dev-account
aws sts get-caller-identity --profile staging-account
aws sts get-caller-identity --profile prod-account
```

### Update Account IDs

Edit the `account.hcl` files with your actual AWS account IDs:

**dev/account.hcl:**
```hcl
aws_account_id = "111111111111"  # Replace with your dev account ID
```

**staging/account.hcl:**
```hcl
aws_account_id = "222222222222"  # Replace with your staging account ID
```

**prod/account.hcl:**
```hcl
aws_account_id = "333333333333"  # Replace with your prod account ID
```

## Deployment Scenarios

### Scenario 1: Deploy to Development Account

```bash
# Set AWS profile
export AWS_PROFILE=dev-account

# Navigate to dev directory
cd dev/us-east-1

# Deploy VPC first
cd vpc
terragrunt init
terragrunt plan
terragrunt apply

# Deploy compute (depends on VPC)
cd ../compute
terragrunt init
terragrunt plan
terragrunt apply

# Verify deployment
terragrunt output
```

### Scenario 2: Deploy All Components in Dev

```bash
export AWS_PROFILE=dev-account
cd dev/us-east-1

# Deploy everything at once
terragrunt run-all apply
```

### Scenario 3: Deploy to Multiple Accounts

```bash
# Deploy to dev
export AWS_PROFILE=dev-account
cd dev/us-east-1
terragrunt run-all apply

# Deploy to staging
export AWS_PROFILE=staging-account
cd ../../staging/us-east-1
terragrunt run-all apply

# Deploy to production (with extra caution)
export AWS_PROFILE=prod-account
cd ../../prod/us-east-1
terragrunt run-all plan  # Review first!
terragrunt run-all apply
```

### Scenario 4: Deploy Specific Component Across All Accounts

```bash
# Deploy VPC in all accounts
export AWS_PROFILE=dev-account
cd dev/us-east-1/vpc
terragrunt apply

export AWS_PROFILE=staging-account
cd ../../../staging/us-east-1/vpc
terragrunt apply

export AWS_PROFILE=prod-account
cd ../../../prod/us-east-1/vpc
terragrunt apply
```

## State Management

### State File Locations

Each component in each account has its own state file:

```
S3 Bucket: terraform-state-{account-id}-{region}
Key Structure: {account}/{region}/{component}/terraform.tfstate

Examples:
- s3://terraform-state-111111111111-us-east-1/dev/us-east-1/vpc/terraform.tfstate
- s3://terraform-state-111111111111-us-east-1/dev/us-east-1/compute/terraform.tfstate
- s3://terraform-state-222222222222-us-east-1/staging/us-east-1/vpc/terraform.tfstate
```

### Create State Buckets Manually (Optional)

Terragrunt can auto-create buckets, but you can create them manually:

```bash
# For each account
export AWS_PROFILE=dev-account
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION="us-east-1"

aws s3 mb s3://terraform-state-${ACCOUNT_ID}-${REGION} --region ${REGION}
aws s3api put-bucket-versioning \
  --bucket terraform-state-${ACCOUNT_ID}-${REGION} \
  --versioning-configuration Status=Enabled

aws dynamodb create-table \
  --table-name terraform-locks-${ACCOUNT_ID} \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region ${REGION}
```

## Configuration Hierarchy

### How Configuration is Merged

```
1. Root terragrunt.hcl (common settings)
   ↓
2. account.hcl (account-specific: dev/staging/prod)
   ↓
3. region.hcl (region-specific: us-east-1/us-west-2)
   ↓
4. Component terragrunt.hcl (component-specific: vpc/compute)
```

### Example: How VPC CIDR is Determined

```hcl
# dev/account.hcl
vpc_cidr = "10.0.0.0/16"

# staging/account.hcl
vpc_cidr = "10.1.0.0/16"

# prod/account.hcl
vpc_cidr = "10.2.0.0/16"
```

Each account gets a different CIDR block automatically!

## Common Commands

### Initialization
```bash
terragrunt init          # Initialize single component
terragrunt run-all init  # Initialize all components
```

### Planning
```bash
terragrunt plan                    # Plan single component
terragrunt run-all plan            # Plan all components
terragrunt plan -out=tfplan        # Save plan
```

### Applying
```bash
terragrunt apply                          # Apply with prompt
terragrunt apply --terragrunt-non-interactive  # Auto-approve
terragrunt run-all apply                  # Apply all components
```

### Destroying
```bash
terragrunt destroy              # Destroy single component
terragrunt run-all destroy      # Destroy all components (careful!)
```

### Outputs
```bash
terragrunt output               # Show outputs
terragrunt output vpc_id        # Show specific output
```

### Dependencies
```bash
terragrunt graph-dependencies   # Show dependency graph
```

## Troubleshooting

### Issue: Wrong AWS Account

```bash
# Check which account you're using
aws sts get-caller-identity

# Set correct profile
export AWS_PROFILE=dev-account
```

### Issue: State Lock

```bash
# If state is locked
terragrunt force-unlock <LOCK_ID>

# Or wait for lock to expire (usually 20 minutes)
```

### Issue: Dependency Not Found

```bash
# Deploy dependencies first
cd ../vpc
terragrunt apply

# Then deploy dependent resource
cd ../compute
terragrunt apply
```

### Issue: Module Not Found

```bash
# Ensure you're running from correct directory
pwd
# Should be: .../05-multi-account/dev/us-east-1/vpc

# Check module path in terragrunt.hcl
grep "source" terragrunt.hcl
```

### Issue: Permission Denied

```bash
# Check IAM permissions
aws iam get-user --profile dev-account

# Ensure you have permissions for:
# - EC2 (VPC, Subnets, Instances)
# - S3 (State bucket)
# - DynamoDB (Lock table)
```

## Best Practices

### 1. Always Plan Before Apply
```bash
terragrunt plan
# Review output carefully
terragrunt apply
```

### 2. Use run-all Carefully
```bash
# In dev: OK to use run-all
cd dev/us-east-1
terragrunt run-all apply

# In prod: Apply components individually
cd prod/us-east-1/vpc
terragrunt apply
cd ../compute
terragrunt apply
```

### 3. Tag Everything
All resources are automatically tagged with:
- Account
- Region
- Component
- ManagedBy
- Environment

### 4. State Isolation
- Each account has its own state bucket
- Each component has its own state file
- Never share state across accounts

### 5. Use Mock Outputs for Planning
Mock outputs allow you to plan without dependencies:
```hcl
dependency "vpc" {
  config_path = "../vpc"
  
  mock_outputs = {
    vpc_id = "vpc-mock-12345"
  }
}
```

## Cleanup

### Remove All Resources

```bash
# Dev account
export AWS_PROFILE=dev-account
cd dev/us-east-1
terragrunt run-all destroy

# Staging account
export AWS_PROFILE=staging-account
cd ../../staging/us-east-1
terragrunt run-all destroy

# Production account
export AWS_PROFILE=prod-account
cd ../../prod/us-east-1
terragrunt run-all destroy
```

### Remove State Buckets (Optional)

```bash
# For each account
export AWS_PROFILE=dev-account
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION="us-east-1"

# Empty and delete bucket
aws s3 rm s3://terraform-state-${ACCOUNT_ID}-${REGION} --recursive
aws s3 rb s3://terraform-state-${ACCOUNT_ID}-${REGION}

# Delete DynamoDB table
aws dynamodb delete-table --table-name terraform-locks-${ACCOUNT_ID}
```

## Next Steps

1. **Add More Regions**: Copy `us-east-1` to `us-west-2`
2. **Add More Components**: Create database, monitoring, etc.
3. **Implement CI/CD**: Automate deployments
4. **Add Tests**: Validate infrastructure before deployment
5. **Document Runbooks**: Create operational procedures
