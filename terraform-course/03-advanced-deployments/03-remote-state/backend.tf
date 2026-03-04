terraform {
  backend "s3" {
    bucket         = "int-course-terraform-bucket-class"
    key            = "advanced-deployments/terraform.tfstate"
    region         = "us-east-2"
    encrypt        = true
  }
}
