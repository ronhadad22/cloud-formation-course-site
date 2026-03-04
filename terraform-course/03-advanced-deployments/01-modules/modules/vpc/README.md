# VPC Module

This module creates a complete VPC with public and private subnets across multiple availability zones.

## Features

- VPC with configurable CIDR block
- Public subnets with Internet Gateway
- Private subnets with NAT Gateway (optional)
- Route tables and associations
- DNS support and hostnames

## Usage

```hcl
module "vpc" {
  source = "./modules/vpc"

  vpc_name           = "my-vpc"
  vpc_cidr           = "10.0.0.0/16"
  availability_zones = ["us-east-1a", "us-east-1b", "us-east-1c"]
  enable_nat_gateway = true

  tags = {
    Environment = "production"
    ManagedBy   = "Terraform"
  }
}
```

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| vpc_name | Name of the VPC | string | - | yes |
| vpc_cidr | CIDR block for VPC | string | "10.0.0.0/16" | no |
| availability_zones | List of AZs | list(string) | - | yes |
| enable_dns_hostnames | Enable DNS hostnames | bool | true | no |
| enable_dns_support | Enable DNS support | bool | true | no |
| enable_nat_gateway | Enable NAT Gateway | bool | true | no |
| tags | Tags for resources | map(string) | {} | no |

## Outputs

| Name | Description |
|------|-------------|
| vpc_id | ID of the VPC |
| vpc_cidr | CIDR block of the VPC |
| public_subnet_ids | IDs of public subnets |
| private_subnet_ids | IDs of private subnets |
| internet_gateway_id | ID of the Internet Gateway |
| nat_gateway_ids | IDs of NAT Gateways |

## Examples

### Minimal Configuration

```hcl
module "vpc" {
  source = "./modules/vpc"

  vpc_name           = "simple-vpc"
  availability_zones = ["us-east-1a", "us-east-1b"]
}
```

### Production Configuration

```hcl
module "vpc" {
  source = "./modules/vpc"

  vpc_name           = "production-vpc"
  vpc_cidr           = "10.0.0.0/16"
  availability_zones = ["us-east-1a", "us-east-1b", "us-east-1c"]
  enable_nat_gateway = true

  tags = {
    Environment = "production"
    Project     = "myapp"
    ManagedBy   = "Terraform"
  }
}
```

### Cost-Optimized (No NAT Gateway)

```hcl
module "vpc" {
  source = "./modules/vpc"

  vpc_name           = "dev-vpc"
  vpc_cidr           = "10.0.0.0/16"
  availability_zones = ["us-east-1a", "us-east-1b"]
  enable_nat_gateway = false

  tags = {
    Environment = "development"
  }
}
```
