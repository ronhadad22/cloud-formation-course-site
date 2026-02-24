#!/bin/bash
# Check DRS replication status for all source servers
# Usage: ./check-replication-status.sh
# Requires: export AWS_REGION=<target-region>

set -e

echo "============================================"
echo "🔍 DRS Replication Status Check"
echo "   Target Region: ${AWS_REGION:-not set}"
echo "   Time: $(date)"
echo "============================================"
echo ""

if [ -z "$AWS_REGION" ]; then
    echo "❌ AWS_REGION not set. Export it first:"
    echo "   export AWS_REGION=eu-west-1"
    exit 1
fi

# List all source servers
echo "📡 Source Servers:"
echo "-------------------------------------------"

SERVERS=$(aws drs describe-source-servers \
  --query 'items[].{ID:sourceServerID,Hostname:sourceProperties.identificationHints.hostname,State:dataReplicationInfo.dataReplicationState,Lag:dataReplicationInfo.lagDuration,IP:sourceProperties.networkInterfaces[0].ips[0]}' \
  --output json 2>/dev/null)

if [ "$SERVERS" == "[]" ] || [ -z "$SERVERS" ]; then
    echo "  No source servers found in $AWS_REGION"
    echo "  Make sure DRS is initialized and the agent is installed."
    exit 0
fi

echo "$SERVERS" | jq -r '.[] | "  Server: \(.Hostname // "unknown")\n  ID: \(.ID)\n  IP: \(.IP // "N/A")\n  Replication State: \(.State // "UNKNOWN")\n  Lag: \(.Lag // "N/A")\n  ---"'

echo ""
echo "============================================"

# Check if any server is ready for recovery
READY=$(echo "$SERVERS" | jq '[.[] | select(.State == "CONTINUOUS")] | length')
TOTAL=$(echo "$SERVERS" | jq 'length')

echo "📊 Summary: $READY/$TOTAL servers ready for failover"

if [ "$READY" -eq "$TOTAL" ] && [ "$TOTAL" -gt 0 ]; then
    echo "✅ All servers are in CONTINUOUS replication — ready for drill or failover!"
else
    echo "⚠️  Not all servers are ready. Wait for replication to complete."
fi
