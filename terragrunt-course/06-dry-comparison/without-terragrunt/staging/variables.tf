# DUPLICATED: Exact same as dev/variables.tf, only default CIDR differs

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.1.0.0/16"  # Different CIDR for staging
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "staging"  # Different environment name
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "dry-example"
}
