# Lesson 01: Terragrunt Basics

## 🎯 Learning Goals

- Understand what Terragrunt is and why it's useful
- Learn the structure of a terragrunt.hcl file
- Deploy your first infrastructure with Terragrunt
- Understand the relationship between Terragrunt and Terraform

## 📖 What is Terragrunt?

Terragrunt is a thin wrapper for Terraform that provides extra tools for:
1. **Keeping your Terraform code DRY** - Don't repeat backend and provider configurations
2. **Working with multiple modules** - Manage dependencies between modules
3. **Managing remote state** - Automatically configure remote state for each module

## 🏗️ Basic Structure

A typical Terragrunt project has:
```
project/
├── terragrunt.hcl          # Terragrunt configuration
└── main.tf                 # Terraform code (or reference to module)
```

## 📝 Exercise 1: Simple S3 Bucket

In this exercise, you'll create an S3 bucket using Terragrunt.

### Step 1: Review the Configuration

Look at the `terragrunt.hcl` file - this is where Terragrunt configuration lives.

Key sections:
- `terraform {}` - Specifies the Terraform code to use
- `inputs {}` - Variables passed to Terraform

### Step 2: Deploy

```bash
# Navigate to this directory
cd 01-basics

# Initialize Terragrunt (downloads providers, sets up backend)
terragrunt init

# Preview what will be created
terragrunt plan

# Create the resources
terragrunt apply
```

### Step 3: Verify

```bash
# List your S3 buckets
aws s3 ls | grep terragrunt-demo
```

### Step 4: Clean Up

```bash
# Destroy the resources
terragrunt destroy
```

## 🔍 Key Concepts

### terragrunt.hcl vs main.tf
- `terragrunt.hcl` - Terragrunt-specific configuration
- `main.tf` - Standard Terraform code

### Terraform Block
```hcl
terraform {
  source = "./terraform"  # Path to Terraform code
}
```

### Inputs Block
```hcl
inputs = {
  bucket_name = "my-bucket"
  environment = "dev"
}
```

These inputs become Terraform variables automatically!

## 💡 Why Use Terragrunt Here?

You might think: "This seems like extra complexity for a simple S3 bucket!"

You're right! The benefits become clear when:
- Managing multiple environments (dev, staging, prod)
- Using the same module across many projects
- Coordinating multiple Terraform modules

We'll see these benefits in later lessons!

## ✅ Checklist

- [ ] Understand what Terragrunt does
- [ ] Successfully run `terragrunt init`
- [ ] Successfully run `terragrunt plan`
- [ ] Successfully run `terragrunt apply`
- [ ] Verify the S3 bucket was created
- [ ] Successfully run `terragrunt destroy`

## 🎓 Quiz

1. What file does Terragrunt look for in a directory?
2. What command initializes a Terragrunt configuration?
3. How do you pass variables to Terraform using Terragrunt?
4. What's the difference between `terraform apply` and `terragrunt apply`?

## ➡️ Next Steps

Once you're comfortable with the basics, move on to `02-modules` to learn about reusable infrastructure modules!
