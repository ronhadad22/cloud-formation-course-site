#!/bin/bash
set -e

# ============================================================
# Cleanup IoT Core Lab resources
# ============================================================

REGION=${AWS_REGION:-eu-west-1}
PROFILE=${AWS_PROFILE:-iitc-profile}
THING_NAME=${1:-temperature-sensor-01}
CERTS_DIR="$(dirname "$0")/../certs"
STACK_NAME="iot-core-lab"

echo "================================================"
echo "  IoT Core Lab — Cleanup"
echo "================================================"
echo ""

# Detach and delete certificates
if [ -f "$CERTS_DIR/cert-arn.txt" ]; then
  CERT_ARN=$(cat "$CERTS_DIR/cert-arn.txt")
  CERT_ID=$(cat "$CERTS_DIR/cert-id.txt")

  echo "📎 Detaching policy from certificate..."
  aws iot detach-policy \
    --policy-name iot-lab-device-policy \
    --target "$CERT_ARN" \
    --region "$REGION" --profile "$PROFILE" 2>/dev/null || true

  echo "📎 Detaching certificate from Thing..."
  aws iot detach-thing-principal \
    --thing-name "$THING_NAME" \
    --principal "$CERT_ARN" \
    --region "$REGION" --profile "$PROFILE" 2>/dev/null || true

  echo "🗑️  Deactivating certificate..."
  aws iot update-certificate \
    --certificate-id "$CERT_ID" \
    --new-status INACTIVE \
    --region "$REGION" --profile "$PROFILE" 2>/dev/null || true

  echo "🗑️  Deleting certificate..."
  aws iot delete-certificate \
    --certificate-id "$CERT_ID" \
    --force-delete \
    --region "$REGION" --profile "$PROFILE" 2>/dev/null || true
fi

# Empty S3 bucket
BUCKET=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" --profile "$PROFILE" \
  --query 'Stacks[0].Outputs[?OutputKey==`S3BucketName`].OutputValue' \
  --output text 2>/dev/null || echo "")

if [ -n "$BUCKET" ] && [ "$BUCKET" != "None" ]; then
  echo "🗑️  Emptying S3 bucket: $BUCKET..."
  aws s3 rm "s3://$BUCKET" --recursive \
    --region "$REGION" --profile "$PROFILE" 2>/dev/null || true
fi

# Delete CloudFormation stack
echo "🗑️  Deleting CloudFormation stack: $STACK_NAME..."
aws cloudformation delete-stack \
  --stack-name "$STACK_NAME" \
  --region "$REGION" --profile "$PROFILE"

aws cloudformation wait stack-delete-complete \
  --stack-name "$STACK_NAME" \
  --region "$REGION" --profile "$PROFILE"

# Remove local cert files
echo "🗑️  Removing local certificates..."
rm -rf "$CERTS_DIR"

echo ""
echo "✅ Cleanup complete!"
