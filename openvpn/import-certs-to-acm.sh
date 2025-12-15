#!/bin/bash

# Import VPN Certificates to AWS Certificate Manager (ACM)

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}📤 Importing VPN Certificates to ACM${NC}"
echo ""

# Configuration
CERT_DIR="vpn-certs-ready"
REGION="us-east-1"
AWS_PROFILE="iitc-profile"

# Check if certificates exist
if [ ! -d "$CERT_DIR" ]; then
    echo -e "${RED}❌ Error: Certificate directory not found!${NC}"
    echo "Please run ./generate-vpn-certs.sh first"
    exit 1
fi

echo -e "${YELLOW}Step 1: Importing Server Certificate to ACM...${NC}"
SERVER_CERT_ARN=$(aws acm import-certificate \
    --certificate fileb://$CERT_DIR/server.crt \
    --private-key fileb://$CERT_DIR/server.key \
    --certificate-chain fileb://$CERT_DIR/ca.crt \
    --region $REGION \
    --profile $AWS_PROFILE \
    --tags Key=Name,Value=ClientVPN-Server-Certificate \
    --query 'CertificateArn' \
    --output text)

echo -e "${GREEN}✅ Server certificate imported!${NC}"
echo "   ARN: $SERVER_CERT_ARN"
echo ""

echo -e "${YELLOW}Step 2: Importing Client Certificate to ACM...${NC}"
CLIENT_CERT_ARN=$(aws acm import-certificate \
    --certificate fileb://$CERT_DIR/client1.crt \
    --private-key fileb://$CERT_DIR/client1.key \
    --certificate-chain fileb://$CERT_DIR/ca.crt \
    --region $REGION \
    --profile $AWS_PROFILE \
    --tags Key=Name,Value=ClientVPN-Client-Certificate \
    --query 'CertificateArn' \
    --output text)

echo -e "${GREEN}✅ Client certificate imported!${NC}"
echo "   ARN: $CLIENT_CERT_ARN"
echo ""

# Save ARNs to file
echo -e "${YELLOW}Step 3: Saving certificate ARNs...${NC}"
cat > certificate-arns.txt <<EOF
# AWS Client VPN Certificate ARNs
# Generated: $(date)

SERVER_CERTIFICATE_ARN=$SERVER_CERT_ARN
CLIENT_CERTIFICATE_ARN=$CLIENT_CERT_ARN

# Use these values in your CloudFormation parameters:
# ServerCertificateArn: $SERVER_CERT_ARN
# ClientCertificateArn: $CLIENT_CERT_ARN
EOF

echo -e "${GREEN}✅ Certificate ARNs saved to: certificate-arns.txt${NC}"
echo ""

echo -e "${BLUE}📋 Summary:${NC}"
echo ""
echo -e "${GREEN}Server Certificate ARN:${NC}"
echo "  $SERVER_CERT_ARN"
echo ""
echo -e "${GREEN}Client Certificate ARN:${NC}"
echo "  $CLIENT_CERT_ARN"
echo ""

echo -e "${BLUE}🚀 Next Steps:${NC}"
echo "  1. Update your CloudFormation stack with these ARNs"
echo "  2. Set VPNType parameter to: aws-client-vpn"
echo "  3. Deploy the stack"
echo ""
echo -e "${YELLOW}Example CloudFormation update command:${NC}"
cat <<'COMMAND'
aws cloudformation update-stack \
  --stack-name be \
  --use-previous-template \
  --parameters \
    ParameterKey=VPNType,ParameterValue=aws-client-vpn \
    ParameterKey=ServerCertificateArn,ParameterValue=<SERVER_ARN> \
    ParameterKey=ClientCertificateArn,ParameterValue=<CLIENT_ARN> \
    ParameterKey=KeyPairName,UsePreviousValue=true \
    ParameterKey=InstanceType,UsePreviousValue=true \
    ParameterKey=MinSize,UsePreviousValue=true \
    ParameterKey=MaxSize,UsePreviousValue=true \
    ParameterKey=DesiredCapacity,UsePreviousValue=true \
    ParameterKey=DBInstanceClass,UsePreviousValue=true \
    ParameterKey=DBSecretArn,UsePreviousValue=true \
    ParameterKey=RDSPublicAccess,UsePreviousValue=true \
    ParameterKey=SSLCertificateArns,UsePreviousValue=true \
    ParameterKey=OpenVPNInstanceType,UsePreviousValue=true \
    ParameterKey=OpenVPNAdminPassword,UsePreviousValue=true \
    ParameterKey=OpenVPNImageId,UsePreviousValue=true \
    ParameterKey=ASGArchitecture,UsePreviousValue=true \
    ParameterKey=ClientVPNCidr,UsePreviousValue=true \
  --capabilities CAPABILITY_IAM \
  --region us-east-1 \
  --profile iitc-profile
COMMAND
echo ""
