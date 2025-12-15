terraform {
  backend "s3" {
    bucket         = "terraform-remote-state-demo"
    key            = "advanced-deployments/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-state-locks"
  }
}
