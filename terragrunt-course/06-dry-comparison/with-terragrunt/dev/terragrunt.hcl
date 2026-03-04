# Development Environment Configuration - WITH Terragrunt
# Notice: Only 6 lines of environment-specific config!
# No backend, no provider, no duplication!

include "root" {
  path = find_in_parent_folders()
}

inputs = {
  vpc_cidr    = "10.0.0.0/16"
  environment = "dev"
}
