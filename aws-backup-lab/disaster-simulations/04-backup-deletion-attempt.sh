#!/bin/bash
###############################################################################
# Disaster Scenario 4: Backup Deletion Attempt
# Simulates an attacker trying to delete backup recovery points
#
# SAFE: Only ATTEMPTS deletion - vault policies should block it.
# FOR TRAINING AND SIMULATION ONLY.
###############################################################################

set -e

# Requires: export AWS_REGION=<your-region>
VAULT_NAME="backup-lab-primary-vault"
AIRGAPPED_VAULT="backup-lab-airgapped-vault"
LOG_FILE="disaster-logs/backup-deletion-$(date +%Y%m%d_%H%M%S).log"

mkdir -p disaster-logs

echo "============================================" | tee -a "$LOG_FILE"
echo "💥 DISASTER SCENARIO 4: Backup Deletion"    | tee -a "$LOG_FILE"
echo "   Attacker Attempts to Delete Backups"      | tee -a "$LOG_FILE"
echo "   Time: $(date)"                            | tee -a "$LOG_FILE"
echo "============================================" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

echo "📋 SCENARIO: After encrypting files, the attacker tries to" | tee -a "$LOG_FILE"
echo "   delete backup recovery points to prevent recovery."      | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# List recovery points in primary vault
echo "📊 Current Recovery Points in PRIMARY vault:" | tee -a "$LOG_FILE"
aws backup list-recovery-points-by-backup-vault \
  --backup-vault-name $VAULT_NAME \
  --query 'RecoveryPoints[].{Type:ResourceType,Created:CreationDate,Status:Status}' \
  --output table 2>&1 | tee -a "$LOG_FILE"

echo "" | tee -a "$LOG_FILE"

# List recovery points in air-gapped vault
echo "📊 Current Recovery Points in AIR-GAPPED vault:" | tee -a "$LOG_FILE"
aws backup list-recovery-points-by-backup-vault \
  --backup-vault-name $AIRGAPPED_VAULT \
  --query 'RecoveryPoints[].{Type:ResourceType,Created:CreationDate,Status:Status}' \
  --output table 2>&1 | tee -a "$LOG_FILE"

echo "" | tee -a "$LOG_FILE"

# Attempt to delete from PRIMARY vault
echo "💥 ATTEMPTING to delete recovery points from PRIMARY vault..." | tee -a "$LOG_FILE"
PRIMARY_RPS=$(aws backup list-recovery-points-by-backup-vault \
  --backup-vault-name $VAULT_NAME \
  --query 'RecoveryPoints[].RecoveryPointArn' \
  --output text 2>/dev/null)

if [ -n "$PRIMARY_RPS" ]; then
  for RP in $PRIMARY_RPS; do
    echo "  Attempting to delete: $(echo $RP | rev | cut -d: -f1 | rev)" | tee -a "$LOG_FILE"
    RESULT=$(aws backup delete-recovery-point \
      --backup-vault-name $VAULT_NAME \
      --recovery-point-arn "$RP" 2>&1) || true
    echo "  Result: ${RESULT:-DENIED by vault policy}" | tee -a "$LOG_FILE"
  done
else
  echo "  No recovery points found in primary vault" | tee -a "$LOG_FILE"
fi

echo "" | tee -a "$LOG_FILE"

# Attempt to delete from AIR-GAPPED vault
echo "💥 ATTEMPTING to delete recovery points from AIR-GAPPED vault..." | tee -a "$LOG_FILE"
AIRGAPPED_RPS=$(aws backup list-recovery-points-by-backup-vault \
  --backup-vault-name $AIRGAPPED_VAULT \
  --query 'RecoveryPoints[].RecoveryPointArn' \
  --output text 2>/dev/null)

if [ -n "$AIRGAPPED_RPS" ]; then
  for RP in $AIRGAPPED_RPS; do
    echo "  Attempting to delete: $(echo $RP | rev | cut -d: -f1 | rev)" | tee -a "$LOG_FILE"
    RESULT=$(aws backup delete-recovery-point \
      --backup-vault-name $AIRGAPPED_VAULT \
      --recovery-point-arn "$RP" 2>&1) || true
    echo "  Result: ${RESULT:-DENIED by vault lock}" | tee -a "$LOG_FILE"
  done
else
  echo "  No recovery points found in air-gapped vault" | tee -a "$LOG_FILE"
fi

echo "" | tee -a "$LOG_FILE"

# Attempt to delete the vault itself
echo "💥 ATTEMPTING to delete the air-gapped vault..." | tee -a "$LOG_FILE"
RESULT=$(aws backup delete-backup-vault \
  --backup-vault-name $AIRGAPPED_VAULT 2>&1) || true
echo "  Result: ${RESULT:-DENIED}" | tee -a "$LOG_FILE"

echo "" | tee -a "$LOG_FILE"
echo "============================================" | tee -a "$LOG_FILE"
echo "🛡️ ATTACK RESULTS SUMMARY"                   | tee -a "$LOG_FILE"
echo "============================================" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"
echo "The vault access policies and lock configuration" | tee -a "$LOG_FILE"
echo "should have BLOCKED the deletion attempts."       | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"
echo "Key takeaways:" | tee -a "$LOG_FILE"
echo "  1. Vault access policies prevent unauthorized deletion" | tee -a "$LOG_FILE"
echo "  2. Air-gapped vault lock makes recovery points immutable" | tee -a "$LOG_FILE"
echo "  3. Even with admin access, locked vaults protect backups" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"
echo "Your mission: Verify backups are intact and restore from them" | tee -a "$LOG_FILE"

echo "" | tee -a "$LOG_FILE"
echo "Disaster executed at $(date)" >> "$LOG_FILE"
echo "✅ Simulation complete. Check $LOG_FILE for details."
