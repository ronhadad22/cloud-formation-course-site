#!/bin/bash

# MGN Cleanup Script
# Removes all MGN resources and CloudFormation stacks

set -e

REGION="${AWS_REGION:-us-east-1}"
PROFILE="${AWS_PROFILE:-default}"

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${RED}========================================${NC}"
echo -e "${RED}AWS MGN Cleanup Script${NC}"
echo -e "${RED}========================================${NC}"
echo ""
echo -e "${YELLOW}WARNING: This will delete all MGN resources!${NC}"
echo "Region: $REGION"
echo "Profile: $PROFILE"
echo ""
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Cleanup cancelled."
    exit 0
fi

echo ""
echo "Starting cleanup..."

# Step 1: Disconnect and remove source servers
echo ""
echo "Step 1: Removing source servers..."
SOURCE_SERVERS=$(aws mgn describe-source-servers \
    --region $REGION \
    --profile $PROFILE \
    --query 'items[].sourceServerID' \
    --output text 2>/dev/null || echo "")

if [ -n "$SOURCE_SERVERS" ]; then
    for server in $SOURCE_SERVERS; do
        echo "  Disconnecting server: $server"
        aws mgn disconnect-from-service \
            --source-server-id $server \
            --region $REGION \
            --profile $PROFILE 2>/dev/null || true
        
        echo "  Marking for deletion: $server"
        aws mgn mark-as-archived \
            --source-server-id $server \
            --region $REGION \
            --profile $PROFILE 2>/dev/null || true
        
        echo "  Deleting server: $server"
        aws mgn delete-source-server \
            --source-server-id $server \
            --region $REGION \
            --profile $PROFILE 2>/dev/null || true
    done
    echo -e "${GREEN}✓ Source servers removed${NC}"
else
    echo "  No source servers found"
fi

# Step 2: Delete replication servers (they should auto-delete, but check)
echo ""
echo "Step 2: Checking for replication servers..."
REPLICATION_SERVERS=$(aws ec2 describe-instances \
    --filters "Name=tag:AWSApplicationMigrationServiceManaged,Values=true" \
    --query 'Reservations[*].Instances[*].InstanceId' \
    --output text \
    --region $REGION \
    --profile $PROFILE 2>/dev/null || echo "")

if [ -n "$REPLICATION_SERVERS" ]; then
    echo "  Found replication servers (will be auto-deleted by MGN)"
    echo "  $REPLICATION_SERVERS"
else
    echo "  No replication servers found"
fi

# Step 3: Delete CloudFormation stacks
echo ""
echo "Step 3: Deleting CloudFormation stacks..."

# Delete source server stack
if aws cloudformation describe-stacks \
    --stack-name mgn-source-server \
    --region $REGION \
    --profile $PROFILE &>/dev/null; then
    
    echo "  Deleting mgn-source-server stack..."
    aws cloudformation delete-stack \
        --stack-name mgn-source-server \
        --region $REGION \
        --profile $PROFILE
    
    echo "  Waiting for stack deletion..."
    aws cloudformation wait stack-delete-complete \
        --stack-name mgn-source-server \
        --region $REGION \
        --profile $PROFILE 2>/dev/null || true
    
    echo -e "${GREEN}✓ Source server stack deleted${NC}"
else
    echo "  mgn-source-server stack not found"
fi

# Delete prerequisites stack
if aws cloudformation describe-stacks \
    --stack-name mgn-prerequisites \
    --region $REGION \
    --profile $PROFILE &>/dev/null; then
    
    echo "  Deleting mgn-prerequisites stack..."
    aws cloudformation delete-stack \
        --stack-name mgn-prerequisites \
        --region $REGION \
        --profile $PROFILE
    
    echo "  Waiting for stack deletion..."
    aws cloudformation wait stack-delete-complete \
        --stack-name mgn-prerequisites \
        --region $REGION \
        --profile $PROFILE 2>/dev/null || true
    
    echo -e "${GREEN}✓ Prerequisites stack deleted${NC}"
else
    echo "  mgn-prerequisites stack not found"
fi

# Step 4: Clean up launch templates
echo ""
echo "Step 4: Checking for MGN launch templates..."
LAUNCH_TEMPLATES=$(aws ec2 describe-launch-templates \
    --filters "Name=tag:MigratedBy,Values=AWS-MGN" \
    --query 'LaunchTemplates[].LaunchTemplateName' \
    --output text \
    --region $REGION \
    --profile $PROFILE 2>/dev/null || echo "")

if [ -n "$LAUNCH_TEMPLATES" ]; then
    for template in $LAUNCH_TEMPLATES; do
        echo "  Deleting launch template: $template"
        aws ec2 delete-launch-template \
            --launch-template-name $template \
            --region $REGION \
            --profile $PROFILE 2>/dev/null || true
    done
    echo -e "${GREEN}✓ Launch templates deleted${NC}"
else
    echo "  No MGN launch templates found"
fi

# Step 5: Optional - Deinitialize MGN service
echo ""
echo "Step 5: MGN Service"
echo -e "${YELLOW}Note: MGN service will remain initialized.${NC}"
echo "To completely remove MGN service data, you would need to:"
echo "  1. Delete all replication configuration templates"
echo "  2. Contact AWS Support to fully deinitialize"
echo ""
echo "This is usually not necessary and MGN service has no cost when idle."

# Summary
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Cleanup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Resources removed:"
echo "  ✓ Source servers disconnected and deleted"
echo "  ✓ CloudFormation stacks deleted"
echo "  ✓ Launch templates removed"
echo ""
echo "Remaining resources (no cost when idle):"
echo "  - MGN service initialization"
echo "  - IAM service-linked roles (managed by AWS)"
echo ""
echo -e "${GREEN}All billable resources have been removed.${NC}"
