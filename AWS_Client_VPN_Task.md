# Client VPN Certificates - Simple Guide

## What You Need
- AWS CLI configured
- Terminal/Command Prompt

## Step 1: Generate Certificates

Run these commands one by one:

```bash
# Create folder
mkdir vpn-certificates
cd vpn-certificates

# Generate CA
openssl genrsa -out ca.key 2048
openssl req -new -x509 -days 3650 -key ca.key -out ca.crt -subj "/C=US/ST=State/L=City/O=MyOrg/CN=VPN-CA"

# Generate Server Certificate (must have domain name)
openssl genrsa -out server.key 2048
openssl req -new -key server.key -out server.csr -subj "/C=US/ST=State/L=City/O=MyOrg/CN=vpn.example.com"
openssl x509 -req -days 3650 -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out server.crt
rm server.csr

# Generate Client Certificate
openssl genrsa -out client.key 2048
openssl req -new -key client.key -out client.csr -subj "/C=US/ST=State/L=City/O=MyOrg/CN=client1.example.com"
openssl x509 -req -days 3650 -in client.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out client.crt
rm client.csr
```

## Step 2: Import to AWS

```bash
# Import Server Certificate (uses server.crt and server.key)
aws acm import-certificate \
  --certificate fileb://server.crt \
  --private-key fileb://server.key \
  --certificate-chain fileb://ca.crt \
  --region eu-west-1 \
  --tags Key=Name,Value="ClientVPN-Server-Certificate" Key=Type,Value="Server" Key=Purpose,Value="ClientVPN"
```

**Copy the ARN from output - this is your `ServerCertificateArn`**
**In AWS Console, this will show as: "ClientVPN-Server-Certificate"**

```bash
# Import Client Certificate (uses client.crt and client.key)
aws acm import-certificate \
  --certificate fileb://client.crt \
  --private-key fileb://client.key \
  --certificate-chain fileb://ca.crt \
  --region eu-west-1 \
  --tags Key=Name,Value="ClientVPN-Client-Certificate" Key=Type,Value="Client" Key=Purpose,Value="ClientVPN"
```

**Copy the ARN from output - this is your `ClientCertificateArn`**
**In AWS Console, this will show as: "ClientVPN-Client-Certificate"**

## Step 3: Use in CloudFormation

Add these to your CloudFormation parameters:

```
VPNType: aws-client-vpn
ServerCertificateArn: [PASTE_SERVER_ARN_HERE]
ClientCertificateArn: [PASTE_CLIENT_ARN_HERE]
```

## Step 4: Connect to VPN

### Download Client Configuration

1. **Go to AWS Console** → VPC → Client VPN Endpoints
2. **Find your endpoint** (should show your stack name)
3. **Click "Download Client Configuration"**
4. **Save the .ovpn file** to your computer

### Install AWS VPN Client

**Download from:** https://aws.amazon.com/vpn/client-vpn-download/

- **Windows**: Download and install the MSI
- **macOS**: Download and install the PKG
- **Linux**: Follow the installation guide

### Setup Connection

1. **Open AWS VPN Client**
2. **Click "File" → "Manage Profiles"**
3. **Click "Add Profile"**
4. **Browse and select** your downloaded .ovpn file
5. **Click "Add Profile"**

### Add Your Certificates

1. **In the profile settings**, you'll be prompted for certificates
2. **Client Certificate**: Browse and select `client.crt` from your vpn-certificates folder
3. **Private Key**: Browse and select `client.key` from your vpn-certificates folder
4. **Click "Save"**

### Connect

1. **Select your profile** in AWS VPN Client
2. **Click "Connect"**
3. **Wait for connection** (should show "Connected" status)

### Test Connection

Once connected, test access to your private resources:

```bash
# Test RDS connection (replace with your RDS endpoint)
mysql -h YOUR_RDS_ENDPOINT -u admin -p appdb

# Test SSH to private EC2 instances
ssh -i your-key.pem ec2-user@PRIVATE_INSTANCE_IP
```

### Get Your RDS Endpoint

```bash
aws cloudformation describe-stacks \
  --stack-name YOUR_STACK_NAME \
  --region eu-west-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`RDSEndpoint`].OutputValue' \
  --output text
```

## Troubleshooting

### Connection Fails
- **Check certificates**: Make sure client.crt and client.key are correct
- **Check profile**: Verify .ovpn file is from the correct endpoint
- **Check AWS Console**: Ensure Client VPN endpoint is "Available"

### Can't Access Resources
- **Check routes**: VPN should automatically route 10.0.0.0/16 traffic
- **Check security groups**: Ensure your resources allow VPN client CIDR (10.50.0.0/16)
- **Check authorization rules**: Should allow access to VPC CIDR

### Certificate Errors
- **Regenerate certificates**: Follow Step 1 again with domain names
- **Re-import to ACM**: Follow Step 2 again
- **Update CloudFormation**: Use new certificate ARNs

---
**Problems?** Contact your instructor.
