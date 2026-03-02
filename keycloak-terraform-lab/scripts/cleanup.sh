#!/bin/bash
set -e

# ============================================================
# Keycloak + Terraform Lab — Cleanup Script
# ============================================================

STACK_NAME="keycloak-tf-lab"
REGION="${AWS_DEFAULT_REGION:-us-east-1}"
TF_DIR="$(dirname "$0")/../terraform"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${BLUE}[INFO]${NC} $1"; }
ok()   { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

echo "=============================================="
echo "  Keycloak + Terraform Lab — Cleanup"
echo "=============================================="
echo ""

read -p "Are you sure you want to destroy all resources? (y/N): " CONFIRM
if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
  echo "Aborted."
  exit 0
fi

# Step 1: Terraform destroy
if [ -d "$TF_DIR/.terraform" ]; then
  log "Destroying Terraform resources..."
  cd "$TF_DIR"
  terraform destroy -auto-approve 2>/dev/null || warn "Terraform destroy failed (Keycloak may already be down)"
  rm -f terraform.tfvars
  ok "Terraform resources destroyed"
else
  warn "No Terraform state found — skipping"
fi

# Step 2: Delete CloudFormation stack
log "Deleting CloudFormation stack '$STACK_NAME'..."
aws cloudformation delete-stack --stack-name "$STACK_NAME" --region "$REGION" 2>/dev/null || true

log "Waiting for stack deletion..."
aws cloudformation wait stack-delete-complete --stack-name "$STACK_NAME" --region "$REGION" 2>/dev/null || true

ok "CloudFormation stack deleted"

echo ""
echo "=============================================="
echo -e "${GREEN}  CLEANUP COMPLETE${NC}"
echo "=============================================="
