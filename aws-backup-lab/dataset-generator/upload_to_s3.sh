#!/bin/bash
# Upload generated hospital data to S3 bucket
# Usage: ./upload_to_s3.sh [BUCKET_NAME]
# Requires: export AWS_REGION=<your-region>

set -e

STACK_NAME="backup-lab"

# Get bucket name from CloudFormation if not provided
if [ -z "$1" ]; then
    BUCKET=$(aws cloudformation describe-stacks \
      --stack-name $STACK_NAME \
      --query 'Stacks[0].Outputs[?OutputKey==`S3BucketName`].OutputValue' \
      --output text)
else
    BUCKET=$1
fi

if [ ! -d "hospital-data" ]; then
    echo "❌ hospital-data/ directory not found. Run generate_data.py first."
    exit 1
fi

echo "📤 Uploading hospital data to S3 bucket: $BUCKET"

# Upload billing files
echo "  Uploading billing records..."
aws s3 sync hospital-data/billing/ s3://$BUCKET/billing/

# Upload logs
echo "  Uploading application logs..."
aws s3 sync hospital-data/logs/ s3://$BUCKET/logs/

# Upload configs
echo "  Uploading configuration files..."
aws s3 sync hospital-data/configs/ s3://$BUCKET/configs/

# Upload patient summary (not individual records - those go to EFS/RDS)
echo "  Uploading patient summary..."
aws s3 cp hospital-data/patients/patient_summary.json s3://$BUCKET/reports/patient_summary.json

echo ""
echo "📦 S3 Contents:"
aws s3 ls s3://$BUCKET/ --recursive --summarize | tail -2

echo ""
echo "✅ Data uploaded to S3 successfully!"
