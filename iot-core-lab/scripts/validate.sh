#!/bin/bash
# ============================================================
# Validate IoT Core Lab — Check all resources and S3 data
# ============================================================

REGION=${AWS_REGION:-eu-west-1}
PROFILE=${AWS_PROFILE:-iitc-profile}
THING_NAME=${1:-temperature-sensor-01}
STACK_NAME="iot-core-lab"
PASS=0
FAIL=0

check() {
  local desc="$1"
  local result="$2"
  if [ "$result" = "true" ]; then
    echo "  ✅ $desc"
    PASS=$((PASS + 1))
  else
    echo "  ❌ $desc"
    FAIL=$((FAIL + 1))
  fi
}

echo "================================================"
echo "  IoT Core Lab — Validation"
echo "================================================"
echo ""

# Check CloudFormation stack
echo "📋 Infrastructure:"
STACK_STATUS=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" --profile "$PROFILE" \
  --query 'Stacks[0].StackStatus' --output text 2>/dev/null || echo "NOT_FOUND")
check "CloudFormation stack exists ($STACK_STATUS)" "$([ "$STACK_STATUS" = "CREATE_COMPLETE" ] || [ "$STACK_STATUS" = "UPDATE_COMPLETE" ] && echo true || echo false)"

# Check IoT Thing
THING=$(aws iot describe-thing \
  --thing-name "$THING_NAME" \
  --region "$REGION" --profile "$PROFILE" \
  --query 'thingName' --output text 2>/dev/null || echo "NOT_FOUND")
check "IoT Thing '$THING_NAME' exists" "$([ "$THING" = "$THING_NAME" ] && echo true || echo false)"

# Check IoT Policy
POLICY=$(aws iot get-policy \
  --policy-name iot-lab-device-policy \
  --region "$REGION" --profile "$PROFILE" \
  --query 'policyName' --output text 2>/dev/null || echo "NOT_FOUND")
check "IoT Policy 'iot-lab-device-policy' exists" "$([ "$POLICY" = "iot-lab-device-policy" ] && echo true || echo false)"

# Check IoT Rule
RULE=$(aws iot get-topic-rule \
  --rule-name iot_lab_to_s3 \
  --region "$REGION" --profile "$PROFILE" \
  --query 'rule.ruleName' --output text 2>/dev/null || echo "NOT_FOUND")
check "IoT Rule 'iot_lab_to_s3' exists" "$([ "$RULE" = "iot_lab_to_s3" ] && echo true || echo false)"

# Check S3 bucket
BUCKET=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" --profile "$PROFILE" \
  --query 'Stacks[0].Outputs[?OutputKey==`S3BucketName`].OutputValue' --output text 2>/dev/null || echo "")
check "S3 bucket exists ($BUCKET)" "$([ -n "$BUCKET" ] && [ "$BUCKET" != "None" ] && echo true || echo false)"

echo ""
echo "📋 Certificates:"
# Check certificate is attached to Thing
PRINCIPALS=$(aws iot list-thing-principals \
  --thing-name "$THING_NAME" \
  --region "$REGION" --profile "$PROFILE" \
  --query 'principals' --output text 2>/dev/null || echo "")
check "Certificate attached to Thing" "$([ -n "$PRINCIPALS" ] && echo true || echo false)"

echo ""
echo "📋 S3 Data:"
if [ -n "$BUCKET" ] && [ "$BUCKET" != "None" ]; then
  OBJECT_COUNT=$(aws s3 ls "s3://$BUCKET/devices/" --recursive \
    --profile "$PROFILE" 2>/dev/null | wc -l | tr -d ' ')
  check "S3 has device data ($OBJECT_COUNT objects)" "$([ "$OBJECT_COUNT" -gt 0 ] 2>/dev/null && echo true || echo false)"

  if [ "$OBJECT_COUNT" -gt 0 ]; then
    LATEST=$(aws s3 ls "s3://$BUCKET/devices/" --recursive \
      --profile "$PROFILE" 2>/dev/null | sort | tail -1 | awk '{print $4}')
    echo ""
    echo "  📄 Latest object: $LATEST"
    echo "  📄 Content:"
    aws s3 cp "s3://$BUCKET/$LATEST" - --profile "$PROFILE" 2>/dev/null | jq .
  fi
else
  check "S3 has device data" "false"
fi

echo ""
echo "================================================"
echo "  Results: $PASS passed, $FAIL failed"
echo "================================================"
