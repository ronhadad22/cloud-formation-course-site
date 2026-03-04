terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}

data "aws_caller_identity" "current" {}

resource "aws_s3_bucket" "imported_bucket" {
  bucket = "terraform-import-demo-${data.aws_caller_identity.current.account_id}"

  tags = {
    Name        = "Imported Bucket"
    ManagedBy   = "Terraform"
    ImportedAt  = timestamp()
  }
}

resource "aws_s3_bucket_versioning" "imported_bucket" {
  bucket = aws_s3_bucket.imported_bucket.id

  versioning_configuration {
    status = "Enabled"
  }
}

output "import_instructions" {
  description = "Instructions for importing existing resources"
  value = <<-EOT
    To import an existing S3 bucket:
    
    1. Create the resource configuration in main.tf (already done above)
    
    2. Import the bucket:
       terraform import aws_s3_bucket.imported_bucket <bucket-name>
    
    3. Import versioning configuration:
       terraform import aws_s3_bucket_versioning.imported_bucket <bucket-name>
    
    4. Verify with plan:
       terraform plan
       
    5. Adjust configuration if needed to match actual resource
    
    Example for other resources:
    - VPC: terraform import aws_vpc.main vpc-12345678
    - EC2: terraform import aws_instance.web i-12345678
    - Security Group: terraform import aws_security_group.web sg-12345678
  EOT
}

output "import_tips" {
  description = "Tips for successful imports"
  value = [
    "Always write the configuration before importing",
    "Use 'terraform show' to see imported resource attributes",
    "Run 'terraform plan' after import to verify no changes",
    "Import one resource at a time",
    "Consider using terraformer for bulk imports",
    "Document which resources were imported and when"
  ]
}
