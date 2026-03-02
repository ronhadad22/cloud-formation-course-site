terraform {
  required_version = ">= 1.5.0"

  required_providers {
    keycloak = {
      source  = "mrparkers/keycloak"
      version = "~> 4.4"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.25"
    }
  }
}

# ============================================================
# Variables
# ============================================================
variable "keycloak_admin_user" {
  description = "Keycloak admin username"
  type        = string
  default     = "admin"
}

variable "keycloak_admin_password" {
  description = "Keycloak admin password"
  type        = string
  default     = "KeycloakLab2024!"
  sensitive   = true
}

variable "keycloak_url" {
  description = "Keycloak URL (from minikube service)"
  type        = string
}

variable "app_node_port" {
  description = "NodePort for the HR Portal app"
  type        = number
  default     = 30300
}

# ============================================================
# Providers
# ============================================================
provider "keycloak" {
  client_id = "admin-cli"
  username  = var.keycloak_admin_user
  password  = var.keycloak_admin_password
  url       = var.keycloak_url
}

provider "kubernetes" {
  config_path    = "~/.kube/config"
  config_context = "keycloak-lab"
}

# ============================================================
# Keycloak Realm
# ============================================================
resource "keycloak_realm" "demo" {
  realm   = "demo-realm"
  enabled = true

  display_name = "TechCorp Demo Realm"
  login_theme  = "keycloak"

  access_token_lifespan    = "5m"
  sso_session_idle_timeout = "30m"
  sso_session_max_lifespan = "10h"
}

# ============================================================
# Realm Roles
# ============================================================
resource "keycloak_role" "employee" {
  realm_id    = keycloak_realm.demo.id
  name        = "employee"
  description = "Basic employee access — can view dashboard"
}

resource "keycloak_role" "manager" {
  realm_id    = keycloak_realm.demo.id
  name        = "manager"
  description = "Manager access — can view salary data"
}

resource "keycloak_role" "admin" {
  realm_id    = keycloak_realm.demo.id
  name        = "admin"
  description = "Admin access — can view system admin panel"
}

# ============================================================
# Users
# ============================================================
resource "keycloak_user" "alice" {
  realm_id       = keycloak_realm.demo.id
  username       = "alice"
  enabled        = true
  email          = "alice@techcorp.com"
  email_verified = true
  first_name     = "Alice"
  last_name      = "Johnson"

  initial_password {
    value     = "alice123"
    temporary = false
  }
}

resource "keycloak_user" "bob" {
  realm_id       = keycloak_realm.demo.id
  username       = "bob"
  enabled        = true
  email          = "bob@techcorp.com"
  email_verified = true
  first_name     = "Bob"
  last_name      = "Smith"

  initial_password {
    value     = "bob123"
    temporary = false
  }
}

resource "keycloak_user" "carol" {
  realm_id       = keycloak_realm.demo.id
  username       = "carol"
  enabled        = true
  email          = "carol@techcorp.com"
  email_verified = true
  first_name     = "Carol"
  last_name      = "Williams"

  initial_password {
    value     = "carol123"
    temporary = false
  }
}

# ============================================================
# Role Assignments
# ============================================================
resource "keycloak_user_roles" "alice_roles" {
  realm_id = keycloak_realm.demo.id
  user_id  = keycloak_user.alice.id
  role_ids = [keycloak_role.employee.id]
}

resource "keycloak_user_roles" "bob_roles" {
  realm_id = keycloak_realm.demo.id
  user_id  = keycloak_user.bob.id
  role_ids = [keycloak_role.employee.id, keycloak_role.manager.id]
}

resource "keycloak_user_roles" "carol_roles" {
  realm_id = keycloak_realm.demo.id
  user_id  = keycloak_user.carol.id
  role_ids = [keycloak_role.employee.id, keycloak_role.manager.id, keycloak_role.admin.id]
}

# ============================================================
# OIDC Client (HR Portal)
# ============================================================
resource "keycloak_openid_client" "hr_portal" {
  realm_id  = keycloak_realm.demo.id
  client_id = "demo-app"
  name      = "HR Portal"
  enabled   = true

  access_type                  = "CONFIDENTIAL"
  standard_flow_enabled        = true
  direct_access_grants_enabled = true

  root_url                        = "http://localhost:${var.app_node_port}"
  valid_redirect_uris             = ["http://localhost:${var.app_node_port}/*"]
  valid_post_logout_redirect_uris = ["http://localhost:${var.app_node_port}/*"]
  web_origins                     = ["http://localhost:${var.app_node_port}"]
}

resource "keycloak_openid_user_realm_role_protocol_mapper" "realm_roles" {
  realm_id  = keycloak_realm.demo.id
  client_id = keycloak_openid_client.hr_portal.id
  name      = "realm-roles"

  claim_name          = "realm_access.roles"
  multivalued         = true
  add_to_id_token     = true
  add_to_access_token = true
  add_to_userinfo     = true
}

# ============================================================
# HR Portal Namespace
# ============================================================
resource "kubernetes_namespace" "app" {
  metadata {
    name = "hr-portal"
  }
}

# ============================================================
# HR Portal App
# ============================================================
resource "kubernetes_config_map" "hr_portal_env" {
  metadata {
    name      = "hr-portal-config"
    namespace = kubernetes_namespace.app.metadata[0].name
  }

  data = {
    KEYCLOAK_URL           = var.keycloak_url
    KEYCLOAK_REALM         = keycloak_realm.demo.realm
    KEYCLOAK_CLIENT_ID     = keycloak_openid_client.hr_portal.client_id
    KEYCLOAK_CLIENT_SECRET = keycloak_openid_client.hr_portal.client_secret
    APP_URL                = "http://localhost:${var.app_node_port}"
  }
}

resource "kubernetes_config_map" "hr_portal_code" {
  metadata {
    name      = "hr-portal-code"
    namespace = kubernetes_namespace.app.metadata[0].name
  }

  data = {
    "server.js"    = file("${path.module}/../app/server.js")
    "package.json" = jsonencode({
      name         = "keycloak-demo-app"
      version      = "1.0.0"
      main         = "server.js"
      scripts      = { start = "node server.js" }
      dependencies = {
        express                  = "^4.18.2"
        "express-session"        = "^1.17.3"
        passport                 = "^0.7.0"
        "passport-openidconnect" = "^0.1.2"
        dotenv                   = "^16.3.1"
      }
    })
  }
}

resource "kubernetes_deployment" "hr_portal" {
  metadata {
    name      = "hr-portal"
    namespace = kubernetes_namespace.app.metadata[0].name
    labels    = { app = "hr-portal" }
  }

  spec {
    replicas = 1
    selector { match_labels = { app = "hr-portal" } }

    template {
      metadata { labels = { app = "hr-portal" } }

      spec {
        init_container {
          name              = "install-deps"
          image             = "node:20-alpine"
          image_pull_policy = "Never"
          command           = ["sh", "-c", "cp /code/* /app/ && cd /app && npm install"]

          volume_mount {
            name       = "code"
            mount_path = "/code"
          }
          volume_mount {
            name       = "app"
            mount_path = "/app"
          }
        }

        container {
          name              = "hr-portal"
          image             = "node:20-alpine"
          image_pull_policy = "Never"
          command           = ["node", "/app/server.js"]

          port { container_port = 3000 }

          env_from {
            config_map_ref {
              name = kubernetes_config_map.hr_portal_env.metadata[0].name
            }
          }

          volume_mount {
            name       = "app"
            mount_path = "/app"
          }

          resources {
            requests = { memory = "128Mi", cpu = "100m" }
            limits   = { memory = "256Mi", cpu = "500m" }
          }
        }

        volume {
          name = "code"
          config_map {
            name = kubernetes_config_map.hr_portal_code.metadata[0].name
          }
        }

        volume {
          name = "app"
          empty_dir {}
        }
      }
    }
  }

  depends_on = [kubernetes_config_map.hr_portal_env, kubernetes_config_map.hr_portal_code]
}

resource "kubernetes_service" "hr_portal" {
  metadata {
    name      = "hr-portal"
    namespace = kubernetes_namespace.app.metadata[0].name
  }

  spec {
    selector = { app = "hr-portal" }
    port {
      port        = 3000
      target_port = 3000
      node_port   = var.app_node_port
    }
    type = "NodePort"
  }
}

# ============================================================
# Outputs
# ============================================================
output "hr_portal_url" {
  value = "Access via: minikube service hr-portal -n hr-portal -p keycloak-lab"
}

output "client_secret" {
  value     = keycloak_openid_client.hr_portal.client_secret
  sensitive = true
}
