# Lab 1: Setup AWS Application Migration Service (MGN)

## Objective
Initialize AWS MGN service and deploy the required infrastructure for migration.

## Duration
30-45 minutes

## Prerequisites
- AWS Account with administrator access
- AWS CLI installed and configured
- Basic understanding of VPC and EC2

## Lab Steps

### Step 1: Initialize MGN Service

MGN must be initialized in each AWS region where you plan to use it.

```bash
# Set your AWS profile and region
export AWS_PROFILE=your-profile
export AWS_REGION=us-east-1

# Initialize MGN service
aws mgn initialize-service --region $AWS_REGION
```

**Expected Output:**
```json
{
    "ReplicationConfigurationTemplateID": "rct-xxxxxxxxxxxxx"
}
```

**What happens:**
- MGN service is activated in your account
- Default replication configuration template is created
- Service-linked roles are created automatically

### Step 2: Deploy MGN Prerequisites Stack

Deploy the CloudFormation stack that creates VPC, subnets, security groups, and IAM roles.

```bash
cd /path/to/cloudformation/mgn

# Deploy prerequisites
aws cloudformation create-stack \
  --stack-name mgn-prerequisites \
  --template-body file://cloudformation/mgn-prerequisites.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --region $AWS_REGION

# Wait for stack creation
aws cloudformation wait stack-create-complete \
  --stack-name mgn-prerequisites \
  --region $AWS_REGION

echo "Stack created successfully!"
```

**What this creates:**
- VPC with CIDR 10.0.0.0/16
- Staging subnet (10.0.1.0/24) for replication servers
- Target subnet (10.0.2.0/24) for migrated instances
- Security groups for replication and target instances
- IAM roles for MGN components
- IAM user with access keys for agent installation

### Step 3: Retrieve Stack Outputs

Get important values from the stack outputs:

```bash
# Get all outputs
aws cloudformation describe-stacks \
  --stack-name mgn-prerequisites \
  --region $AWS_REGION \
  --query 'Stacks[0].Outputs' \
  --output table

# Save specific values
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

echo "Staging Subnet: $STAGING_SUBNET"
echo "Replication SG: $REPLICATION_SG"
echo "MGN Access Key: $MGN_ACCESS_KEY"
echo "MGN Secret Key: $MGN_SECRET_KEY"

# IMPORTANT: Save these credentials securely!
```

### Step 4: Configure MGN Replication Settings

Configure the default replication configuration template:

```bash
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

**Configuration Explained:**
- **staging-area-subnet-id**: Where replication servers will run
- **replication-servers-security-groups-ids**: Security group for replication servers
- **bandwidth-throttling**: 0 = unlimited (adjust for production)
- **create-public-ip**: true = replication servers get public IPs
- **data-plane-routing**: PUBLIC_IP = use internet for replication
- **default-large-staging-disk-type**: GP3 = cost-effective SSD
- **replication-server-instance-type**: t3.small = adequate for most workloads
- **use-dedicated-replication-server**: false = share replication servers

### Step 5: Verify MGN Console Access

1. Open AWS Console
2. Navigate to **AWS Application Migration Service**
3. Verify you see the MGN dashboard
4. Check that the service is initialized

**Console URL:**
```
https://console.aws.amazon.com/mgn/home?region=us-east-1
```

### Step 6: Review IAM Roles

Verify the IAM roles were created:

```bash
# List MGN-related roles
aws iam list-roles \
  --query 'Roles[?contains(RoleName, `MGN`)].RoleName' \
  --output table
```

**Expected roles:**
- `MGN-Demo-MGN-Replication-Role`
- `MGN-Demo-MGN-Conversion-Role`
- `MGN-Demo-MGN-Agent-Role`

### Step 7: Create Launch Template (Optional)

Create a launch template for target instances:

```bash
aws ec2 create-launch-template \
  --launch-template-name mgn-target-template \
  --version-description "Template for MGN migrated instances" \
  --launch-template-data '{
    "InstanceType": "t3.small",
    "TagSpecifications": [{
      "ResourceType": "instance",
      "Tags": [{
        "Key": "MigratedBy",
        "Value": "AWS-MGN"
      }]
    }]
  }' \
  --region $AWS_REGION
```

## Verification Checklist

- [ ] MGN service initialized successfully
- [ ] CloudFormation stack deployed without errors
- [ ] VPC and subnets created
- [ ] Security groups configured
- [ ] IAM roles and policies created
- [ ] MGN access keys retrieved and saved
- [ ] Replication configuration template updated
- [ ] MGN console accessible

## Common Issues

### Issue 1: Service Not Available in Region
**Error:** `Service not available in this region`
**Solution:** MGN is available in most regions. Check [AWS Regional Services](https://aws.amazon.com/about-aws/global-infrastructure/regional-product-services/)

### Issue 2: Insufficient Permissions
**Error:** `User is not authorized to perform: mgn:InitializeService`
**Solution:** Ensure your IAM user/role has `AWSApplicationMigrationFullAccess` policy

### Issue 3: Stack Creation Failed
**Error:** `CREATE_FAILED` status
**Solution:** Check CloudFormation events for specific error:
```bash
aws cloudformation describe-stack-events \
  --stack-name mgn-prerequisites \
  --query 'StackEvents[?ResourceStatus==`CREATE_FAILED`]' \
  --output table
```

## Cost Estimate

**For this lab:**
- MGN Service: Free for first 90 days per source server
- VPC/Subnets: Free
- Security Groups: Free
- IAM Roles: Free

**Total: $0** (assuming no servers migrated yet)

## Clean Up (Do NOT run until all labs complete)

```bash
# Delete CloudFormation stack
aws cloudformation delete-stack \
  --stack-name mgn-prerequisites \
  --region $AWS_REGION

# Deinitialize MGN (optional, removes all MGN data)
# aws mgn delete-replication-configuration-template --replication-configuration-template-id rct-xxxxx
```

## Next Steps

Proceed to **Lab 2: Migrate a Server** where you'll:
- Deploy a source server
- Install MGN agent
- Monitor replication
- Test the migration

## Additional Resources

- [MGN Documentation](https://docs.aws.amazon.com/mgn/)
- [MGN Best Practices](https://docs.aws.amazon.com/mgn/latest/ug/best-practices.html)
- [MGN Pricing](https://aws.amazon.com/application-migration-service/pricing/)

---

**Lab Complete!** ✅

You've successfully set up AWS MGN infrastructure. The service is now ready to replicate and migrate servers.
