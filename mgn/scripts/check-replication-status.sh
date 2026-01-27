#!/bin/bash

# Check MGN Replication Status
# This script monitors the replication status of source servers in AWS MGN

set -e

# Configuration
REGION="${AWS_REGION:-us-east-1}"
PROFILE="${AWS_PROFILE:-default}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}AWS MGN Replication Status Monitor${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Region: $REGION"
echo "Profile: $PROFILE"
echo ""

# Check if MGN is initialized
echo "Checking MGN service status..."
if ! aws mgn describe-replication-configuration-templates --region $REGION --profile $PROFILE &>/dev/null; then
    echo -e "${RED}ERROR: MGN service not initialized in region $REGION${NC}"
    echo "Run: aws mgn initialize-service --region $REGION"
    exit 1
fi

echo -e "${GREEN}✓ MGN service is initialized${NC}"
echo ""

# Get source servers
echo "Fetching source servers..."
SOURCE_SERVERS=$(aws mgn describe-source-servers \
    --region $REGION \
    --profile $PROFILE \
    --output json)

# Check if any servers exist
SERVER_COUNT=$(echo $SOURCE_SERVERS | jq '.items | length')

if [ "$SERVER_COUNT" -eq 0 ]; then
    echo -e "${YELLOW}No source servers found.${NC}"
    echo "Install MGN agent on a server to start replication."
    exit 0
fi

echo -e "${GREEN}Found $SERVER_COUNT source server(s)${NC}"
echo ""

# Display detailed status for each server
echo $SOURCE_SERVERS | jq -r '.items[] | 
    "----------------------------------------\n" +
    "Server ID: " + .sourceServerID + "\n" +
    "Hostname: " + (.sourceProperties.identificationHints.hostname // "N/A") + "\n" +
    "OS: " + (.sourceProperties.os.fullString // "N/A") + "\n" +
    "Lifecycle State: " + .lifeCycle.state + "\n" +
    "Replication State: " + .dataReplicationInfo.dataReplicationState + "\n" +
    "Lag Duration: " + (.dataReplicationInfo.lagDuration // "N/A") + "\n" +
    "Last Snapshot: " + (.dataReplicationInfo.lastSnapshotDateTime // "N/A") + "\n" +
    "Replicated Disks: " + (.dataReplicationInfo.replicatedDisks | length | tostring) + "\n"'

# Summary with color coding
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Summary${NC}"
echo -e "${BLUE}========================================${NC}"

echo $SOURCE_SERVERS | jq -r '.items[] | 
    .sourceServerID + " | " + 
    .dataReplicationInfo.dataReplicationState + " | " + 
    (.dataReplicationInfo.lagDuration // "N/A")' | while read line; do
    
    if echo "$line" | grep -q "CONTINUOUS_SYNC"; then
        echo -e "${GREEN}✓ $line${NC}"
    elif echo "$line" | grep -q "INITIAL_SYNC"; then
        echo -e "${YELLOW}⟳ $line${NC}"
    elif echo "$line" | grep -q "STALLED"; then
        echo -e "${RED}✗ $line${NC}"
    else
        echo "$line"
    fi
done

echo ""
echo -e "${BLUE}Legend:${NC}"
echo -e "${GREEN}✓ CONTINUOUS_SYNC${NC} - Ready for testing/cutover"
echo -e "${YELLOW}⟳ INITIAL_SYNC${NC} - Initial replication in progress"
echo -e "${RED}✗ STALLED${NC} - Replication issue, check logs"
echo ""

# Check for ready servers
READY_COUNT=$(echo $SOURCE_SERVERS | jq '[.items[] | select(.dataReplicationInfo.dataReplicationState == "CONTINUOUS_SYNC")] | length')

if [ "$READY_COUNT" -gt 0 ]; then
    echo -e "${GREEN}$READY_COUNT server(s) ready for testing or cutover!${NC}"
else
    echo -e "${YELLOW}No servers ready yet. Wait for CONTINUOUS_SYNC state.${NC}"
fi

echo ""
echo "Run this script again to refresh status."
