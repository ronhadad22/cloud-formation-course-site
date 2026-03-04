# Lesson 03: Advanced Deployments

## 🎯 Learning Goals

- Create reusable Terraform modules
- Use workspaces for environment management
- Configure remote state and state locking
- Import existing infrastructure into Terraform
- Implement multi-cloud deployments
- Use Terraform Cloud/Enterprise features
- Apply production deployment patterns

## 📖 Advanced Deployment Patterns

This lesson covers production-ready Terraform practices:
- **Modules**: Create reusable infrastructure components
- **Workspaces**: Manage multiple environments with one configuration
- **Remote State**: Collaborate with teams using shared state
- **Import**: Bring existing infrastructure under Terraform management
- **Multi-Cloud**: Deploy across AWS, Azure, GCP simultaneously

## 🏗️ Project Structure

```
03-advanced-deployments/
├── README.md
├── 01-modules/
│   ├── modules/
│   │   ├── vpc/
│   │   ├── compute/
│   │   └── database/
│   └── main.tf
├── 02-workspaces/
│   └── main.tf
├── 03-remote-state/
│   ├── backend.tf
│   └── main.tf
├── 04-import/
│   └── main.tf
└── 05-multi-cloud/
    └── main.tf
```

## 📝 Exercise 1: Creating Modules

Modules are the key to reusable, maintainable Terraform code.

### Module Structure

```
modules/
└── vpc/
    ├── main.tf       # Resources
    ├── variables.tf  # Input variables
    ├── outputs.tf    # Output values
    └── README.md     # Documentation
```

### Module Best Practices

1. **Single Responsibility**: Each module should do one thing well
2. **Clear Interface**: Well-defined inputs and outputs
3. **Documentation**: README with usage examples
4. **Versioning**: Use git tags for module versions
5. **Testing**: Validate modules before use

### Example Module: VPC

**modules/vpc/variables.tf:**
```hcl
variable "vpc_name" {
  description = "Name of the VPC"
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "List of availability zones"
  type        = list(string)
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
```

**modules/vpc/outputs.tf:**
```hcl
output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "IDs of public subnets"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "IDs of private subnets"
  value       = aws_subnet.private[*].id
}
```

### Using Modules

```hcl
module "vpc" {
  source = "./modules/vpc"
  
  vpc_name           = "production-vpc"
  vpc_cidr           = "10.0.0.0/16"
  availability_zones = ["us-east-1a", "us-east-1b"]
  
  tags = {
    Environment = "production"
  }
}

# Reference module outputs
resource "aws_instance" "web" {
  subnet_id = module.vpc.public_subnet_ids[0]
}
```

### Module Sources

```hcl
# Local path
module "vpc" {
  source = "./modules/vpc"
}

# Git repository
module "vpc" {
  source = "git::https://github.com/user/terraform-modules.git//vpc?ref=v1.0.0"
}

# Terraform Registry
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.0.0"
}

# S3 bucket
module "vpc" {
  source = "s3::https://s3.amazonaws.com/my-modules/vpc.zip"
}
```

### Try It

```bash
cd 01-modules
terraform init
terraform plan
terraform apply
```

## 📝 Exercise 2: Workspaces

Workspaces allow multiple state files with one configuration.

### Understanding Workspaces

- **Default workspace**: Created automatically
- **Named workspaces**: Create for different environments
- **Isolated state**: Each workspace has its own state file

### Workspace Commands

```bash
# List workspaces
terraform workspace list

# Create new workspace
terraform workspace new dev
terraform workspace new staging
terraform workspace new prod

# Switch workspace
terraform workspace select dev

# Show current workspace
terraform workspace show

# Delete workspace
terraform workspace delete dev
```

### Using Workspaces in Configuration

```hcl
locals {
  workspace_config = {
    dev = {
      instance_type = "t2.micro"
      instance_count = 1
    }
    staging = {
      instance_type = "t3.small"
      instance_count = 2
    }
    prod = {
      instance_type = "t3.large"
      instance_count = 3
    }
  }
  
  config = local.workspace_config[terraform.workspace]
}

resource "aws_instance" "web" {
  count         = local.config.instance_count
  instance_type = local.config.instance_type
  
  tags = {
    Name        = "web-${terraform.workspace}-${count.index}"
    Environment = terraform.workspace
  }
}
```

### Workspace Best Practices

**Pros:**
- Simple environment management
- One codebase for all environments
- Easy to switch between environments

**Cons:**
- Easy to accidentally deploy to wrong workspace
- All environments in same backend
- Limited isolation

**Recommendation**: Use workspaces for development, use separate state files for production.

### Try It

```bash
cd ../02-workspaces

# Create workspaces
terraform workspace new dev
terraform workspace new prod

# Deploy to dev
terraform workspace select dev
terraform apply

# Deploy to prod
terraform workspace select prod
terraform apply

# Compare
terraform workspace select dev
terraform state list
```

## 📝 Exercise 3: Remote State

Remote state enables team collaboration and state locking.

### Why Remote State?

1. **Collaboration**: Multiple team members can work together
2. **State Locking**: Prevents concurrent modifications
3. **Security**: State stored securely with encryption
4. **Backup**: Automatic state backups
5. **Automation**: CI/CD pipelines can access state

### S3 Backend Configuration

```hcl
terraform {
  backend "s3" {
    bucket         = "my-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-locks"
    
    # Optional: Use KMS for encryption
    kms_key_id = "arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012"
  }
}
```

### Setting Up S3 Backend

**1. Create S3 bucket:**
```bash
aws s3 mb s3://my-terraform-state
aws s3api put-bucket-versioning \
  --bucket my-terraform-state \
  --versioning-configuration Status=Enabled
```

**2. Create DynamoDB table for locking:**
```bash
aws dynamodb create-table \
  --table-name terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST
```

**3. Configure backend:**
```hcl
terraform {
  backend "s3" {
    bucket         = "my-terraform-state"
    key            = "terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-locks"
  }
}
```

**4. Initialize:**
```bash
terraform init
```

### Backend Types

- **S3**: AWS (most common)
- **Azure Storage**: Azure
- **GCS**: Google Cloud
- **Terraform Cloud**: HashiCorp managed
- **Consul**: HashiCorp Consul
- **etcd**: Kubernetes etcd

### Migrating to Remote State

```bash
# 1. Add backend configuration
# 2. Run init with migration
terraform init -migrate-state

# 3. Confirm migration
# 4. Delete local state file
rm terraform.tfstate*
```

### State Locking

```bash
# Terraform automatically locks state during operations
terraform apply  # Acquires lock

# If lock is stuck, force unlock (use carefully!)
terraform force-unlock <lock-id>
```

### Try It

```bash
cd ../03-remote-state

# Review backend configuration
cat backend.tf

# Initialize with remote backend
terraform init

# Apply and observe locking
terraform apply
```

## 📝 Exercise 4: Importing Existing Infrastructure

Import brings existing resources under Terraform management.

### Import Workflow

1. **Write configuration** for the resource
2. **Run import** command
3. **Verify** with plan
4. **Adjust** configuration if needed

### Import Example: S3 Bucket

**1. Write configuration:**
```hcl
resource "aws_s3_bucket" "existing" {
  bucket = "my-existing-bucket"
  
  tags = {
    ManagedBy = "Terraform"
  }
}
```

**2. Import the resource:**
```bash
terraform import aws_s3_bucket.existing my-existing-bucket
```

**3. Verify:**
```bash
terraform plan
# Should show no changes if configuration matches
```

### Import Multiple Resources

```bash
# Import VPC
terraform import aws_vpc.main vpc-12345678

# Import subnet
terraform import aws_subnet.public subnet-12345678

# Import security group
terraform import aws_security_group.web sg-12345678

# Import EC2 instance
terraform import aws_instance.web i-12345678
```

### Import with For_Each

```bash
# For resources created with for_each
terraform import 'aws_s3_bucket.buckets["frontend"]' frontend-bucket
terraform import 'aws_s3_bucket.buckets["backend"]' backend-bucket
```

### Import Best Practices

1. **Start small**: Import one resource at a time
2. **Use terraform show**: View imported resource attributes
3. **Match configuration**: Ensure config matches actual resource
4. **Test thoroughly**: Run plan to verify no changes
5. **Document**: Note which resources were imported

### Bulk Import Tools

- **Terraformer**: Generates Terraform files from existing infrastructure
- **Former2**: Browser-based AWS resource importer
- **Azure Terrafy**: Import Azure resources

### Try It

```bash
cd ../04-import

# Create a resource manually in AWS Console
# Then import it

terraform import aws_s3_bucket.imported <your-bucket-name>
terraform plan
```

## 📝 Exercise 5: Multi-Cloud Deployments

Deploy infrastructure across multiple cloud providers.

### Multi-Cloud Architecture

```hcl
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}

provider "azurerm" {
  features {}
}

provider "google" {
  project = "my-project"
  region  = "us-central1"
}

# AWS Resources
resource "aws_s3_bucket" "aws_storage" {
  bucket = "multi-cloud-aws"
}

# Azure Resources
resource "azurerm_storage_account" "azure_storage" {
  name                     = "multicloudazure"
  resource_group_name      = azurerm_resource_group.main.name
  location                 = "East US"
  account_tier             = "Standard"
  account_replication_type = "LRS"
}

# GCP Resources
resource "google_storage_bucket" "gcp_storage" {
  name     = "multi-cloud-gcp"
  location = "US"
}
```

### Multi-Region AWS Deployment

```hcl
provider "aws" {
  alias  = "us_east"
  region = "us-east-1"
}

provider "aws" {
  alias  = "us_west"
  region = "us-west-2"
}

provider "aws" {
  alias  = "eu_west"
  region = "eu-west-1"
}

resource "aws_s3_bucket" "us_east" {
  provider = aws.us_east
  bucket   = "my-bucket-us-east"
}

resource "aws_s3_bucket" "us_west" {
  provider = aws.us_west
  bucket   = "my-bucket-us-west"
}

resource "aws_s3_bucket" "eu_west" {
  provider = aws.eu_west
  bucket   = "my-bucket-eu-west"
}
```

### Try It

```bash
cd ../05-multi-cloud

# Configure all cloud providers
# Then deploy

terraform init
terraform plan
terraform apply
```

## 💡 Production Deployment Patterns

### Pattern 1: Layered Architecture

```
infrastructure/
├── 00-bootstrap/      # State bucket, IAM roles
├── 01-networking/     # VPC, subnets, routing
├── 02-security/       # Security groups, NACLs
├── 03-data/           # RDS, DynamoDB
├── 04-compute/        # EC2, ECS, Lambda
└── 05-monitoring/     # CloudWatch, alerts
```

### Pattern 2: Environment Separation

```
environments/
├── dev/
│   ├── backend.tf
│   └── main.tf
├── staging/
│   ├── backend.tf
│   └── main.tf
└── prod/
    ├── backend.tf
    └── main.tf
```

### Pattern 3: Module Registry

```hcl
module "vpc" {
  source  = "app.terraform.io/myorg/vpc/aws"
  version = "1.0.0"
}

module "eks" {
  source  = "app.terraform.io/myorg/eks/aws"
  version = "2.1.0"
}
```

## ✅ Checklist

- [ ] Create reusable Terraform modules
- [ ] Use workspaces for environment management
- [ ] Configure remote state with S3 and DynamoDB
- [ ] Import existing infrastructure
- [ ] Deploy to multiple cloud providers
- [ ] Implement production deployment patterns

## 🎓 Quiz

1. What's the difference between a module and a configuration?
2. When should you use workspaces vs separate state files?
3. Why is state locking important?
4. What's the process for importing existing infrastructure?
5. How do you use multiple providers in one configuration?

## ➡️ Next Steps

Move on to `04-best-practices` to learn about:
- Security and secrets management
- Testing strategies
- CI/CD integration
- Cost optimization
- Drift detection
