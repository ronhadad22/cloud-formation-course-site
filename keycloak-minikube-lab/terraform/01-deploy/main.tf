terraform {
  required_version = ">= 1.5.0"

  required_providers {
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

variable "keycloak_node_port" {
  description = "NodePort for Keycloak service"
  type        = number
  default     = 30080
}

# ============================================================
# Provider — uses current kubectl context (keycloak-lab)
# ============================================================
provider "kubernetes" {
  config_path    = "~/.kube/config"
  config_context = "keycloak-lab"
}

# ============================================================
# Namespace
# ============================================================
resource "kubernetes_namespace" "keycloak" {
  metadata {
    name = "keycloak"
  }
}

# ============================================================
# PostgreSQL for Keycloak
# ============================================================
resource "kubernetes_deployment" "postgres" {
  metadata {
    name      = "keycloak-db"
    namespace = kubernetes_namespace.keycloak.metadata[0].name
    labels    = { app = "keycloak-db" }
  }

  spec {
    replicas = 1
    selector { match_labels = { app = "keycloak-db" } }

    template {
      metadata { labels = { app = "keycloak-db" } }

      spec {
        container {
          name              = "postgres"
          image             = "postgres:16-alpine"
          image_pull_policy = "Never"

          port { container_port = 5432 }

          env {
            name  = "POSTGRES_DB"
            value = "keycloak"
          }
          env {
            name  = "POSTGRES_USER"
            value = "keycloak"
          }
          env {
            name  = "POSTGRES_PASSWORD"
            value = "keycloak_db_pass"
          }

          resources {
            requests = { memory = "128Mi", cpu = "100m" }
            limits   = { memory = "256Mi", cpu = "500m" }
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "postgres" {
  metadata {
    name      = "keycloak-db"
    namespace = kubernetes_namespace.keycloak.metadata[0].name
  }

  spec {
    selector = { app = "keycloak-db" }
    port {
      port        = 5432
      target_port = 5432
    }
    type = "ClusterIP"
  }
}

# ============================================================
# Keycloak
# ============================================================
resource "kubernetes_deployment" "keycloak" {
  metadata {
    name      = "keycloak"
    namespace = kubernetes_namespace.keycloak.metadata[0].name
    labels    = { app = "keycloak" }
  }

  spec {
    replicas = 1
    selector { match_labels = { app = "keycloak" } }

    template {
      metadata { labels = { app = "keycloak" } }

      spec {
        container {
          name              = "keycloak"
          image             = "quay.io/keycloak/keycloak:26.0"
          image_pull_policy = "Never"

          args = ["start-dev"]

          port { container_port = 8080 }

          env {
            name  = "KC_DB"
            value = "postgres"
          }
          env {
            name  = "KC_DB_URL"
            value = "jdbc:postgresql://keycloak-db:5432/keycloak"
          }
          env {
            name  = "KC_DB_USERNAME"
            value = "keycloak"
          }
          env {
            name  = "KC_DB_PASSWORD"
            value = "keycloak_db_pass"
          }
          env {
            name  = "KC_BOOTSTRAP_ADMIN_USERNAME"
            value = var.keycloak_admin_user
          }
          env {
            name  = "KC_BOOTSTRAP_ADMIN_PASSWORD"
            value = var.keycloak_admin_password
          }
          env {
            name  = "KC_HTTP_ENABLED"
            value = "true"
          }
          env {
            name  = "KC_HOSTNAME_STRICT"
            value = "false"
          }
          env {
            name  = "KC_HEALTH_ENABLED"
            value = "true"
          }

          resources {
            requests = { memory = "512Mi", cpu = "250m" }
            limits   = { memory = "1Gi", cpu = "1000m" }
          }

          readiness_probe {
            http_get {
              path = "/realms/master"
              port = 8080
            }
            initial_delay_seconds = 60
            period_seconds        = 10
          }
        }
      }
    }
  }

  depends_on = [kubernetes_service.postgres]
}

resource "kubernetes_service" "keycloak" {
  metadata {
    name      = "keycloak"
    namespace = kubernetes_namespace.keycloak.metadata[0].name
  }

  spec {
    selector = { app = "keycloak" }
    port {
      port        = 8080
      target_port = 8080
      node_port   = var.keycloak_node_port
    }
    type = "NodePort"
  }
}

# ============================================================
# Outputs
# ============================================================
output "keycloak_node_port" {
  value = var.keycloak_node_port
}

output "keycloak_admin_url" {
  value = "Access via: minikube service keycloak -n keycloak -p keycloak-lab"
}
