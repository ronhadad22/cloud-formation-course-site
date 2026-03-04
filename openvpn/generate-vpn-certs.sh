#!/bin/bash

# AWS Client VPN Certificate Generation Script
# This script generates server and client certificates for AWS Client VPN

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔐 AWS Client VPN Certificate Generator${NC}"
echo ""

# Configuration
CERT_DIR="vpn-certs"
REGION="eu-west-1"
AWS_PROFILE="iitc-profile"

# Create directory for certificates
mkdir -p $CERT_DIR
cd $CERT_DIR

echo -e "${YELLOW}Step 1: Installing easy-rsa...${NC}"
# Check if easy-rsa is installed
if ! command -v easyrsa &> /dev/null; then
    echo "Installing easy-rsa..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        brew install easy-rsa
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        sudo apt-get update && sudo apt-get install -y easy-rsa
    fi
fi

echo -e "${YELLOW}Step 2: Initializing PKI...${NC}"
# Initialize PKI in local directory
export EASYRSA_PKI="$PWD/pki"
easyrsa init-pki

echo -e "${YELLOW}Step 3: Building CA...${NC}"
# Build CA (Certificate Authority)
easyrsa build-ca nopass <<EOF
VPN-CA
EOF

echo -e "${YELLOW}Step 4: Generating Server Certificate...${NC}"
# Generate server certificate and key with proper domain format
easyrsa build-server-full server.vpn.example.com nopass

echo -e "${YELLOW}Step 5: Generating Client Certificate...${NC}"
# Generate client certificate and key with proper domain format
easyrsa build-client-full client1.vpn.example.com nopass

echo -e "${GREEN}✅ Certificates generated successfully!${NC}"
echo ""
echo -e "${BLUE}📁 Certificate files location:${NC}"
echo "  CA Certificate:      $PWD/pki/ca.crt"
echo "  Server Certificate:  $PWD/pki/issued/server.vpn.example.com.crt"
echo "  Server Key:          $PWD/pki/private/server.vpn.example.com.key"
echo "  Client Certificate:  $PWD/pki/issued/client1.vpn.example.com.crt"
echo "  Client Key:          $PWD/pki/private/client1.vpn.example.com.key"
echo ""

# Copy certificates to easy access location
echo -e "${YELLOW}Step 6: Organizing certificates...${NC}"
mkdir -p ../vpn-certs-ready
cp pki/ca.crt ../vpn-certs-ready/
cp pki/issued/server.vpn.example.com.crt ../vpn-certs-ready/server.crt
cp pki/private/server.vpn.example.com.key ../vpn-certs-ready/server.key
cp pki/issued/client1.vpn.example.com.crt ../vpn-certs-ready/client1.crt
cp pki/private/client1.vpn.example.com.key ../vpn-certs-ready/client1.key

cd ..

echo -e "${GREEN}✅ Certificates copied to: vpn-certs-ready/${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "  1. Run: ./import-certs-to-acm.sh"
echo "  2. Update CloudFormation stack with certificate ARNs"
echo ""
