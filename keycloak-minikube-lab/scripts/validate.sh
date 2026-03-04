#!/bin/bash
# ============================================================
# Keycloak Minikube Lab Validation Script
# ============================================================

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

KEYCLOAK_URL="${KEYCLOAK_URL:-http://localhost:30080}"
APP_URL="${APP_URL:-http://localhost:30300}"
REALM="demo-realm"
CLIENT_ID="demo-app"

# Get client secret from Terraform output if not set
if [ -z "$CLIENT_SECRET" ]; then
  CLIENT_SECRET=$(cd "$(dirname "$0")/../terraform" && terraform output -raw client_secret 2>/dev/null)
fi

echo "============================================"
echo "  Keycloak Minikube Lab Validation"
echo "============================================"
echo ""
echo "Keycloak: $KEYCLOAK_URL"
echo "App:      $APP_URL"
echo ""

# ---- Test 1: Minikube cluster ----
echo "1. Minikube Cluster"
CLUSTER_STATUS=$(minikube status -p keycloak-lab --format='{{.Host}}' 2>/dev/null)
check "Minikube cluster is running" "$([ "$CLUSTER_STATUS" = "Running" ] && echo 0 || echo 1)"

KC_PODS=$(kubectl get pods -n keycloak --no-headers 2>/dev/null | grep -c "Running")
check "Keycloak pods are running" "$([ "$KC_PODS" -ge 1 ] && echo 0 || echo 1)"

APP_PODS=$(kubectl get pods -n hr-portal --no-headers 2>/dev/null | grep -c "Running")
check "HR Portal pods are running" "$([ "$APP_PODS" -ge 1 ] && echo 0 || echo 1)"

# ---- Test 2: Keycloak reachable ----
echo ""
echo "2. Keycloak Server"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 "$KEYCLOAK_URL/" 2>/dev/null || echo "000")
check "Keycloak is reachable" "$([ "$HTTP_CODE" != "000" ] && echo 0 || echo 1)"

# ---- Test 3: OIDC Discovery ----
echo ""
echo "3. OIDC Endpoints"
DISCOVERY=$(curl -s --connect-timeout 10 "$KEYCLOAK_URL/realms/$REALM/.well-known/openid-configuration" 2>/dev/null)
HAS_ISSUER=$(echo "$DISCOVERY" | grep -c "issuer" 2>/dev/null || echo "0")
check "OIDC discovery endpoint" "$([ "$HAS_ISSUER" -gt 0 ] && echo 0 || echo 1)"

# ---- Test 4: Authentication ----
echo ""
echo "4. Authentication"
if [ -n "$CLIENT_SECRET" ]; then
  decode_jwt() {
    local payload=$(echo "$1" | cut -d'.' -f2 | tr '_-' '/+')
    local pad=$((4 - ${#payload} % 4))
    [ "$pad" -lt 4 ] && payload="${payload}$(printf '%0.s=' $(seq 1 $pad))"
    echo "$payload" | base64 -d 2>/dev/null
  }

  for USERINFO in "alice:alice123:employee" "bob:bob123:manager" "carol:carol123:admin"; do
    NAME=${USERINFO%%:*}
    REST=${USERINFO#*:}
    PASS_VAL=${REST%%:*}
    ROLE=${REST##*:}

    TOKEN_RESP=$(curl -s -X POST "$KEYCLOAK_URL/realms/$REALM/protocol/openid-connect/token" \
      -H "Content-Type: application/x-www-form-urlencoded" \
      -d "grant_type=password&client_id=$CLIENT_ID&client_secret=$CLIENT_SECRET&username=$NAME&password=$PASS_VAL" 2>/dev/null)
    ACCESS=$(echo "$TOKEN_RESP" | jq -r '.access_token // empty' 2>/dev/null)
    check "$NAME can authenticate" "$([ -n "$ACCESS" ] && echo 0 || echo 1)"

    if [ -n "$ACCESS" ]; then
      ROLES=$(decode_jwt "$ACCESS" | jq -r '.realm_access.roles // [] | join(",")' 2>/dev/null)
      check "$NAME has '$ROLE' role" "$(echo "$ROLES" | grep -q "$ROLE" && echo 0 || echo 1)"
    fi
  done
else
  echo -e "  ${YELLOW}⏭️  SKIPPED${NC} — CLIENT_SECRET not available"
fi

# ---- Test 5: App Server ----
echo ""
echo "5. HR Portal Application"
APP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 "$APP_URL/" 2>/dev/null || echo "000")
check "HR Portal is reachable" "$([ "$APP_CODE" = "200" ] && echo 0 || echo 1)"

APP_CONTENT=$(curl -s --connect-timeout 10 "$APP_URL/" 2>/dev/null)
check "HR Portal shows login button" "$(echo "$APP_CONTENT" | grep -q 'Sign In' && echo 0 || echo 1)"

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
