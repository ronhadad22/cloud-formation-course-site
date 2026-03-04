# DUPLICATED: Exact same as dev and staging, only default CIDR differs

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.2.0.0/16"  # Different CIDR for production
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"  # Different environment name
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "dry-example"
}
