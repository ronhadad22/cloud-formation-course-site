# AWS Client VPN Connection Guide

## ✅ Your Client VPN is Ready!

**Endpoint ID:** `cvpn-endpoint-0c3291a4a0a24fe91`  
**Region:** `us-east-1`  
**Client CIDR:** `10.50.0.0/16`  
**Status:** Available ✅

---

## 🚀 How to Connect

### Step 1: Download AWS VPN Client

Download the official AWS VPN Client:
- **macOS:** https://d20adtppz83p9s.cloudfront.net/OSX/latest/AWS_VPN_Client.pkg
- **Windows:** https://d20adtppz83p9s.cloudfront.net/WPF/latest/AWS_VPN_Client.msi
- **Linux:** https://docs.aws.amazon.com/vpn/latest/clientvpn-user/client-vpn-connect-linux.html

### Step 2: Import Configuration File

1. Open **AWS VPN Client**
2. Click **File** → **Manage Profiles**
3. Click **Add Profile**
4. Select the file: `/Users/rwnhdd/Downloads/cloudformation/openvpn/aws-client-vpn-config.ovpn`
5. Give it a name: "AWS Client VPN - US East 1"
6. Click **Add Profile**

### Step 3: Connect

1. Select your profile from the list
2. Click **Connect**
3. You should see "Connected" status

---

## 📋 What You Can Access

Once connected to the VPN, you can access:

### Private Resources in VPC (10.0.0.0/16)
- **RDS Database:** Private instances in your VPC
- **EC2 Instances:** Private subnet instances
- **Internal Load Balancers:** Private ALB/NLB endpoints
- **Other AWS Resources:** ElastiCache, EFS, etc.

### Example: Connect to RDS

```bash
# Get your RDS endpoint from CloudFormation
export AWS_PROFILE=iitc-profile
aws cloudformation describe-stacks \
  --stack-name be \
  --query 'Stacks[0].Outputs[?OutputKey==`RDSEndpointAddress`].OutputValue' \
  --output text \
  --region eu-central-1

# Connect via MySQL client (once VPN is connected)
mysql -h <RDS_ENDPOINT> -u admin -p
```

---

## 🔧 Troubleshooting

### Connection Fails

1. **Check VPN Status:**
   ```bash
   export AWS_PROFILE=iitc-profile
   aws ec2 describe-client-vpn-endpoints \
     --client-vpn-endpoint-ids cvpn-endpoint-0c3291a4a0a24fe91 \
     --region us-east-1 \
     --query 'ClientVpnEndpoints[0].Status'
   ```

2. **Check CloudWatch Logs:**
   - Log Group: `/aws/clientvpn`
   - Check for connection errors

3. **Verify Certificates:**
   - Make sure the client certificate is embedded in the `.ovpn` file
   - Check that certificates haven't expired

### Can't Access Resources

1. **Check Authorization Rules:**
   ```bash
   aws ec2 describe-client-vpn-authorization-rules \
     --client-vpn-endpoint-id cvpn-endpoint-0c3291a4a0a24fe91 \
     --region us-east-1
   ```

2. **Check Target Network Associations:**
   ```bash
   aws ec2 describe-client-vpn-target-networks \
     --client-vpn-endpoint-id cvpn-endpoint-0c3291a4a0a24fe91 \
     --region us-east-1
   ```

3. **Check Security Groups:**
   - Ensure your resources allow traffic from VPN CIDR: `10.50.0.0/16`

---

## 📊 Monitor Connections

### View Active Connections
```bash
export AWS_PROFILE=iitc-profile
aws ec2 describe-client-vpn-connections \
  --client-vpn-endpoint-id cvpn-endpoint-0c3291a4a0a24fe91 \
  --region us-east-1 \
  --output table
```

### View Connection Logs
```bash
aws logs tail /aws/clientvpn --follow --region us-east-1
```

---

## 🔐 Security Notes

- **Certificate-based authentication:** Uses mutual TLS
- **No username/password needed:** Authentication via client certificate
- **Encrypted tunnel:** All traffic encrypted with OpenVPN protocol
- **AWS managed:** No server maintenance required

---

## 📝 Configuration File Location

Your VPN configuration file with embedded certificates:
```
/Users/rwnhdd/Downloads/cloudformation/openvpn/aws-client-vpn-config.ovpn
```

**Keep this file secure!** It contains your private key.

---

## 🎯 Next Steps

1. ✅ Download AWS VPN Client
2. ✅ Import `aws-client-vpn-config.ovpn`
3. ✅ Connect to VPN
4. ✅ Access your private AWS resources

**Need help?** Check the AWS Client VPN documentation:
https://docs.aws.amazon.com/vpn/latest/clientvpn-user/
