variable "keycloak_url" {
  description = "Keycloak base URL (e.g. https://keycloak-tf.iitc-course.com)"
  type        = string
}

variable "keycloak_admin_user" {
  description = "Keycloak admin username"
  type        = string
  default     = "admin"
}

variable "keycloak_admin_password" {
  description = "Keycloak admin password"
  type        = string
  sensitive   = true
}

variable "app_url" {
  description = "HR Portal app URL (e.g. https://hr-portal-tf.iitc-course.com)"
  type        = string
}
