output "instance_ids" {
  description = "IDs of the EC2 instances"
  value       = aws_instance.main[*].id
}

output "instance_private_ips" {
  description = "Private IP addresses of instances"
  value       = aws_instance.main[*].private_ip
}

output "instance_public_ips" {
  description = "Public IP addresses of instances (if assigned)"
  value       = aws_eip.instance[*].public_ip
}

output "security_group_id" {
  description = "ID of the security group"
  value       = aws_security_group.instance.id
}

output "instance_details" {
  description = "Detailed information about instances"
  value = [
    for idx, instance in aws_instance.main : {
      id         = instance.id
      private_ip = instance.private_ip
      public_ip  = try(aws_eip.instance[idx].public_ip, "")
      az         = instance.availability_zone
    }
  ]
}
