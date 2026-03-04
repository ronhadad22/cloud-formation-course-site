#!/bin/bash
###############################################################################
# Restore Validation Tool
# Verifies that restored data matches original data after disaster recovery.
# Generates a summary report in both CLI and JSON format.
#
# FOR TRAINING AND SIMULATION ONLY.
###############################################################################

set -e

EC2_IP=${1:?"Usage: ./validate_restore.sh <EC2_PUBLIC_IP> <SSH_KEY_PATH> <S3_BUCKET>"}
KEY_PATH=${2:?"Usage: ./validate_restore.sh <EC2_PUBLIC_IP> <SSH_KEY_PATH> <S3_BUCKET>"}
S3_BUCKET=${3:?"Usage: ./validate_restore.sh <EC2_PUBLIC_IP> <SSH_KEY_PATH> <S3_BUCKET>"}
# Requires: export AWS_REGION=<your-region>

REPORT_DIR="validation-reports"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="$REPORT_DIR/restore-validation-${TIMESTAMP}.json"

mkdir -p "$REPORT_DIR"

echo "============================================"
echo "🔍 RESTORE VALIDATION TOOL"
echo "   Time: $(date)"
echo "============================================"
echo ""

TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
RESULTS="[]"

add_result() {
    local check_name=$1
    local status=$2
    local details=$3
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    if [ "$status" = "PASS" ]; then
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
        echo "  ✅ $check_name: $details"
    else
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
        echo "  ❌ $check_name: $details"
    fi
}

# ============================================
# Check 1: EFS Patient Files
# ============================================
echo "📁 Checking EFS Patient Files..."
EFS_RESULT=$(ssh -i "$KEY_PATH" ec2-user@${EC2_IP} << 'REMOTEOF'
PATIENT_COUNT=$(find /mnt/efs/hospital-data/patients -name "*.json" -type f 2>/dev/null | wc -l | tr -d ' ')
IMAGE_COUNT=$(find /mnt/efs/hospital-data/medical-images -type f ! -name "*.encrypted" ! -name "RANSOM_NOTE.txt" 2>/dev/null | wc -l | tr -d ' ')
CONFIG_COUNT=$(find /mnt/efs/hospital-data/configs -name "*.yaml" -type f 2>/dev/null | wc -l | tr -d ' ')
LOG_COUNT=$(find /mnt/efs/hospital-data/logs -name "*.log" -type f 2>/dev/null | wc -l | tr -d ' ')
BILLING_COUNT=$(find /mnt/efs/hospital-data/billing -name "*.csv" -type f 2>/dev/null | wc -l | tr -d ' ')
ENCRYPTED_COUNT=$(find /mnt/efs/hospital-data -name "*.encrypted" 2>/dev/null | wc -l | tr -d ' ')
RANSOM_COUNT=$(find /mnt/efs/hospital-data -name "RANSOM_NOTE.txt" 2>/dev/null | wc -l | tr -d ' ')
echo "$PATIENT_COUNT|$IMAGE_COUNT|$CONFIG_COUNT|$LOG_COUNT|$BILLING_COUNT|$ENCRYPTED_COUNT|$RANSOM_COUNT"
REMOTEOF
)

IFS='|' read -r PATIENTS IMAGES CONFIGS LOGS BILLING ENCRYPTED RANSOMS <<< "$EFS_RESULT"

if [ "$PATIENTS" -ge 50 ]; then
    add_result "Patient Records" "PASS" "$PATIENTS JSON files found (expected ≥50)"
else
    add_result "Patient Records" "FAIL" "Only $PATIENTS JSON files found (expected ≥50)"
fi

if [ "$IMAGES" -ge 15 ]; then
    add_result "Medical Images" "PASS" "$IMAGES image files found (expected ≥15)"
else
    add_result "Medical Images" "FAIL" "Only $IMAGES image files found (expected ≥15)"
fi

if [ "$CONFIGS" -ge 4 ]; then
    add_result "Config Files" "PASS" "$CONFIGS YAML files found (expected ≥4)"
else
    add_result "Config Files" "FAIL" "Only $CONFIGS YAML files found (expected ≥4)"
fi

if [ "$LOGS" -ge 5 ]; then
    add_result "Log Files" "PASS" "$LOGS log files found (expected ≥5)"
else
    add_result "Log Files" "FAIL" "Only $LOGS log files found (expected ≥5)"
fi

if [ "$ENCRYPTED" -eq 0 ]; then
    add_result "No Encrypted Files" "PASS" "No .encrypted files found"
else
    add_result "No Encrypted Files" "FAIL" "$ENCRYPTED .encrypted files still present"
fi

if [ "$RANSOMS" -eq 0 ]; then
    add_result "No Ransom Notes" "PASS" "No ransom notes found"
else
    add_result "No Ransom Notes" "FAIL" "$RANSOMS ransom notes still present"
fi

echo ""

# ============================================
# Check 2: S3 Bucket
# ============================================
echo "📦 Checking S3 Bucket..."
S3_COUNT=$(aws s3 ls s3://$S3_BUCKET/ --recursive 2>/dev/null | wc -l | tr -d ' ')

if [ "$S3_COUNT" -ge 10 ]; then
    add_result "S3 Objects" "PASS" "$S3_COUNT objects in bucket"
else
    add_result "S3 Objects" "FAIL" "Only $S3_COUNT objects in bucket (expected ≥10)"
fi

echo ""

# ============================================
# Check 3: Web Server
# ============================================
echo "🌐 Checking Web Server..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://${EC2_IP}/ 2>/dev/null || echo "000")
HTTP_BODY=$(curl -s http://${EC2_IP}/ 2>/dev/null || echo "")

if [ "$HTTP_CODE" = "200" ]; then
    add_result "Web Server Status" "PASS" "HTTP 200 OK"
else
    add_result "Web Server Status" "FAIL" "HTTP $HTTP_CODE (expected 200)"
fi

if echo "$HTTP_BODY" | grep -qi "ransomware\|encrypted\|compromised"; then
    add_result "Web Server Content" "FAIL" "Ransomware defacement still present"
else
    add_result "Web Server Content" "PASS" "No ransomware content detected"
fi

echo ""

# ============================================
# Summary Report
# ============================================
echo "============================================"
echo "📊 VALIDATION SUMMARY"
echo "============================================"
echo ""
echo "  Total Checks:  $TOTAL_CHECKS"
echo "  Passed:        $PASSED_CHECKS ✅"
echo "  Failed:        $FAILED_CHECKS ❌"
echo ""

SCORE=$(( (PASSED_CHECKS * 100) / TOTAL_CHECKS ))
if [ $SCORE -eq 100 ]; then
    echo "  🏆 SCORE: $SCORE% - PERFECT RECOVERY!"
elif [ $SCORE -ge 80 ]; then
    echo "  ⭐ SCORE: $SCORE% - Good recovery, minor issues remain"
elif [ $SCORE -ge 50 ]; then
    echo "  ⚠️  SCORE: $SCORE% - Partial recovery, significant data still missing"
else
    echo "  ❌ SCORE: $SCORE% - Recovery incomplete, critical data missing"
fi

# Generate JSON report
cat > "$REPORT_FILE" << JSONEOF
{
  "validation_report": {
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "environment": "backup-lab",
    "summary": {
      "total_checks": $TOTAL_CHECKS,
      "passed": $PASSED_CHECKS,
      "failed": $FAILED_CHECKS,
      "score_percent": $SCORE
    },
    "efs_validation": {
      "patient_records": $PATIENTS,
      "medical_images": $IMAGES,
      "config_files": $CONFIGS,
      "log_files": $LOGS,
      "encrypted_files_remaining": $ENCRYPTED,
      "ransom_notes_remaining": $RANSOMS
    },
    "s3_validation": {
      "object_count": $S3_COUNT
    },
    "web_server": {
      "http_status": "$HTTP_CODE",
      "ransomware_detected": $(echo "$HTTP_BODY" | grep -qi "ransomware\|encrypted" && echo "true" || echo "false")
    }
  }
}
JSONEOF

echo ""
echo "📄 JSON report saved to: $REPORT_FILE"
echo ""
