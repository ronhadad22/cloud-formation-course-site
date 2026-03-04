#!/bin/bash
# Simulate a regional disaster by stopping the source server
# Usage: ./simulate-disaster.sh <SOURCE_INSTANCE_ID> <SOURCE_REGION>
# Requires: export AWS_REGION=<source-region>

set -e

INSTANCE_ID=${1:?"Usage: ./simulate-disaster.sh <SOURCE_INSTANCE_ID> <SOURCE_REGION>"}
SOURCE_REGION=${2:?"Usage: ./simulate-disaster.sh <SOURCE_INSTANCE_ID> <SOURCE_REGION>"}

echo "============================================"
echo "💥 DISASTER SIMULATION: Regional Outage"
echo "   Source Region: $SOURCE_REGION"
echo "   Instance: $INSTANCE_ID"
echo "   Time: $(date)"
echo "============================================"
echo ""

# Get current instance info
echo "📋 Current Instance Status:"
STATUS=$(aws ec2 describe-instances \
  --instance-ids $INSTANCE_ID \
  --region $SOURCE_REGION \
  --query 'Reservations[0].Instances[0].{State:State.Name,IP:PublicIpAddress,AZ:Placement.AvailabilityZone}' \
  --output json 2>&1)

echo "$STATUS" | jq -r '"  State: \(.State)\n  Public IP: \(.IP)\n  AZ: \(.AZ)"'
echo ""

# Verify the web app is running before disaster
PUBLIC_IP=$(echo "$STATUS" | jq -r '.IP')
echo "🌐 Testing web app before disaster..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 http://$PUBLIC_IP 2>/dev/null || echo "000")

if [ "$HTTP_CODE" == "200" ]; then
    echo "  ✅ Web app is responding (HTTP $HTTP_CODE)"
else
    echo "  ⚠️  Web app returned HTTP $HTTP_CODE"
fi
echo ""

# Simulate disaster: stop the instance
echo "💥 SIMULATING REGIONAL OUTAGE..."
echo "   Stopping instance $INSTANCE_ID in $SOURCE_REGION..."
aws ec2 stop-instances \
  --instance-ids $INSTANCE_ID \
  --region $SOURCE_REGION \
  --output json | jq -r '.StoppingInstances[0] | "  Previous State: \(.PreviousState.Name)\n  Current State: \(.CurrentState.Name)"'

echo ""
echo "⏳ Waiting for instance to stop..."
aws ec2 wait instance-stopped \
  --instance-ids $INSTANCE_ID \
  --region $SOURCE_REGION

echo "  ✅ Instance stopped."
echo ""

# Verify the web app is down
echo "🌐 Testing web app after disaster..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 http://$PUBLIC_IP 2>/dev/null || echo "000")
echo "  ❌ Web app is DOWN (HTTP $HTTP_CODE)"
echo ""

echo "============================================"
echo "🚨 DISASTER COMPLETE"
echo "   The PayFlow payment processing app is DOWN!"
echo "   Source region $SOURCE_REGION is unavailable."
echo ""
echo "   Your mission: Failover to the target region"
echo "   using AWS DRS recovery drill or failover."
echo "============================================"
echo ""
echo "📝 Next steps:"
echo "   1. Go to AWS DRS console in the TARGET region"
echo "   2. Select the source server"
echo "   3. Initiate a Recovery Drill or Failover"
echo "   4. Verify the app is running in the target region"
