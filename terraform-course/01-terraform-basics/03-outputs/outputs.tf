output "bucket_id" {
  description = "The name of the bucket"
  value       = aws_s3_bucket.outputs_demo.id
}

output "bucket_arn" {
  description = "The ARN of the bucket"
  value       = aws_s3_bucket.outputs_demo.arn
}

output "bucket_region" {
  description = "The AWS region this bucket resides in"
  value       = aws_s3_bucket.outputs_demo.region
}

output "bucket_domain_name" {
  description = "The bucket domain name"
  value       = aws_s3_bucket.outputs_demo.bucket_domain_name
}

output "bucket_regional_domain_name" {
  description = "The bucket region-specific domain name"
  value       = aws_s3_bucket.outputs_demo.bucket_regional_domain_name
}

output "versioning_enabled" {
  description = "Whether versioning is enabled"
  value       = aws_s3_bucket_versioning.outputs_demo.versioning_configuration[0].status == "Enabled"
}

output "account_id" {
  description = "AWS Account ID"
  value       = data.aws_caller_identity.current.account_id
}

output "bucket_details" {
  description = "Complete bucket information"
  value = {
    name   = aws_s3_bucket.outputs_demo.id
    arn    = aws_s3_bucket.outputs_demo.arn
    region = aws_s3_bucket.outputs_demo.region
  }
}

output "all_bucket_attributes" {
  description = "All bucket attributes (for debugging)"
  value       = aws_s3_bucket.outputs_demo
  sensitive   = false
}
