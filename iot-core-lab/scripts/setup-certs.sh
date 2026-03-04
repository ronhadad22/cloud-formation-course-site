#!/bin/bash
set -e

# ============================================================
# Setup IoT certificates and attach to Thing
# Run AFTER CloudFormation stack is deployed
# ============================================================

REGION=${AWS_REGION:-eu-west-1}
PROFILE=${AWS_PROFILE:-iitc-profile}
THING_NAME=${1:-temperature-sensor-01}
CERTS_DIR="$(dirname "$0")/../certs"

echo "================================================"
echo "  IoT Core Lab — Certificate Setup"
echo "================================================"
echo "Region:     $REGION"
echo "Profile:    $PROFILE"
echo "Thing:      $THING_NAME"
echo ""

# Create certs directory
mkdir -p "$CERTS_DIR"

# Get IoT endpoint
ENDPOINT=$(aws iot describe-endpoint \
  --endpoint-type iot:Data-ATS \
  --region "$REGION" \
  --profile "$PROFILE" \
  --query 'endpointAddress' --output text)

echo "IoT Endpoint: $ENDPOINT"
echo "$ENDPOINT" > "$CERTS_DIR/endpoint.txt"

# Download Amazon Root CA
echo "📥 Downloading Amazon Root CA..."
curl -s -o "$CERTS_DIR/AmazonRootCA1.pem" \
  "https://www.amazontrust.com/repository/AmazonRootCA1.pem"

# Create certificate
echo "🔐 Creating IoT certificate..."
CERT_OUTPUT=$(aws iot create-keys-and-certificate \
  --set-as-active \
  --region "$REGION" \
  --profile "$PROFILE" \
  --output json)

CERT_ARN=$(echo "$CERT_OUTPUT" | jq -r '.certificateArn')
CERT_ID=$(echo "$CERT_OUTPUT" | jq -r '.certificateId')

# Save certificate files
echo "$CERT_OUTPUT" | jq -r '.certificatePem' > "$CERTS_DIR/device-cert.pem"
echo "$CERT_OUTPUT" | jq -r '.keyPair.PrivateKey' > "$CERTS_DIR/private.key"
echo "$CERT_OUTPUT" | jq -r '.keyPair.PublicKey' > "$CERTS_DIR/public.key"

echo "Certificate ARN: $CERT_ARN"
echo "Certificate ID:  $CERT_ID"
echo "$CERT_ARN" > "$CERTS_DIR/cert-arn.txt"
echo "$CERT_ID" > "$CERTS_DIR/cert-id.txt"

# Attach policy to certificate
echo "📎 Attaching IoT policy to certificate..."
aws iot attach-policy \
  --policy-name iot-lab-device-policy \
  --target "$CERT_ARN" \
  --region "$REGION" \
  --profile "$PROFILE"

# Attach certificate to Thing
echo "📎 Attaching certificate to Thing: $THING_NAME..."
aws iot attach-thing-principal \
  --thing-name "$THING_NAME" \
  --principal "$CERT_ARN" \
  --region "$REGION" \
  --profile "$PROFILE"

echo ""
echo "================================================"
echo "  ✅ Setup Complete!"
echo "================================================"
echo ""
echo "Files created in $CERTS_DIR/:"
ls -la "$CERTS_DIR/"
echo ""
echo "IoT Endpoint: $ENDPOINT"
echo "Thing Name:   $THING_NAME"
echo ""
echo "Next: Run the device simulator:"
echo "  pip3 install awsiotsdk"
echo "  python3 simulator/device_simulator.py"
