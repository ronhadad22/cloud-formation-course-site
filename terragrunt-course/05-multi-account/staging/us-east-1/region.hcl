# Region Configuration for us-east-1

locals {
  # AWS Region
  aws_region = "us-east-1"
  
  # Availability Zones
  availability_zones = ["us-east-1a", "us-east-1b", "us-east-1c"]
  
  # Region-specific settings
  region_tags = {
    Region = "us-east-1"
  }
  
  # AMI IDs (region-specific)
  # Amazon Linux 2023 AMI
  ami_id = "ami-0c55b159cbfafe1f0"
  
  # Region-specific CIDR blocks for subnets
  public_subnet_cidrs  = ["10.1.1.0/24", "10.1.2.0/24", "10.1.3.0/24"]
  private_subnet_cidrs = ["10.1.11.0/24", "10.1.12.0/24", "10.1.13.0/24"]
}
