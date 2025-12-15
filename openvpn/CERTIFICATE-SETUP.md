# AWS Client VPN Certificate Setup Guide

## Quick Start

### 1. Generate Certificates

```bash
cd /Users/rwnhdd/Downloads/cloudformation/openvpn
chmod +x generate-vpn-certs.sh import-certs-to-acm.sh
./generate-vpn-certs.sh
```

This will:
- Install `easy-rsa` (if not already installed)
- Generate CA, server, and client certificates
- Save certificates to `vpn-certs-ready/` directory

### 2. Import to ACM

```bash
./import-certs-to-acm.sh
```

This will:
- Import server certificate to ACM
- Import client certificate to ACM
- Save ARNs to `certificate-arns.txt`

### 3. Update CloudFormation Stack

Use the ARNs from `certificate-arns.txt`:

```bash
export AWS_PROFILE=iitc-profile

# Get the ARNs
source certificate-arns.txt

# Update stack
aws cloudformation update-stack \
  --stack-name be \
  --use-previous-template \
  --parameters \
    ParameterKey=VPNType,ParameterValue=aws-client-vpn \
    ParameterKey=ServerCertificateArn,ParameterValue=$SERVER_CERTIFICATE_ARN \
    ParameterKey=ClientCertificateArn,ParameterValue=$CLIENT_CERTIFICATE_ARN \
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
  --region eu-west-1
```

### 4. Connect to VPN

After stack update completes:

1. **Download VPN Configuration:**
   ```bash
   # Get Client VPN Endpoint ID
   ENDPOINT_ID=$(aws cloudformation describe-stacks \
     --stack-name be \
     --query 'Stacks[0].Outputs[?OutputKey==`ClientVPNEndpointId`].OutputValue' \
     --output text \
     --region eu-west-1)
   
   # Download config
   aws ec2 export-client-vpn-client-configuration \
     --client-vpn-endpoint-id $ENDPOINT_ID \
     --output text \
     --region eu-west-1 > client-config.ovpn
   ```

2. **Add Client Certificate to Config:**
   
   Edit `client-config.ovpn` and add at the end:
   
   ```
   <cert>
   [Contents of vpn-certs-ready/client1.domain.tld.crt]
   </cert>
   
   <key>
   [Contents of vpn-certs-ready/client1.domain.tld.key]
   </key>
   ```

3. **Import to VPN Client:**
   - Download AWS VPN Client: https://aws.amazon.com/vpn/client-vpn-download/
   - Import the modified `client-config.ovpn`
   - Connect!

## Certificate Files

After running the scripts, you'll have:

```
vpn-certs-ready/
├── ca.crt                      # Certificate Authority
├── server.crt                  # Server certificate
├── server.key                  # Server private key
├── client1.domain.tld.crt      # Client certificate
└── client1.domain.tld.key      # Client private key

certificate-arns.txt            # ACM ARNs for CloudFormation
```

## Troubleshooting

### easy-rsa not found

**macOS:**
```bash
brew install easy-rsa
```

**Linux:**
```bash
sudo apt-get update
sudo apt-get install -y easy-rsa
```

### Certificate import fails

Make sure you're in the correct region:
```bash
export AWS_PROFILE=iitc-profile
aws configure get region --profile iitc-profile
```

### VPN connection fails

1. Check CloudWatch logs: `/aws/clientvpn`
2. Verify certificates match in ACM
3. Ensure client certificate is embedded in `.ovpn` file

## Manual Certificate Generation (Alternative)

If you prefer manual steps:

```bash
# Initialize PKI
easyrsa init-pki

# Build CA
easyrsa build-ca nopass

# Generate server cert
easyrsa build-server-full server nopass

# Generate client cert
easyrsa build-client-full client1.domain.tld nopass

# Import to ACM
aws acm import-certificate \
  --certificate fileb://pki/issued/server.crt \
  --private-key fileb://pki/private/server.key \
  --certificate-chain fileb://pki/ca.crt \
  --region eu-west-1
```

## Security Notes

- **Keep private keys secure!** Never commit them to git
- The `vpn-certs-ready/` directory contains sensitive keys
- Add to `.gitignore`:
  ```
  vpn-certs/
  vpn-certs-ready/
  *.key
  *.crt
  certificate-arns.txt
  ```

## Benefits of AWS Client VPN

✅ **Fully managed** - No server to maintain  
✅ **Scalable** - Handles thousands of concurrent connections  
✅ **Integrated** - Works with AWS security groups and NACLs  
✅ **Secure** - Mutual TLS authentication  
✅ **Easy** - Simple client setup with AWS VPN Client  

---

**Need help?** Check the AWS Client VPN documentation:
https://docs.aws.amazon.com/vpn/latest/clientvpn-admin/
