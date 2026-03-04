# ============================================================
# Outputs
# ============================================================
output "realm_name" {
  description = "Keycloak realm name"
  value       = keycloak_realm.demo.realm
}

output "client_id" {
  description = "OIDC client ID"
  value       = keycloak_openid_client.hr_portal.client_id
}

output "client_secret" {
  description = "OIDC client secret (use this in the app .env)"
  value       = keycloak_openid_client.hr_portal.client_secret
  sensitive   = true
}

output "users" {
  description = "Created users and their roles"
  value = {
    alice = "employee"
    bob   = "employee, manager"
    carol = "employee, manager, admin"
  }
}

output "app_env_config" {
  description = "The .env configuration for the HR Portal app"
  sensitive   = true
  value       = <<-EOT
    KEYCLOAK_URL=${var.keycloak_url}
    KEYCLOAK_REALM=${keycloak_realm.demo.realm}
    KEYCLOAK_CLIENT_ID=${keycloak_openid_client.hr_portal.client_id}
    KEYCLOAK_CLIENT_SECRET=${keycloak_openid_client.hr_portal.client_secret}
    APP_URL=${var.app_url}
  EOT
}
