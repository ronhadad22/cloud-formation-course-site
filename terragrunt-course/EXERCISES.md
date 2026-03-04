# Terragrunt Course Exercises

## 🎯 Hands-On Exercises

Complete these exercises to reinforce your learning. Each exercise builds on previous lessons.

## Exercise 1: Your First Terragrunt Deployment (Beginner)

**Goal**: Deploy a simple S3 bucket using Terragrunt

**Steps**:
1. Navigate to `01-basics`
2. Review the `terragrunt.hcl` and `terraform/main.tf` files
3. Run `terragrunt init`
4. Run `terragrunt plan` and review the output
5. Run `terragrunt apply` to create the bucket
6. Verify the bucket exists in AWS Console
7. Run `terragrunt destroy` to clean up

**Questions**:
- What does the `inputs` block do?
- How does Terragrunt pass variables to Terraform?
- What's the difference between `terragrunt apply` and `terraform apply`?

## Exercise 2: Module Dependencies (Intermediate)

**Goal**: Deploy VPC and EC2 with proper dependencies

**Steps**:
1. Navigate to `02-modules/vpc`
2. Deploy the VPC: `terragrunt apply`
3. Note the outputs: `terragrunt output`
4. Navigate to `02-modules/ec2`
5. Review how the dependency is configured
6. Deploy EC2: `terragrunt apply`
7. Try deploying both at once: `cd .. && terragrunt run-all apply`

**Questions**:
- How does the EC2 module know about the VPC?
- What happens if you try to deploy EC2 before VPC?
- What does `run-all` do differently?

## Exercise 3: Multi-Environment Setup (Intermediate)

**Goal**: Deploy the same infrastructure to dev, staging, and prod

**Steps**:
1. Navigate to `03-multi-env`
2. Review the root `terragrunt.hcl` - what's configured here?
3. Review `dev/env.hcl` - what makes dev different from prod?
4. Deploy to dev: `cd dev/vpc && terragrunt apply`
5. Deploy to staging: `cd ../../staging/vpc && terragrunt apply`
6. Compare the resources created in each environment
7. Clean up: `terragrunt destroy` in each environment

**Questions**:
- Where is the Terraform state stored for each environment?
- How does the VPC CIDR differ between environments?
- What configuration is shared vs environment-specific?

## Exercise 4: Hooks and Validation (Advanced)

**Goal**: Add validation and notification hooks

**Steps**:
1. Navigate to `04-advanced/hooks-example`
2. Review the hooks in `terragrunt.hcl`
3. Run `terragrunt plan` and observe the hook messages
4. Run `terragrunt apply` and observe different hooks
5. Modify the hooks to add your own messages

**Challenge**: Add a hook that:
- Runs before apply
- Checks if a specific environment variable is set
- Fails if the variable is not set

## Exercise 5: Complex Dependencies (Advanced)

**Goal**: Deploy a multi-tier application with dependencies

**Steps**:
1. Navigate to `04-advanced/dependencies-example`
2. Review the dependency chain: database → app → monitoring
3. Try planning the app without deploying database (uses mocks)
4. Deploy everything: `terragrunt run-all apply`
5. Observe the order Terragrunt uses
6. Try destroying in wrong order - what happens?

**Questions**:
- How does Terragrunt determine deployment order?
- What are mock outputs used for?
- When would you use `mock_outputs_allowed_terraform_commands`?

## Exercise 6: Generate Blocks (Advanced)

**Goal**: Use generate blocks to create files dynamically

**Steps**:
1. Navigate to `04-advanced/generate-example`
2. Review the generate blocks in `terragrunt.hcl`
3. Run `terragrunt init`
4. Check the generated files in `.terragrunt-cache/`
5. Modify the generate block to add custom tags

**Challenge**: Create a generate block that:
- Generates a `terraform.tfvars` file
- Includes environment-specific variables
- Uses locals for dynamic values

## 🏆 Final Project: Complete Infrastructure

**Goal**: Build a complete, production-ready infrastructure setup

**Requirements**:
1. Create three environments: dev, staging, prod
2. Each environment should have:
   - VPC with public and private subnets
   - EC2 instance in public subnet
   - S3 bucket for application data
   - CloudWatch alarms for monitoring
3. Use proper dependencies between modules
4. Add validation hooks before apply
5. Use mock outputs for fast planning
6. Configure remote state in S3
7. Use environment-specific variables

**Structure**:
```
final-project/
├── terragrunt.hcl           # Root config
├── modules/
│   ├── vpc/
│   ├── ec2/
│   ├── s3/
│   └── monitoring/
├── dev/
│   ├── env.hcl
│   ├── vpc/
│   ├── ec2/
│   ├── s3/
│   └── monitoring/
├── staging/
│   └── ...
└── prod/
    └── ...
```

**Bonus Points**:
- Add a README for each module
- Include cost estimation hooks
- Add security validation hooks
- Create a CI/CD pipeline configuration
- Document the dependency graph

## 📝 Quiz Answers

### Lesson 01 Quiz
1. `terragrunt.hcl`
2. `terragrunt init`
3. Using the `inputs` block
4. `terragrunt apply` runs Terragrunt wrapper which then calls `terraform apply`

### Lesson 02 Quiz
1. A container for multiple resources used together
2. Using `source = "../path/to/module"` in the terraform block
3. Tells Terragrunt to get outputs from another module and make them available
4. Automatically deploys all modules in correct order based on dependencies
5. Reverse order - destroy dependent resources first

### Lesson 03 Quiz
1. Shared configuration like backend, provider, common variables
2. Environment-specific variables like CIDR blocks, instance types
3. Using the `include` block with `find_in_parent_folders()`
4. In S3 bucket with separate keys per environment
5. Automatically creates files before Terraform runs

### Lesson 04 Quiz
1. `before_hook` runs before Terraform command, `after_hook` runs after
2. To test modules without deploying dependencies
3. By analyzing dependency blocks and creating a directed acyclic graph
4. Overwrites the file if it already exists
5. Set `run_on_error = true` in the hook configuration

## 🎓 Certification Challenge

Complete all exercises and the final project, then answer these questions:

1. Explain the DRY principle and how Terragrunt achieves it
2. Describe a real-world scenario where you'd use mock outputs
3. Design a dependency graph for a 3-tier web application
4. Explain when to use `run-all` vs deploying modules individually
5. Describe best practices for organizing Terragrunt configurations

## 📚 Additional Practice

1. **Refactor Existing Terraform**: Take an existing Terraform project and convert it to use Terragrunt
2. **Multi-Region Deployment**: Extend the multi-env setup to deploy across multiple AWS regions
3. **Module Library**: Create a library of reusable Terraform modules for common patterns
4. **CI/CD Integration**: Set up a CI/CD pipeline that uses Terragrunt
5. **Cost Optimization**: Add hooks that estimate costs before deployment

## 🤝 Community Challenges

Share your solutions and learn from others:
1. Most creative use of hooks
2. Most efficient dependency graph
3. Best module organization
4. Most comprehensive validation
5. Best documentation

---

**Need Help?** Review the lesson READMEs or consult the Terragrunt documentation.

**Completed Everything?** Congratulations! You're now a Terragrunt expert! 🎉
