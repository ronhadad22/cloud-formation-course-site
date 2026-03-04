# Lesson 06: DRY Principle - With vs Without Terragrunt

## 🎯 Learning Goals

- Understand the DRY (Don't Repeat Yourself) principle
- See the problems with traditional Terraform code duplication
- Learn how Terragrunt eliminates repetition
- Compare code complexity and maintainability

## 📖 What is DRY?

**DRY (Don't Repeat Yourself)** is a software development principle that states:
> "Every piece of knowledge must have a single, unambiguous, authoritative representation within a system."

In infrastructure as code, this means:
- ❌ Don't copy-paste backend configuration
- ❌ Don't duplicate provider settings
- ❌ Don't repeat the same code across environments
- ✅ Write it once, reuse everywhere

## 🔴 Problem: Without Terragrunt

When using plain Terraform for multiple environments, you end up with:

### Issues:
1. **Duplicated backend configuration** in every environment
2. **Duplicated provider configuration** in every environment
3. **Copy-paste errors** when creating new environments
4. **Hard to maintain** - changes need to be made in multiple places
5. **Risk of inconsistency** between environments

### Code Statistics (Without Terragrunt):
- **Total lines of code**: ~450 lines
- **Duplicated code**: ~70%
- **Files to maintain**: 12 files
- **Backend configs**: 3 (one per environment)
- **Provider configs**: 3 (one per environment)

## 🟢 Solution: With Terragrunt

Terragrunt solves these problems by:

### Benefits:
1. **Single backend configuration** - defined once in root
2. **Single provider configuration** - generated automatically
3. **Environment-specific values** - in simple HCL files
4. **Easy to add environments** - just copy a folder and change values
5. **Guaranteed consistency** - shared configuration

### Code Statistics (With Terragrunt):
- **Total lines of code**: ~180 lines
- **Duplicated code**: ~5%
- **Files to maintain**: 7 files
- **Backend configs**: 1 (in root terragrunt.hcl)
- **Provider configs**: 1 (auto-generated)

## 📊 Comparison

| Aspect | Without Terragrunt | With Terragrunt | Improvement |
|--------|-------------------|-----------------|-------------|
| Lines of Code | 450 | 180 | **60% less** |
| Duplicated Code | 70% | 5% | **93% reduction** |
| Backend Configs | 3 files | 1 file | **67% less** |
| Provider Configs | 3 files | Auto-generated | **100% less** |
| Add New Environment | Copy 150 lines | Copy 20 lines | **87% less** |
| Maintenance Effort | High | Low | **Much easier** |

## 📝 Exercise: Compare Both Approaches

### Part 1: Review Without Terragrunt
1. Look at `without-terragrunt/` directory
2. Notice the repetition in each environment
3. Count how many times backend config is duplicated
4. Try to spot the differences between environments

### Part 2: Review With Terragrunt
1. Look at `with-terragrunt/` directory
2. See how backend is defined once
3. Notice the simple environment configs
4. Compare the amount of code

### Part 3: Add a New Environment
Try adding a "qa" environment in both approaches:

**Without Terragrunt**: Copy entire directory, modify 5+ files
**With Terragrunt**: Copy one folder, modify 1 file

## 🎓 Real-World Impact

### Scenario: Update Backend Configuration

**Task**: Change S3 bucket region from us-east-1 to us-west-2

**Without Terragrunt**:
```bash
# Edit 3 files manually
vim dev/backend.tf
vim staging/backend.tf
vim prod/backend.tf
# Risk: Forget one file, typo in one file
```

**With Terragrunt**:
```bash
# Edit 1 file
vim terragrunt.hcl
# Done! All environments updated
```

### Scenario: Add New AWS Provider Feature

**Task**: Add default tags to all resources

**Without Terragrunt**:
- Edit 3 provider.tf files
- Ensure consistency across all
- Test each environment

**With Terragrunt**:
- Edit 1 generate block
- Auto-applied to all environments
- Single test validates all

## ✅ Key Takeaways

1. **Terragrunt reduces code by 60%** through DRY principles
2. **Maintenance is easier** - change once, apply everywhere
3. **Less error-prone** - no copy-paste mistakes
4. **Faster development** - add new environments in minutes
5. **Better consistency** - shared configuration guarantees uniformity

## 🎯 When to Use Terragrunt

### Use Terragrunt When:
- ✅ Managing multiple environments (dev, staging, prod)
- ✅ Deploying to multiple regions
- ✅ Managing multiple AWS accounts
- ✅ Team collaboration on infrastructure
- ✅ Need consistent configuration across deployments

### Plain Terraform is Fine When:
- ✅ Single environment deployment
- ✅ Proof of concept / learning
- ✅ Very simple infrastructure
- ✅ No need for code reuse

## 📚 Additional Resources

- [DRY Principle](https://en.wikipedia.org/wiki/Don%27t_repeat_yourself)
- [Terragrunt Documentation](https://terragrunt.gruntwork.io/)
- [Terraform Best Practices](https://www.terraform-best-practices.com/)

## ➡️ Next Steps

After understanding DRY principles:
1. Always think: "Am I repeating myself?"
2. Use Terragrunt for multi-environment setups
3. Keep configuration in one place
4. Make it easy to add new environments
