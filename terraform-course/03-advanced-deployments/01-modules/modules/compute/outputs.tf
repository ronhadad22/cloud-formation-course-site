output "instance_ids" {
  description = "IDs of created instances"
  value       = aws_instance.main[*].id
}

output "public_ips" {
  description = "Public IPs of instances"
  value       = aws_instance.main[*].public_ip
}

output "private_ips" {
  description = "Private IPs of instances"
  value       = aws_instance.main[*].private_ip
}

output "security_group_id" {
  description = "ID of the security group"
  value       = aws_security_group.instance.id
}
