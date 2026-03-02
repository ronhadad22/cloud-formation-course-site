#!/bin/bash
# Validate OpenZiti zero trust access to the private app server
# Usage: ./validate-ziti-access.sh
# Run this FROM the client instance after the tunneler is enrolled and running

set -e

echo "============================================"
echo "🔐 OpenZiti Zero Trust Access Validation"
echo "   Time: $(date)"
echo "============================================"
echo ""

PASS=0
FAIL=0
TOTAL=0

check() {
    TOTAL=$((TOTAL + 1))
    local name=$1
    local result=$2
    if [ "$result" == "PASS" ]; then
        PASS=$((PASS + 1))
        echo "  ✅ $name"
    else
        FAIL=$((FAIL + 1))
        echo "  ❌ $name"
    fi
}

# Test 1: Ziti tunneler running
echo "🔧 Test 1: Ziti Edge Tunnel Status"
if sudo systemctl is-active --quiet ziti-edge-tunnel 2>/dev/null; then
    check "Ziti Edge Tunnel is running" "PASS"
else
    check "Ziti Edge Tunnel is running" "FAIL"
fi

# Test 2: DNS resolution of securevault.ziti
echo ""
echo "🌐 Test 2: DNS Resolution"
RESOLVED_IP=$(getent hosts securevault.ziti 2>/dev/null | awk '{print $1}' || echo "")
if [ -n "$RESOLVED_IP" ]; then
    check "securevault.ziti resolves to $RESOLVED_IP" "PASS"
else
    check "securevault.ziti DNS resolution" "FAIL"
fi

# Test 3: HTTP access through overlay
echo ""
echo "🌍 Test 3: HTTP Access via Overlay"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 http://securevault.ziti 2>/dev/null || echo "000")
if [ "$HTTP_CODE" == "200" ]; then
    check "HTTP 200 from securevault.ziti" "PASS"
else
    check "HTTP response (got $HTTP_CODE, expected 200)" "FAIL"
fi

# Test 4: Health API
echo ""
echo "🏥 Test 4: Health API"
HEALTH=$(curl -s --connect-timeout 10 http://securevault.ziti/api/health 2>/dev/null || echo "{}")
HEALTH_STATUS=$(echo "$HEALTH" | jq -r '.status // "unknown"' 2>/dev/null || echo "unknown")
if [ "$HEALTH_STATUS" == "healthy" ]; then
    check "Health API returns healthy" "PASS"
else
    check "Health API (got: $HEALTH_STATUS)" "FAIL"
fi

ACCESS_METHOD=$(echo "$HEALTH" | jq -r '.access // "unknown"' 2>/dev/null || echo "unknown")
if [ "$ACCESS_METHOD" == "openziti-overlay" ]; then
    check "Access method is openziti-overlay" "PASS"
else
    check "Access method (got: $ACCESS_METHOD)" "FAIL"
fi

# Test 5: Secrets API
echo ""
echo "🔑 Test 5: Secrets API"
SECRETS=$(curl -s --connect-timeout 10 http://securevault.ziti/api/secrets 2>/dev/null || echo "{}")
SECRET_COUNT=$(echo "$SECRETS" | jq -r '.total // 0' 2>/dev/null || echo "0")
if [ "$SECRET_COUNT" -ge 3 ]; then
    check "Secrets API returns $SECRET_COUNT secrets" "PASS"
else
    check "Secrets API (got $SECRET_COUNT, expected 3+)" "FAIL"
fi

# Test 6: Direct access should FAIL
echo ""
echo "🚫 Test 6: Direct Access Blocked"
echo "   (Testing that the app server is NOT reachable directly)"

# Try to get the private IP from the health response
PRIVATE_IP=$(echo "$HEALTH" | jq -r '.private_ip // ""' 2>/dev/null || echo "")
if [ -n "$PRIVATE_IP" ]; then
    DIRECT_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 http://$PRIVATE_IP 2>/dev/null || echo "000")
    if [ "$DIRECT_CODE" == "000" ]; then
        check "Direct HTTP to $PRIVATE_IP is blocked (timeout)" "PASS"
    else
        check "Direct HTTP to $PRIVATE_IP should be blocked (got HTTP $DIRECT_CODE)" "FAIL"
    fi
else
    echo "  ⚠️  Could not determine private IP — skipping direct access test"
fi

# Summary
echo ""
echo "============================================"
echo "📊 Validation Summary"
echo "   Passed: $PASS / $TOTAL"
echo "   Failed: $FAIL / $TOTAL"

if [ "$TOTAL" -gt 0 ]; then
    SCORE=$((PASS * 100 / TOTAL))
    echo "   Score:  ${SCORE}%"
fi
echo ""

if [ "$FAIL" -eq 0 ]; then
    echo "🎉 PERFECT! Zero trust access is fully working."
else
    echo "⚠️  Some checks failed. Review the results above."
fi
echo "============================================"
