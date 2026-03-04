# DRY Comparison: Without vs With Terragrunt

## 📊 Side-by-Side Comparison

### Directory Structure

#### WITHOUT Terragrunt (Repetitive)
```
without-terragrunt/
├── dev/
│   ├── main.tf           # 75 lines - DUPLICATED
│   ├── variables.tf      # 18 lines - DUPLICATED
│   └── outputs.tf        # 15 lines - DUPLICATED
├── staging/
│   ├── main.tf           # 75 lines - DUPLICATED (99% same as dev)
│   ├── variables.tf      # 18 lines - DUPLICATED (99% same as dev)
│   └── outputs.tf        # 15 lines - DUPLICATED (100% same as dev)
└── prod/
    ├── main.tf           # 75 lines - DUPLICATED (99% same as dev)
    ├── variables.tf      # 18 lines - DUPLICATED (99% same as dev)
    └── outputs.tf        # 15 lines - DUPLICATED (100% same as dev)

Total: 324 lines of code
Duplication: ~70%
```

#### WITH Terragrunt (DRY)
```
with-terragrunt/
├── terragrunt.hcl        # 48 lines - SHARED CONFIG
├── _modules/
│   └── vpc/
│       ├── main.tf       # 52 lines - SINGLE MODULE
│       ├── variables.tf  # 18 lines - SINGLE MODULE
│       └── outputs.tf    # 15 lines - SINGLE MODULE
├── dev/
│   └── terragrunt.hcl    # 6 lines - ONLY DIFFERENCES
├── staging/
│   └── terragrunt.hcl    # 6 lines - ONLY DIFFERENCES
└── prod/
    └── terragrunt.hcl    # 6 lines - ONLY DIFFERENCES

Total: 151 lines of code
Duplication: ~5%
```

## 🔍 Detailed Code Comparison

### Backend Configuration

#### WITHOUT Terragrunt
**dev/main.tf** (repeated in staging and prod):
```hcl
terraform {
  backend "s3" {
    bucket         = "my-terraform-state-bucket"
    key            = "dev/vpc/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-state-locks"
  }
}
```

**staging/main.tf** (almost identical):
```hcl
terraform {
  backend "s3" {
    bucket         = "my-terraform-state-bucket"
    key            = "staging/vpc/terraform.tfstate"  # Only this differs!
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-state-locks"
  }
}
```

**prod/main.tf** (almost identical):
```hcl
terraform {
  backend "s3" {
    bucket         = "my-terraform-state-bucket"
    key            = "prod/vpc/terraform.tfstate"  # Only this differs!
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-state-locks"
  }
}
```

**Result**: 3 files × 8 lines = **24 lines of duplicated code**

---

#### WITH Terragrunt
**terragrunt.hcl** (one file for all environments):
```hcl
locals {
  environment = basename(dirname(get_terragrunt_dir()))
}

remote_state {
  backend = "s3"
  generate = {
    path      = "backend.tf"
    if_exists = "overwrite_terragrunt"
  }
  config = {
    bucket         = "my-terraform-state-bucket"
    key            = "${local.environment}/vpc/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-state-locks"
  }
}
```

**Result**: 1 file × 16 lines = **16 lines total**

**Savings**: 24 - 16 = **8 lines saved (33% reduction)**

---

### Provider Configuration

#### WITHOUT Terragrunt
**dev/main.tf**:
```hcl
provider "aws" {
  region = "us-east-1"
  default_tags {
    tags = {
      Environment = "dev"
      ManagedBy   = "Terraform"
      Project     = "DRY-Example"
    }
  }
}
```

**staging/main.tf**:
```hcl
provider "aws" {
  region = "us-east-1"
  default_tags {
    tags = {
      Environment = "staging"  # Only this differs!
      ManagedBy   = "Terraform"
      Project     = "DRY-Example"
    }
  }
}
```

**prod/main.tf**:
```hcl
provider "aws" {
  region = "us-east-1"
  default_tags {
    tags = {
      Environment = "production"  # Only this differs!
      ManagedBy   = "Terraform"
      Project     = "DRY-Example"
    }
  }
}
```

**Result**: 3 files × 11 lines = **33 lines of duplicated code**

---

#### WITH Terragrunt
**terragrunt.hcl**:
```hcl
generate "provider" {
  path      = "provider.tf"
  if_exists = "overwrite_terragrunt"
  contents  = <<EOF
provider "aws" {
  region = "us-east-1"
  default_tags {
    tags = {
      Environment = "${local.environment}"
      ManagedBy   = "Terragrunt"
      Project     = "DRY-Example"
    }
  }
}
EOF
}
```

**Result**: 1 file × 14 lines = **14 lines total**

**Savings**: 33 - 14 = **19 lines saved (58% reduction)**

---

### Environment-Specific Configuration

#### WITHOUT Terragrunt
Each environment needs full Terraform code:
- **dev/main.tf**: 75 lines
- **staging/main.tf**: 75 lines
- **prod/main.tf**: 75 lines

**Total**: 225 lines

---

#### WITH Terragrunt
**_modules/vpc/main.tf**: 52 lines (shared)

**dev/terragrunt.hcl**:
```hcl
include "root" {
  path = find_in_parent_folders()
}

inputs = {
  vpc_cidr    = "10.0.0.0/16"
  environment = "dev"
}
```

**staging/terragrunt.hcl**:
```hcl
include "root" {
  path = find_in_parent_folders()
}

inputs = {
  vpc_cidr    = "10.1.0.0/16"
  environment = "staging"
}
```

**prod/terragrunt.hcl**:
```hcl
include "root" {
  path = find_in_parent_folders()
}

inputs = {
  vpc_cidr    = "10.2.0.0/16"
  environment = "production"
}
```

**Total**: 52 + (6 × 3) = **70 lines**

**Savings**: 225 - 70 = **155 lines saved (69% reduction)**

---

## 📈 Summary Statistics

| Metric | Without Terragrunt | With Terragrunt | Improvement |
|--------|-------------------|-----------------|-------------|
| **Total Lines** | 324 | 151 | **53% less code** |
| **Backend Config** | 24 lines (3 files) | 16 lines (1 file) | **33% reduction** |
| **Provider Config** | 33 lines (3 files) | 14 lines (1 file) | **58% reduction** |
| **Module Code** | 225 lines (3 copies) | 70 lines (1 module) | **69% reduction** |
| **Files to Maintain** | 9 files | 7 files | **22% fewer files** |
| **Code Duplication** | ~70% | ~5% | **93% less duplication** |

## 🎯 Real-World Impact

### Scenario 1: Add New Environment (QA)

#### WITHOUT Terragrunt:
```bash
# Copy entire directory
cp -r dev qa

# Edit 3 files manually:
vim qa/main.tf          # Change backend key, environment tags
vim qa/variables.tf     # Change CIDR, environment name
vim qa/outputs.tf       # No changes needed

# Risk: Forget to update something, typos, inconsistency
```
**Time**: ~10 minutes  
**Lines to modify**: ~15 lines across 3 files  
**Error risk**: High

---

#### WITH Terragrunt:
```bash
# Create directory and one file
mkdir qa
cat > qa/terragrunt.hcl <<EOF
include "root" {
  path = find_in_parent_folders()
}

inputs = {
  vpc_cidr    = "10.3.0.0/16"
  environment = "qa"
}
EOF
```
**Time**: ~2 minutes  
**Lines to modify**: 6 lines in 1 file  
**Error risk**: Low

**Savings**: 80% faster, 60% less code, much safer

---

### Scenario 2: Change Backend Region

#### WITHOUT Terragrunt:
```bash
# Edit 3 separate files
vim dev/main.tf         # Change region in backend block
vim staging/main.tf     # Change region in backend block
vim prod/main.tf        # Change region in backend block

# Risk: Miss one file, typo in one file
```
**Files to edit**: 3  
**Lines to change**: 3 (one per file)  
**Error risk**: Medium

---

#### WITH Terragrunt:
```bash
# Edit 1 file
vim terragrunt.hcl      # Change region in remote_state config
```
**Files to edit**: 1  
**Lines to change**: 1  
**Error risk**: None

**Savings**: 67% fewer files, guaranteed consistency

---

### Scenario 3: Add Default Tags

#### WITHOUT Terragrunt:
```bash
# Edit provider block in 3 files
vim dev/main.tf         # Add new tag
vim staging/main.tf     # Add new tag
vim prod/main.tf        # Add new tag

# Ensure tag value is correct for each environment
```
**Files to edit**: 3  
**Risk**: Inconsistent tag names or values

---

#### WITH Terragrunt:
```bash
# Edit 1 file
vim terragrunt.hcl      # Add tag to generate block
```
**Files to edit**: 1  
**Risk**: None - automatically applied to all

---

## 🏆 Key Advantages of Terragrunt

### 1. **Single Source of Truth**
- Backend config: 1 place instead of 3
- Provider config: 1 place instead of 3
- Module code: 1 place instead of 3

### 2. **Guaranteed Consistency**
- All environments use same backend settings
- All environments use same provider settings
- All environments use same module code

### 3. **Easier Maintenance**
- Change once, apply everywhere
- No risk of missing an environment
- No copy-paste errors

### 4. **Faster Development**
- Add new environment in 2 minutes
- Modify configuration in seconds
- Less code to review

### 5. **Better Collaboration**
- Less code = easier to understand
- Clear separation of concerns
- Obvious where to make changes

## 🎓 When to Use Each Approach

### Use Plain Terraform When:
- ✅ Single environment only
- ✅ Proof of concept
- ✅ Learning Terraform basics
- ✅ Very simple setup

### Use Terragrunt When:
- ✅ Multiple environments (dev/staging/prod)
- ✅ Multiple regions
- ✅ Multiple AWS accounts
- ✅ Team collaboration
- ✅ Production workloads
- ✅ Need consistency across deployments

## 💡 Bottom Line

**Without Terragrunt**: 324 lines, 70% duplication, high maintenance  
**With Terragrunt**: 151 lines, 5% duplication, low maintenance

**Terragrunt reduces code by 53% and duplication by 93%!**
