# Root Terragrunt Configuration - WITH Terragrunt (DRY!)
# This single file replaces ALL the duplicated backend and provider configs!

locals {
  # Parse environment from path
  environment = basename(dirname(get_terragrunt_dir()))
}

# Generate backend configuration - NO DUPLICATION!
# This replaces 3 separate backend.tf files
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

# Generate provider configuration - NO DUPLICATION!
# This replaces 3 separate provider blocks
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

# Terraform source - SINGLE MODULE, used by all environments
terraform {
  source = "../_modules/vpc"
}
