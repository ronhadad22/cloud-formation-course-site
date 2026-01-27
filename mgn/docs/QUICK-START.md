# AWS MGN - Quick Start Guide

## 5-Minute Setup

Get started with AWS Application Migration Service in just a few commands.

### Prerequisites

- AWS CLI installed and configured
- AWS account with admin permissions
- EC2 key pair created

### Step 1: Clone Repository

```bash
git clone https://github.com/your-repo/cloud-formation-course-site.git
cd cloud-formation-course-site/mgn
```

### Step 2: Set Environment Variables

```bash
export AWS_PROFILE=your-profile
export AWS_REGION=us-east-1
export KEY_PAIR_NAME=your-key-pair
```

### Step 3: Initialize MGN

```bash
# Initialize MGN service
aws mgn initialize-service --region $AWS_REGION
```

### Step 4: Deploy Infrastructure

```bash
# Deploy prerequisites (VPC, IAM roles, etc.)
aws cloudformation create-stack \
  --stack-name mgn-prerequisites \
  --template-body file://cloudformation/mgn-prerequisites.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --region $AWS_REGION

# Wait for completion (2-3 minutes)
aws cloudformation wait stack-create-complete \
  --stack-name mgn-prerequisites \
  --region $AWS_REGION
```

### Step 5: Get MGN Credentials

```bash
# Save these for agent installation
MGN_ACCESS_KEY=$(aws cloudformation describe-stacks \
  --stack-name mgn-prerequisites \
  --query 'Stacks[0].Outputs[?OutputKey==`MGNAgentAccessKeyId`].OutputValue' \
  --output text \
  --region $AWS_REGION)

MGN_SECRET_KEY=$(aws cloudformation describe-stacks \
  --stack-name mgn-prerequisites \
  --query 'Stacks[0].Outputs[?OutputKey==`MGNAgentSecretAccessKey`].OutputValue' \
  --output text \
  --region $AWS_REGION)

echo "Access Key: $MGN_ACCESS_KEY"
echo "Secret Key: $MGN_SECRET_KEY"
```

### Step 6: Configure MGN

```bash
# Get subnet and security group IDs
STAGING_SUBNET=$(aws cloudformation describe-stacks \
  --stack-name mgn-prerequisites \
  --query 'Stacks[0].Outputs[?OutputKey==`StagingSubnetId`].OutputValue' \
  --output text \
  --region $AWS_REGION)

REPLICATION_SG=$(aws cloudformation describe-stacks \
  --stack-name mgn-prerequisites \
  --query 'Stacks[0].Outputs[?OutputKey==`ReplicationSecurityGroupId`].OutputValue' \
  --output text \
  --region $AWS_REGION)

# Configure replication settings
aws mgn update-replication-configuration-template \
  --region $AWS_REGION \
  --staging-area-subnet-id $STAGING_SUBNET \
  --replication-servers-security-groups-ids $REPLICATION_SG \
  --associate-default-security-group false \
  --bandwidth-throttling 0 \
  --create-public-ip true \
  --data-plane-routing PUBLIC_IP \
  --default-large-staging-disk-type GP3 \
  --ebs-encryption DEFAULT \
  --replication-server-instance-type t3.small \
  --use-dedicated-replication-server false
```

### Step 7: Deploy Test Source Server (Optional)

```bash
# Deploy a test server to practice migration
aws cloudformation create-stack \
  --stack-name mgn-source-server \
  --template-body file://cloudformation/source-server-simulator.yaml \
  --parameters ParameterKey=KeyPairName,ParameterValue=$KEY_PAIR_NAME \
  --region $AWS_REGION

# Wait for completion
aws cloudformation wait stack-create-complete \
  --stack-name mgn-source-server \
  --region $AWS_REGION

# Get source server IP
SOURCE_IP=$(aws cloudformation describe-stacks \
  --stack-name mgn-source-server \
  --query 'Stacks[0].Outputs[?OutputKey==`SourceServerPublicIP`].OutputValue' \
  --output text \
  --region $AWS_REGION)

echo "Source Server IP: $SOURCE_IP"
```

### Step 8: Install MGN Agent

SSH to your source server (or the test server):

```bash
ssh -i ~/.ssh/$KEY_PAIR_NAME.pem ec2-user@$SOURCE_IP

# Download agent
wget -O ./aws-replication-installer-init.py \
  https://aws-application-migration-service-us-east-1.s3.us-east-1.amazonaws.com/latest/linux/aws-replication-installer-init.py

# Install agent (use credentials from Step 5)
sudo python3 aws-replication-installer-init.py \
  --region us-east-1 \
  --aws-access-key-id YOUR_ACCESS_KEY \
  --aws-secret-access-key YOUR_SECRET_KEY

# Exit SSH
exit
```

### Step 9: Monitor Replication

```bash
# Make script executable
chmod +x scripts/check-replication-status.sh

# Monitor replication
./scripts/check-replication-status.sh
```

### Step 10: Access MGN Console

Open: https://console.aws.amazon.com/mgn/home?region=us-east-1

You should see your source server replicating!

## What's Next?

### For Learning:
1. Complete **Lab 1**: Setup MGN (you just did this!)
2. Complete **Lab 2**: Migrate a Server
3. Complete **Lab 3**: Testing
4. Complete **Lab 4**: Cutover

### For Production:
1. Review `docs/01-getting-started.md` for best practices
2. Plan your migration waves
3. Test thoroughly before cutover
4. Document your runbooks

## Common Commands

### Check Replication Status
```bash
./scripts/check-replication-status.sh
```

### List Source Servers
```bash
aws mgn describe-source-servers --region $AWS_REGION
```

### View MGN Console
```bash
open https://console.aws.amazon.com/mgn/
```

### Clean Up Everything
```bash
./scripts/cleanup.sh
```

## Troubleshooting

### Agent Won't Install
- Check internet connectivity on source server
- Verify AWS credentials are correct
- Ensure security group allows outbound HTTPS (443)

### Server Not Appearing in Console
- Wait 2-3 minutes after agent installation
- Refresh console
- Check agent status: `sudo systemctl status aws-replication-agent`

### Replication Stalled
- Check network connectivity
- Verify security group allows port 1500
- Review logs: `sudo tail -f /var/log/aws-replication-agent.log`

## Cost Estimate

**For this quick start:**
- MGN Service: Free (first 90 days per server)
- Test source server (t3.micro): ~$0.01/hour
- Replication server (t3.small): ~$0.02/hour
- EBS staging volumes: ~$0.10/GB/month

**Total: ~$0.50-1.00 for a few hours of testing**

## Clean Up

When done testing:

```bash
# Run cleanup script
./scripts/cleanup.sh

# Or manually:
aws cloudformation delete-stack --stack-name mgn-source-server
aws cloudformation delete-stack --stack-name mgn-prerequisites
```

## Support

- **Documentation**: See `README.md` and `docs/` folder
- **Labs**: Follow step-by-step labs in `labs/` folder
- **AWS Docs**: https://docs.aws.amazon.com/mgn/
- **AWS Console**: https://console.aws.amazon.com/mgn/

---

**Ready to learn more?** Start with `labs/lab1-setup-mgn.md` for detailed instructions!
