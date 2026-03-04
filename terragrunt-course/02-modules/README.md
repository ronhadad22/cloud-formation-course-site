# Lesson 02: Working with Modules

## 🎯 Learning Goals

- Understand Terraform modules and their benefits
- Learn how to reference modules with Terragrunt
- Create reusable infrastructure components
- Pass inputs and use outputs between modules

## 📖 What are Modules?

Modules are containers for multiple resources that are used together. They help you:
- **Organize** infrastructure into logical components
- **Reuse** code across projects and environments
- **Standardize** infrastructure patterns
- **Simplify** complex configurations

## 🏗️ Project Structure

```
02-modules/
├── README.md
├── modules/
│   ├── vpc/              # Reusable VPC module
│   └── ec2/              # Reusable EC2 module
├── vpc/
│   └── terragrunt.hcl    # VPC deployment config
└── ec2/
    └── terragrunt.hcl    # EC2 deployment config
```

## 📝 Exercise 1: Deploy a VPC Module

### Step 1: Review the VPC Module

Look at `modules/vpc/main.tf` - this is a reusable module that creates:
- VPC
- Public and private subnets
- Internet Gateway
- NAT Gateway
- Route tables

### Step 2: Deploy the VPC

```bash
cd vpc

# Initialize and apply
terragrunt init
terragrunt plan
terragrunt apply
```

### Step 3: Check Outputs

```bash
terragrunt output
```

You'll see the VPC ID, subnet IDs, and other useful information.

## 📝 Exercise 2: Deploy EC2 Using VPC Outputs

The EC2 module depends on the VPC module's outputs.

### Step 1: Review Dependencies

Look at `ec2/terragrunt.hcl` - notice the `dependency` block:

```hcl
dependency "vpc" {
  config_path = "../vpc"
}
```

This tells Terragrunt to:
1. Get outputs from the VPC module
2. Make them available as inputs to EC2

### Step 2: Deploy EC2

```bash
cd ../ec2

terragrunt init
terragrunt plan
terragrunt apply
```

Terragrunt automatically:
- Ensures VPC is deployed first
- Passes VPC outputs to EC2 inputs

## 🔍 Key Concepts

### Module Source

In `terragrunt.hcl`:
```hcl
terraform {
  source = "../modules/vpc"
}
```

This can be:
- Local path: `../modules/vpc`
- Git repo: `git::https://github.com/user/repo.git//modules/vpc`
- Terraform Registry: `terraform-aws-modules/vpc/aws`

### Dependencies

```hcl
dependency "vpc" {
  config_path = "../vpc"
}

inputs = {
  vpc_id = dependency.vpc.outputs.vpc_id
  subnet_id = dependency.vpc.outputs.public_subnet_ids[0]
}
```

### Stack Commands (Terragrunt v0.96.0+)

Deploy everything at once:
```bash
# From 02-modules directory
terragrunt stack run plan
terragrunt stack run apply

# With auto-approve
terragrunt stack run apply --auto-approve

# Destroy everything (in reverse order)
terragrunt stack run destroy
```

**Note**: The old `run-all` syntax is deprecated. Use `stack run` instead.

Terragrunt automatically determines the correct order based on dependencies!

## 💡 Benefits of This Approach

1. **Reusability**: VPC module can be used in dev, staging, prod
2. **Consistency**: Same VPC configuration everywhere
3. **Maintainability**: Update module once, affects all environments
4. **Dependency Management**: Terragrunt handles the order automatically

## 🧹 Clean Up

```bash
# Destroy in reverse order (EC2 first, then VPC)
cd ec2
terragrunt destroy

cd ../vpc
terragrunt destroy

# Or use run-all (automatically determines order)
cd ..
terragrunt run-all destroy
```

## ✅ Checklist

- [ ] Understand what Terraform modules are
- [ ] Successfully deploy the VPC module
- [ ] View VPC outputs
- [ ] Successfully deploy the EC2 module
- [ ] Understand how dependencies work
- [ ] Use `run-all` commands
- [ ] Clean up all resources

## 🎓 Quiz

1. What is a Terraform module?
2. How do you reference a local module in Terragrunt?
3. What does the `dependency` block do?
4. What's the benefit of `terragrunt run-all apply`?
5. In what order should you destroy resources with dependencies?

## ➡️ Next Steps

Move on to `03-multi-env` to learn how to manage multiple environments (dev, staging, prod) efficiently!
