include "root" {
  path = find_in_parent_folders()
}

locals {
  env_vars    = read_terragrunt_config(find_in_parent_folders("env.hcl"))
  environment = local.env_vars.locals.environment
  vpc_cidr    = local.env_vars.locals.vpc_cidr
  tags        = local.env_vars.locals.tags
}

terraform {
  source = "../../modules/vpc"
}

inputs = {
  vpc_name    = "terragrunt-${local.environment}-vpc"
  vpc_cidr    = local.vpc_cidr
  environment = local.environment
  tags        = local.tags
}
