#!/bin/bash
# ============================================================
# Keycloak + Terraform Lab — Validation Script
# ============================================================

KEYCLOAK_URL="${KEYCLOAK_URL:-https://keycloak-tf.iitc-course.com}"
APP_URL="${APP_URL:-https://hr-portal-tf.iitc-course.com}"
REALM="demo-realm"
CLIENT_ID="demo-app"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0
TOTAL=0

check() {
  TOTAL=$((TOTAL + 1))
  local desc="$1"
  local result="$2"
  if [ "$result" = "true" ]; then
    echo -e "  ${GREEN}✓${NC} $desc"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} $desc"
    FAIL=$((FAIL + 1))
  fi
}

echo "=============================================="
echo "  Keycloak + Terraform Lab Validation"
echo "=============================================="
echo ""

# ----------------------------------------------------------
# 1. Keycloak Health
# ----------------------------------------------------------
echo -e "${YELLOW}[1] Keycloak Health${NC}"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 "$KEYCLOAK_URL/realms/master")
check "Keycloak master realm reachable (HTTP $HTTP)" "$([ "$HTTP" = "200" ] && echo true || echo false)"

HTTP=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 "$KEYCLOAK_URL/admin/")
check "Keycloak admin console reachable (HTTP $HTTP)" "$([ "$HTTP" = "200" ] || [ "$HTTP" = "302" ] && echo true || echo false)"
echo ""

# ----------------------------------------------------------
# 2. Terraform-created Realm
# ----------------------------------------------------------
echo -e "${YELLOW}[2] Demo Realm${NC}"
REALM_RESP=$(curl -s --connect-timeout 10 "$KEYCLOAK_URL/realms/$REALM")
REALM_NAME=$(echo "$REALM_RESP" | jq -r '.realm // empty' 2>/dev/null)
check "Realm '$REALM' exists" "$([ "$REALM_NAME" = "$REALM" ] && echo true || echo false)"
echo ""

# ----------------------------------------------------------
# 3. OIDC Discovery
# ----------------------------------------------------------
echo -e "${YELLOW}[3] OIDC Discovery${NC}"
DISCOVERY=$(curl -s --connect-timeout 10 "$KEYCLOAK_URL/realms/$REALM/.well-known/openid-configuration")
ISSUER=$(echo "$DISCOVERY" | jq -r '.issuer // empty' 2>/dev/null)
check "OIDC discovery endpoint works" "$([ -n "$ISSUER" ] && echo true || echo false)"
AUTH_EP=$(echo "$DISCOVERY" | jq -r '.authorization_endpoint // empty' 2>/dev/null)
check "Authorization endpoint present" "$([ -n "$AUTH_EP" ] && echo true || echo false)"
TOKEN_EP=$(echo "$DISCOVERY" | jq -r '.token_endpoint // empty' 2>/dev/null)
check "Token endpoint present" "$([ -n "$TOKEN_EP" ] && echo true || echo false)"
echo ""

# ----------------------------------------------------------
# 4. Token Grant (Resource Owner Password)
# ----------------------------------------------------------
echo -e "${YELLOW}[4] Token Grant — User Authentication${NC}"

# Get client secret from Terraform output (if available)
TF_DIR="$(dirname "$0")/../terraform"
if [ -f "$TF_DIR/terraform.tfstate" ]; then
  CLIENT_SECRET=$(cd "$TF_DIR" && terraform output -raw client_secret 2>/dev/null)
fi

if [ -z "$CLIENT_SECRET" ]; then
  echo -e "  ${YELLOW}⚠${NC} Client secret not available — skipping token tests"
  echo "    Set CLIENT_SECRET env var or run from project root after terraform apply"
else
  # Test alice (employee)
  TOKEN_RESP=$(curl -s -X POST "$TOKEN_EP" \
    -d "grant_type=password" \
    -d "client_id=$CLIENT_ID" \
    -d "client_secret=$CLIENT_SECRET" \
    -d "username=alice" \
    -d "password=alice123" \
    -d "scope=openid")
  ACCESS_TOKEN=$(echo "$TOKEN_RESP" | jq -r '.access_token // empty' 2>/dev/null)
  check "Alice can authenticate" "$([ -n "$ACCESS_TOKEN" ] && echo true || echo false)"

  if [ -n "$ACCESS_TOKEN" ]; then
    # Decode JWT payload (add padding)
    PAYLOAD=$(echo "$ACCESS_TOKEN" | cut -d'.' -f2)
    PADDED="$PAYLOAD"
    MOD=$((${#PADDED} % 4))
    if [ $MOD -eq 2 ]; then PADDED="${PADDED}=="; elif [ $MOD -eq 3 ]; then PADDED="${PADDED}="; fi
    DECODED=$(echo "$PADDED" | base64 -d 2>/dev/null || echo "$PADDED" | base64 -D 2>/dev/null)
    ROLES=$(echo "$DECODED" | jq -r '.realm_access.roles // [] | join(",")' 2>/dev/null)
    check "Alice has 'employee' role in token" "$(echo "$ROLES" | grep -q 'employee' && echo true || echo false)"
  fi

  # Test bob (employee + manager)
  TOKEN_RESP=$(curl -s -X POST "$TOKEN_EP" \
    -d "grant_type=password" \
    -d "client_id=$CLIENT_ID" \
    -d "client_secret=$CLIENT_SECRET" \
    -d "username=bob" \
    -d "password=bob123" \
    -d "scope=openid")
  ACCESS_TOKEN=$(echo "$TOKEN_RESP" | jq -r '.access_token // empty' 2>/dev/null)
  check "Bob can authenticate" "$([ -n "$ACCESS_TOKEN" ] && echo true || echo false)"

  if [ -n "$ACCESS_TOKEN" ]; then
    PAYLOAD=$(echo "$ACCESS_TOKEN" | cut -d'.' -f2)
    PADDED="$PAYLOAD"
    MOD=$((${#PADDED} % 4))
    if [ $MOD -eq 2 ]; then PADDED="${PADDED}=="; elif [ $MOD -eq 3 ]; then PADDED="${PADDED}="; fi
    DECODED=$(echo "$PADDED" | base64 -d 2>/dev/null || echo "$PADDED" | base64 -D 2>/dev/null)
    ROLES=$(echo "$DECODED" | jq -r '.realm_access.roles // [] | join(",")' 2>/dev/null)
    check "Bob has 'manager' role in token" "$(echo "$ROLES" | grep -q 'manager' && echo true || echo false)"
  fi

  # Test carol (employee + manager + admin)
  TOKEN_RESP=$(curl -s -X POST "$TOKEN_EP" \
    -d "grant_type=password" \
    -d "client_id=$CLIENT_ID" \
    -d "client_secret=$CLIENT_SECRET" \
    -d "username=carol" \
    -d "password=carol123" \
    -d "scope=openid")
  ACCESS_TOKEN=$(echo "$TOKEN_RESP" | jq -r '.access_token // empty' 2>/dev/null)
  check "Carol can authenticate" "$([ -n "$ACCESS_TOKEN" ] && echo true || echo false)"

  if [ -n "$ACCESS_TOKEN" ]; then
    PAYLOAD=$(echo "$ACCESS_TOKEN" | cut -d'.' -f2)
    PADDED="$PAYLOAD"
    MOD=$((${#PADDED} % 4))
    if [ $MOD -eq 2 ]; then PADDED="${PADDED}=="; elif [ $MOD -eq 3 ]; then PADDED="${PADDED}="; fi
    DECODED=$(echo "$PADDED" | base64 -d 2>/dev/null || echo "$PADDED" | base64 -D 2>/dev/null)
    ROLES=$(echo "$DECODED" | jq -r '.realm_access.roles // [] | join(",")' 2>/dev/null)
    check "Carol has 'admin' role in token" "$(echo "$ROLES" | grep -q 'admin' && echo true || echo false)"
  fi
fi
echo ""

# ----------------------------------------------------------
# 5. HR Portal App
# ----------------------------------------------------------
echo -e "${YELLOW}[5] HR Portal App${NC}"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 "$APP_URL")
check "HR Portal home page reachable (HTTP $HTTP)" "$([ "$HTTP" = "200" ] && echo true || echo false)"

HTTP=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 "$APP_URL/login")
check "Login redirects to Keycloak (HTTP $HTTP)" "$([ "$HTTP" = "302" ] && echo true || echo false)"
echo ""

# ----------------------------------------------------------
# Summary
# ----------------------------------------------------------
echo "=============================================="
echo -e "  Results: ${GREEN}$PASS passed${NC}, ${RED}$FAIL failed${NC}, $TOTAL total"
echo "=============================================="

if [ $FAIL -gt 0 ]; then
  exit 1
fi
