# ============================================================
# Realm
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

  root_url                        = var.app_url
  valid_redirect_uris             = ["${var.app_url}/*"]
  valid_post_logout_redirect_uris = ["${var.app_url}/*"]
  web_origins                     = [var.app_url]
}

# Protocol mapper: include realm roles in token
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
