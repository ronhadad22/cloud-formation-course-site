# Lesson 01: Terraform Basics

## 🎯 Learning Goals

- Understand what Terraform is and how it works
- Learn HCL (HashiCorp Configuration Language) syntax
- Create your first Terraform configuration
- Understand providers, resources, variables, and outputs
- Master the Terraform workflow: init, plan, apply, destroy
- Understand state files and their importance

## 📖 What is Terraform?

Terraform is an infrastructure as code (IaC) tool that allows you to:
- **Define** infrastructure using declarative configuration files
- **Version control** your infrastructure alongside application code
- **Automate** provisioning across multiple cloud providers
- **Collaborate** with teams using shared state

## 🏗️ Project Structure

```
01-terraform-basics/
├── README.md
├── 01-first-resource/
│   └── main.tf              # Simple S3 bucket
├── 02-variables/
│   ├── main.tf
│   ├── variables.tf
│   └── terraform.tfvars
├── 03-outputs/
│   ├── main.tf
│   └── outputs.tf
└── 04-data-sources/
    └── main.tf
```

## 📝 Exercise 1: Your First Resource

### Understanding HCL Syntax

HCL (HashiCorp Configuration Language) is declarative and human-readable:

```hcl
# This is a comment

# Block type, label(s), and body
resource "aws_s3_bucket" "my_bucket" {
  bucket = "my-unique-bucket-name"
  
  tags = {
    Name        = "My Bucket"
    Environment = "Dev"
  }
}
```

### Deploy Your First Resource

```bash
cd 01-first-resource

# Initialize Terraform (downloads AWS provider)
terraform init

# Preview changes
terraform plan

# Create the resource
terraform apply

# View state
terraform show

# Destroy the resource
terraform destroy
```

### Understanding the Workflow

1. **terraform init**: Downloads provider plugins, initializes backend
2. **terraform plan**: Shows what will change (dry run)
3. **terraform apply**: Creates/updates infrastructure
4. **terraform destroy**: Removes all managed infrastructure

## 📝 Exercise 2: Variables

Variables make configurations reusable and flexible.

### Variable Types

```hcl
# String
variable "bucket_name" {
  type        = string
  description = "Name of the S3 bucket"
  default     = "my-bucket"
}

# Number
variable "instance_count" {
  type    = number
  default = 1
}

# Boolean
variable "enable_versioning" {
  type    = bool
  default = true
}

# List
variable "availability_zones" {
  type    = list(string)
  default = ["us-east-1a", "us-east-1b"]
}

# Map
variable "tags" {
  type = map(string)
  default = {
    Environment = "dev"
    Project     = "demo"
  }
}

# Object
variable "instance_config" {
  type = object({
    instance_type = string
    ami           = string
  })
}
```

### Using Variables

```hcl
resource "aws_s3_bucket" "example" {
  bucket = var.bucket_name
  
  tags = var.tags
}
```

### Providing Variable Values

**1. terraform.tfvars file:**
```hcl
bucket_name = "my-production-bucket"
tags = {
  Environment = "production"
}
```

**2. Command line:**
```bash
terraform apply -var="bucket_name=my-bucket"
```

**3. Environment variables:**
```bash
export TF_VAR_bucket_name="my-bucket"
terraform apply
```

**4. Interactive prompt** (if no default and not provided)

### Try It

```bash
cd ../02-variables

# Review the files
cat variables.tf
cat terraform.tfvars

terraform init
terraform plan
terraform apply
```

## 📝 Exercise 3: Outputs

Outputs export values from your Terraform configuration.

### Why Use Outputs?

- Display important information after apply
- Pass values to other Terraform configurations
- Use in automation scripts
- Document infrastructure details

### Output Syntax

```hcl
output "bucket_name" {
  description = "Name of the S3 bucket"
  value       = aws_s3_bucket.example.id
}

output "bucket_arn" {
  description = "ARN of the S3 bucket"
  value       = aws_s3_bucket.example.arn
  sensitive   = false
}

output "instance_ips" {
  description = "IP addresses of instances"
  value       = aws_instance.web[*].public_ip
}
```

### Viewing Outputs

```bash
# After apply, outputs are shown automatically

# View specific output
terraform output bucket_name

# View all outputs
terraform output

# Output as JSON
terraform output -json
```

### Try It

```bash
cd ../03-outputs

terraform init
terraform apply

# View outputs
terraform output
terraform output bucket_arn
```

## 📝 Exercise 4: Data Sources

Data sources fetch information about existing infrastructure.

### Data Source vs Resource

- **Resource**: Creates/manages infrastructure
- **Data Source**: Reads existing infrastructure

### Common Use Cases

```hcl
# Get latest Amazon Linux AMI
data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]
  
  filter {
    name   = "name"
    values = ["amzn2-ami-hvm-*-x86_64-gp2"]
  }
}

# Get current AWS region
data "aws_region" "current" {}

# Get current AWS account ID
data "aws_caller_identity" "current" {}

# Get availability zones
data "aws_availability_zones" "available" {
  state = "available"
}

# Use data source
resource "aws_instance" "web" {
  ami           = data.aws_ami.amazon_linux.id
  instance_type = "t2.micro"
  
  tags = {
    Region = data.aws_region.current.name
  }
}
```

### Try It

```bash
cd ../04-data-sources

terraform init
terraform plan
terraform apply
```

## 🔍 Understanding State

Terraform stores the state of your infrastructure in a file called `terraform.tfstate`.

### What is State?

- Maps real-world resources to your configuration
- Tracks metadata and resource dependencies
- Improves performance (doesn't query cloud provider every time)

### State File Location

**Local state** (default):
```
terraform.tfstate
terraform.tfstate.backup
```

**Remote state** (recommended for teams):
```hcl
terraform {
  backend "s3" {
    bucket = "my-terraform-state"
    key    = "path/to/state"
    region = "us-east-1"
  }
}
```

### State Commands

```bash
# List resources in state
terraform state list

# Show details of a resource
terraform state show aws_s3_bucket.example

# Remove resource from state (doesn't delete actual resource)
terraform state rm aws_s3_bucket.example

# Move resource in state
terraform state mv aws_s3_bucket.old aws_s3_bucket.new
```

### ⚠️ State Best Practices

1. **Never edit state files manually**
2. **Use remote state for teams**
3. **Enable state locking** (prevents concurrent modifications)
4. **Backup state files** regularly
5. **Use separate state files** for different environments

## 🔧 Terraform Configuration Files

### Standard File Structure

```
project/
├── main.tf           # Primary resources
├── variables.tf      # Variable declarations
├── outputs.tf        # Output declarations
├── versions.tf       # Provider version constraints
├── terraform.tfvars  # Variable values (don't commit secrets!)
└── .terraform/       # Downloaded providers (gitignore this)
```

### versions.tf Example

```hcl
terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}
```

## 💡 Best Practices

### 1. Use Consistent Naming
```hcl
# Good
resource "aws_s3_bucket" "application_logs" {
  bucket = "myapp-logs-${var.environment}"
}

# Avoid
resource "aws_s3_bucket" "b1" {
  bucket = "bucket1"
}
```

### 2. Add Descriptions
```hcl
variable "instance_type" {
  description = "EC2 instance type for web servers"
  type        = string
  default     = "t2.micro"
}
```

### 3. Use Tags
```hcl
tags = {
  Name        = "web-server"
  Environment = var.environment
  ManagedBy   = "Terraform"
  Project     = var.project_name
}
```

### 4. Validate Variables
```hcl
variable "environment" {
  type        = string
  description = "Environment name"
  
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}
```

## ✅ Checklist

- [ ] Install Terraform and verify version
- [ ] Understand HCL syntax
- [ ] Create your first resource
- [ ] Use variables to parameterize configuration
- [ ] Export values with outputs
- [ ] Fetch data with data sources
- [ ] Understand state files
- [ ] Practice the Terraform workflow

## 🎓 Quiz

1. What does `terraform init` do?
2. What's the difference between `terraform plan` and `terraform apply`?
3. How do you pass a variable value to Terraform?
4. What's the purpose of the state file?
5. When would you use a data source instead of a resource?
6. What happens if you delete the state file?

## 🚨 Common Mistakes

1. **Forgetting to run `terraform init`** after adding new providers
2. **Not running `terraform plan`** before apply
3. **Committing `terraform.tfvars`** with secrets to git
4. **Manually editing state files**
5. **Using hardcoded values** instead of variables
6. **Not tagging resources** for cost tracking

## ➡️ Next Steps

Once you're comfortable with the basics, move on to `02-terraform-features` to learn about:
- Advanced meta-arguments (count, for_each)
- Dynamic blocks
- Functions and expressions
- Lifecycle rules
- And more!
