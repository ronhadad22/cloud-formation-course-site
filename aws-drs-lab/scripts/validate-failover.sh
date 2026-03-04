#!/bin/bash
# Validate that the DRS failover was successful
# Usage: ./validate-failover.sh <RECOVERY_INSTANCE_IP> [KEY_PATH]

set -e

RECOVERY_IP=${1:?"Usage: ./validate-failover.sh <RECOVERY_INSTANCE_IP> [KEY_PATH]"}
KEY_PATH=${2:-""}

echo "============================================"
echo "✅ DRS Failover Validation"
echo "   Recovery Instance: $RECOVERY_IP"
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

# Test 1: HTTP connectivity
echo "🌐 Test 1: Web Server Accessibility"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 http://$RECOVERY_IP 2>/dev/null || echo "000")
if [ "$HTTP_CODE" == "200" ]; then
    check "Web server responding (HTTP $HTTP_CODE)" "PASS"
else
    check "Web server responding (HTTP $HTTP_CODE)" "FAIL"
fi

# Test 2: Health API
echo ""
echo "🏥 Test 2: Health Check API"
HEALTH=$(curl -s --connect-timeout 10 http://$RECOVERY_IP/api/health 2>/dev/null || echo "{}")
HEALTH_STATUS=$(echo "$HEALTH" | jq -r '.status // "unknown"' 2>/dev/null || echo "unknown")
if [ "$HEALTH_STATUS" == "healthy" ]; then
    check "Health API returns healthy" "PASS"
else
    check "Health API returns healthy (got: $HEALTH_STATUS)" "FAIL"
fi

# Test 3: Transactions API
echo ""
echo "💳 Test 3: Transactions API"
TXN=$(curl -s --connect-timeout 10 http://$RECOVERY_IP/api/transactions 2>/dev/null || echo "{}")
TXN_STATUS=$(echo "$TXN" | jq -r '.status // "unknown"' 2>/dev/null || echo "unknown")
if [ "$TXN_STATUS" == "operational" ]; then
    check "Transactions API operational" "PASS"
else
    check "Transactions API operational (got: $TXN_STATUS)" "FAIL"
fi

# Test 4: SSH and data integrity (if key provided)
if [ -n "$KEY_PATH" ]; then
    echo ""
    echo "🔑 Test 4: SSH & Data Integrity"

    SSH_OPTS="-i $KEY_PATH -o StrictHostKeyChecking=no -o ConnectTimeout=10"

    # Check transaction data
    TXN_COUNT=$(ssh $SSH_OPTS ec2-user@$RECOVERY_IP "cat /opt/payflow/data/transactions.json 2>/dev/null | jq length" 2>/dev/null || echo "0")
    if [ "$TXN_COUNT" -ge 5 ]; then
        check "Transaction data intact ($TXN_COUNT records)" "PASS"
    else
        check "Transaction data intact (found $TXN_COUNT records, expected 5+)" "FAIL"
    fi

    # Check app config
    APP_VERSION=$(ssh $SSH_OPTS ec2-user@$RECOVERY_IP "cat /opt/payflow/config/app.json 2>/dev/null | jq -r '.version'" 2>/dev/null || echo "unknown")
    if [ "$APP_VERSION" != "unknown" ] && [ -n "$APP_VERSION" ]; then
        check "App config preserved (version: $APP_VERSION)" "PASS"
    else
        check "App config preserved" "FAIL"
    fi

    # Check logs
    LOG_LINES=$(ssh $SSH_OPTS ec2-user@$RECOVERY_IP "wc -l < /opt/payflow/logs/transactions.log 2>/dev/null" 2>/dev/null || echo "0")
    if [ "$LOG_LINES" -ge 50 ]; then
        check "Transaction logs preserved ($LOG_LINES lines)" "PASS"
    else
        check "Transaction logs preserved (found $LOG_LINES lines, expected 50+)" "FAIL"
    fi

    # Check setup marker
    SETUP=$(ssh $SSH_OPTS ec2-user@$RECOVERY_IP "cat /opt/payflow/setup-complete.txt 2>/dev/null" 2>/dev/null || echo "")
    if [ -n "$SETUP" ]; then
        check "Setup marker file exists" "PASS"
    else
        check "Setup marker file exists" "FAIL"
    fi
else
    echo ""
    echo "ℹ️  Skipping SSH tests (no key provided)"
    echo "   To run full validation: ./validate-failover.sh $RECOVERY_IP /path/to/key.pem"
fi

# Summary
echo ""
echo "============================================"
echo "📊 Validation Summary"
echo "   Passed: $PASS / $TOTAL"
echo "   Failed: $FAIL / $TOTAL"

SCORE=$((PASS * 100 / TOTAL))
echo "   Score:  ${SCORE}%"
echo ""

if [ "$FAIL" -eq 0 ]; then
    echo "🎉 PERFECT SCORE! Failover is fully validated."
else
    echo "⚠️  Some checks failed. Review the results above."
fi
echo "============================================"
