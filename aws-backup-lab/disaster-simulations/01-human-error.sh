#!/bin/bash
###############################################################################
# Disaster Scenario 1: Human Error - Accidental File Deletion
# Simulates an employee accidentally deleting patient files from EFS
#
# SAFE: Creates a local backup before deletion. Supports rollback.
# FOR TRAINING AND SIMULATION ONLY.
###############################################################################

set -e

EC2_IP=${1:?"Usage: ./01-human-error.sh <EC2_PUBLIC_IP> <SSH_KEY_PATH>"}
KEY_PATH=${2:?"Usage: ./01-human-error.sh <EC2_PUBLIC_IP> <SSH_KEY_PATH>"}
LOG_FILE="disaster-logs/human-error-$(date +%Y%m%d_%H%M%S).log"

mkdir -p disaster-logs

echo "============================================" | tee -a "$LOG_FILE"
echo "💥 DISASTER SCENARIO 1: Human Error"        | tee -a "$LOG_FILE"
echo "   Accidental Patient File Deletion"         | tee -a "$LOG_FILE"
echo "   Time: $(date)"                            | tee -a "$LOG_FILE"
echo "============================================" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

echo "📋 SCENARIO: A junior admin ran a cleanup script that" | tee -a "$LOG_FILE"
echo "   accidentally deleted patient records from EFS."      | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

ssh -i "$KEY_PATH" ec2-user@${EC2_IP} << 'REMOTEOF'
echo "📊 BEFORE DISASTER - EFS File Count:"
echo "  Patients:       $(find /mnt/efs/hospital-data/patients -type f 2>/dev/null | wc -l) files"
echo "  Medical Images: $(find /mnt/efs/hospital-data/medical-images -type f 2>/dev/null | wc -l) files"
echo "  Total Size:     $(du -sh /mnt/efs/hospital-data/ 2>/dev/null | awk '{print $1}')"
echo ""

# Safety: Create local backup on EC2 before destruction
echo "🔒 Creating safety backup on EC2 (for rollback)..."
sudo cp -r /mnt/efs/hospital-data/patients /tmp/patients-safety-backup 2>/dev/null || true
sudo cp -r /mnt/efs/hospital-data/medical-images /tmp/images-safety-backup 2>/dev/null || true
echo "  Safety backup created at /tmp/"
echo ""

# SIMULATE DISASTER: Delete patient files
echo "💥 EXECUTING DISASTER: Deleting patient records..."
sudo rm -rf /mnt/efs/hospital-data/patients/*.json
echo "  ❌ Patient JSON files deleted!"

echo ""
echo "💥 EXECUTING DISASTER: Deleting medical images..."
sudo rm -rf /mnt/efs/hospital-data/medical-images/*
echo "  ❌ Medical images deleted!"

echo ""
echo "📊 AFTER DISASTER - EFS File Count:"
echo "  Patients:       $(find /mnt/efs/hospital-data/patients -type f 2>/dev/null | wc -l) files"
echo "  Medical Images: $(find /mnt/efs/hospital-data/medical-images -type f 2>/dev/null | wc -l) files"
echo "  Total Size:     $(du -sh /mnt/efs/hospital-data/ 2>/dev/null | awk '{print $1}')"

echo ""
echo "============================================"
echo "🚨 DISASTER COMPLETE"
echo "   Patient records and medical images are GONE!"
echo "   Your mission: Restore from AWS Backup"
echo "============================================"
echo ""
echo "💡 ROLLBACK AVAILABLE: If needed, run:"
echo "   sudo cp -r /tmp/patients-safety-backup/* /mnt/efs/hospital-data/patients/"
echo "   sudo cp -r /tmp/images-safety-backup/* /mnt/efs/hospital-data/medical-images/"
REMOTEOF

echo "" | tee -a "$LOG_FILE"
echo "Disaster executed at $(date)" >> "$LOG_FILE"
echo "✅ Disaster simulation complete. Check $LOG_FILE for details."
