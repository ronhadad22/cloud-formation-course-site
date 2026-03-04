#!/bin/bash
# ============================================================
# Keycloak Lab Validation Script
# Tests Keycloak deployment, OIDC endpoints, and RBAC
# ============================================================

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0

check() {
  local desc="$1"
  local result="$2"
  if [ "$result" = "0" ]; then
    echo -e "  ${GREEN}✅ PASS${NC} — $desc"
    ((PASS++))
  else
    echo -e "  ${RED}❌ FAIL${NC} — $desc"
    ((FAIL++))
  fi
}

echo "============================================"
echo "  Keycloak Lab Validation"
echo "============================================"
echo ""

KEYCLOAK_URL="${KEYCLOAK_URL:-https://keycloak.iitc-course.com}"
APP_URL="${APP_URL:-https://hr-portal.iitc-course.com}"
CLIENT_SECRET="${CLIENT_SECRET:-}"
REALM="demo-realm"
CLIENT_ID="demo-app"

echo "Keycloak: $KEYCLOAK_URL"
echo "App:      $APP_URL"
echo ""

# ---- Test 1: Keycloak is reachable ----
echo "1. Keycloak Server (HTTPS)"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 "$KEYCLOAK_URL/" 2>/dev/null || echo "000")
check "Keycloak is reachable via HTTPS" "$([ "$HTTP_CODE" != "000" ] && echo 0 || echo 1)"

# ---- Test 2: Admin console ----
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 "$KEYCLOAK_URL/admin/" 2>/dev/null || echo "000")
check "Admin console is accessible" "$([ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "302" ] && echo 0 || echo 1)"

# ---- Test 3: OIDC Discovery ----
echo ""
echo "2. OIDC Endpoints"
DISCOVERY=$(curl -s --connect-timeout 10 "$KEYCLOAK_URL/realms/$REALM/.well-known/openid-configuration" 2>/dev/null)
HAS_ISSUER=$(echo "$DISCOVERY" | grep -c "issuer" 2>/dev/null || echo "0")
check "OIDC discovery endpoint for '$REALM'" "$([ "$HAS_ISSUER" -gt 0 ] && echo 0 || echo 1)"

AUTH_ENDPOINT=$(echo "$DISCOVERY" | jq -r '.authorization_endpoint // empty' 2>/dev/null)
check "Authorization endpoint exists" "$([ -n "$AUTH_ENDPOINT" ] && echo 0 || echo 1)"

TOKEN_ENDPOINT=$(echo "$DISCOVERY" | jq -r '.token_endpoint // empty' 2>/dev/null)
check "Token endpoint exists" "$([ -n "$TOKEN_ENDPOINT" ] && echo 0 || echo 1)"

JWKS_URI=$(echo "$DISCOVERY" | jq -r '.jwks_uri // empty' 2>/dev/null)
check "JWKS URI exists" "$([ -n "$JWKS_URI" ] && echo 0 || echo 1)"

# ---- Test 4: Token acquisition ----
echo ""
echo "3. Authentication (requires CLIENT_SECRET)"
if [ -n "$CLIENT_SECRET" ]; then
  # Test Alice (employee)
  ALICE_TOKEN=$(curl -s -X POST "$KEYCLOAK_URL/realms/$REALM/protocol/openid-connect/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "grant_type=password&client_id=$CLIENT_ID&client_secret=$CLIENT_SECRET&username=alice&password=alice123" 2>/dev/null)
  ALICE_ACCESS=$(echo "$ALICE_TOKEN" | jq -r '.access_token // empty' 2>/dev/null)
  check "Alice can authenticate" "$([ -n "$ALICE_ACCESS" ] && echo 0 || echo 1)"

  # Test Bob (manager)
  BOB_TOKEN=$(curl -s -X POST "$KEYCLOAK_URL/realms/$REALM/protocol/openid-connect/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "grant_type=password&client_id=$CLIENT_ID&client_secret=$CLIENT_SECRET&username=bob&password=bob123" 2>/dev/null)
  BOB_ACCESS=$(echo "$BOB_TOKEN" | jq -r '.access_token // empty' 2>/dev/null)
  check "Bob can authenticate" "$([ -n "$BOB_ACCESS" ] && echo 0 || echo 1)"

  # Test Carol (admin)
  CAROL_TOKEN=$(curl -s -X POST "$KEYCLOAK_URL/realms/$REALM/protocol/openid-connect/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "grant_type=password&client_id=$CLIENT_ID&client_secret=$CLIENT_SECRET&username=carol&password=carol123" 2>/dev/null)
  CAROL_ACCESS=$(echo "$CAROL_TOKEN" | jq -r '.access_token // empty' 2>/dev/null)
  check "Carol can authenticate" "$([ -n "$CAROL_ACCESS" ] && echo 0 || echo 1)"

  # Helper: decode JWT payload with proper base64 padding
  decode_jwt() {
    local payload=$(echo "$1" | cut -d'.' -f2 | tr '_-' '/+')
    local pad=$((4 - ${#payload} % 4))
    [ "$pad" -lt 4 ] && payload="${payload}$(printf '%0.s=' $(seq 1 $pad))"
    echo "$payload" | base64 -d 2>/dev/null
  }

  # Check roles in tokens
  if [ -n "$ALICE_ACCESS" ]; then
    ALICE_ROLES=$(decode_jwt "$ALICE_ACCESS" | jq -r '.realm_access.roles // [] | join(",")' 2>/dev/null)
    check "Alice has 'employee' role" "$(echo "$ALICE_ROLES" | grep -c 'employee' > /dev/null && echo 0 || echo 1)"
  fi

  if [ -n "$BOB_ACCESS" ]; then
    BOB_ROLES=$(decode_jwt "$BOB_ACCESS" | jq -r '.realm_access.roles // [] | join(",")' 2>/dev/null)
    check "Bob has 'manager' role" "$(echo "$BOB_ROLES" | grep -c 'manager' > /dev/null && echo 0 || echo 1)"
  fi

  if [ -n "$CAROL_ACCESS" ]; then
    CAROL_ROLES=$(decode_jwt "$CAROL_ACCESS" | jq -r '.realm_access.roles // [] | join(",")' 2>/dev/null)
    check "Carol has 'admin' role" "$(echo "$CAROL_ROLES" | grep -c 'admin' > /dev/null && echo 0 || echo 1)"
  fi
else
  echo -e "  ${YELLOW}⏭️  SKIPPED${NC} — Set CLIENT_SECRET to test authentication"
fi

# ---- Test 5: App Server ----
echo ""
echo "4. HR Portal Application (HTTPS)"
APP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 "$APP_URL/" 2>/dev/null || echo "000")
check "HR Portal is reachable via HTTPS" "$([ "$APP_CODE" = "200" ] && echo 0 || echo 1)"

APP_CONTENT=$(curl -s --connect-timeout 10 "$APP_URL/" 2>/dev/null)
check "HR Portal shows login button" "$(echo "$APP_CONTENT" | grep -c 'Sign In' > /dev/null && echo 0 || echo 1)"

# Check protected routes redirect
DASH_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 "$APP_URL/dashboard" 2>/dev/null || echo "000")
check "Dashboard redirects unauthenticated users (302)" "$([ "$DASH_CODE" = "302" ] && echo 0 || echo 1)"

# ---- Summary ----
echo ""
echo "============================================"
TOTAL=$((PASS + FAIL))
echo -e "  Results: ${GREEN}$PASS passed${NC}, ${RED}$FAIL failed${NC} (out of $TOTAL)"
if [ "$FAIL" -eq 0 ]; then
  echo -e "  ${GREEN}🎉 All checks passed!${NC}"
else
  echo -e "  ${YELLOW}⚠️  Some checks failed. Review the output above.${NC}"
fi
echo "============================================"
