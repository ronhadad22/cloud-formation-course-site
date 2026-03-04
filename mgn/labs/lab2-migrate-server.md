# Lab 2: Migrate a Server with AWS MGN

## Objective
Deploy a source server, install the MGN replication agent, and monitor the replication process.

## Duration
60-90 minutes (includes replication time)

## Prerequisites
- Completed Lab 1 (MGN service initialized)
- EC2 key pair created
- MGN access credentials from Lab 1

## Lab Architecture

```
┌─────────────────────────┐         ┌──────────────────────────┐
│   Source VPC            │         │   Target VPC (MGN)       │
│   (172.16.0.0/16)       │         │   (10.0.0.0/16)          │
│                         │         │                          │
│  ┌──────────────────┐   │         │  ┌────────────────────┐  │
│  │ Source Server    │───┼────────▶│  │ Replication Server │  │
│  │ - Apache Web App │   │ Agent   │  │ (Auto-created)     │  │
│  │ - Sample Data    │   │         │  │                    │  │
│  └──────────────────┘   │         │  └────────────────────┘  │
│                         │         │           │              │
└─────────────────────────┘         │           ▼              │
                                    │  ┌────────────────────┐  │
                                    │  │ Target Instance    │  │
                                    │  │ (After Cutover)    │  │
                                    │  └────────────────────┘  │
                                    └──────────────────────────┘
```

## Lab Steps

### Step 1: Deploy Source Server

Create a source server that simulates an on-premises server:

```bash
cd /path/to/cloudformation/mgn

# Deploy source server
aws cloudformation create-stack \
  --stack-name mgn-source-server \
  --template-body file://cloudformation/source-server-simulator.yaml \
  --parameters \
    ParameterKey=KeyPairName,ParameterValue=your-key-pair-name \
    ParameterKey=InstanceType,ParameterValue=t3.micro \
  --region us-east-1

# Wait for completion
aws cloudformation wait stack-create-complete \
  --stack-name mgn-source-server \
  --region us-east-1

echo "Source server deployed!"
```

### Step 2: Get Source Server Details

```bash
# Get source server public IP
SOURCE_IP=$(aws cloudformation describe-stacks \
  --stack-name mgn-source-server \
  --query 'Stacks[0].Outputs[?OutputKey==`SourceServerPublicIP`].OutputValue' \
  --output text \
  --region us-east-1)

# Get instance ID
SOURCE_INSTANCE_ID=$(aws cloudformation describe-stacks \
  --stack-name mgn-source-server \
  --query 'Stacks[0].Outputs[?OutputKey==`SourceServerInstanceId`].OutputValue' \
  --output text \
  --region us-east-1)

echo "Source Server IP: $SOURCE_IP"
echo "Instance ID: $SOURCE_INSTANCE_ID"

# Test web application
curl http://$SOURCE_IP
```

### Step 3: Verify Source Server Web Application

Open in browser:
```
http://<SOURCE_IP>
```

You should see a purple gradient page with "Source Server - MGN Demo" title.

### Step 4: SSH to Source Server

```bash
# SSH to source server
ssh -i your-key.pem ec2-user@$SOURCE_IP

# Once connected, verify the server
hostname
df -h
cat /home/ec2-user/mgn-instructions.txt
```

### Step 5: Download MGN Agent

On the source server:

```bash
# Download MGN replication agent
wget -O ./aws-replication-installer-init.py \
  https://aws-application-migration-service-us-east-1.s3.us-east-1.amazonaws.com/latest/linux/aws-replication-installer-init.py

# Verify download
ls -lh aws-replication-installer-init.py
```

### Step 6: Install MGN Agent

**Option A: Using Access Keys (Recommended for this lab)**

Use the access keys from Lab 1:

```bash
sudo python3 aws-replication-installer-init.py \
  --region us-east-1 \
  --aws-access-key-id YOUR_ACCESS_KEY_FROM_LAB1 \
  --aws-secret-access-key YOUR_SECRET_KEY_FROM_LAB1
```

**Option B: Using IAM Role (If configured)**

```bash
sudo python3 aws-replication-installer-init.py \
  --region us-east-1 \
  --no-prompt
```

**Installation Process:**
1. Agent validates credentials
2. Registers server with MGN
3. Installs replication software
4. Starts initial sync

**Expected Output:**
```
AWS Replication Agent installation started
Identifying volumes for replication...
Found 1 volume(s) to replicate
Installing replication agent...
Agent installation completed successfully
Starting replication...
Replication started successfully
```

### Step 7: Verify Agent Installation

On source server:

```bash
# Check agent status
sudo systemctl status aws-replication-agent

# View agent logs
sudo tail -f /var/log/aws-replication-agent.log
```

Exit SSH (Ctrl+D) and return to your workstation.

### Step 8: Monitor Replication from AWS CLI

From your workstation:

```bash
# List source servers
aws mgn describe-source-servers --region us-east-1

# Get detailed status
aws mgn describe-source-servers \
  --region us-east-1 \
  --query 'items[*].[sourceServerID,lifeCycle.state,dataReplicationInfo.dataReplicationState]' \
  --output table
```

**Replication States:**
- `INITIAL_SYNC` - First-time data replication
- `CONTINUOUS_SYNC` - Ongoing replication (ready for testing)
- `STALLED` - Replication issue (check logs)

### Step 9: Monitor Replication in Console

1. Open MGN Console: https://console.aws.amazon.com/mgn/
2. Click on **Source servers**
3. Find your server (hostname will match source server)
4. Click on server to see details

**Key Metrics to Monitor:**
- **Replication progress**: Percentage complete
- **Lag**: Time difference between source and replica
- **Last snapshot**: When last data sync occurred
- **Replication server**: Auto-created EC2 instance handling replication

### Step 10: Wait for Initial Sync

Initial sync time depends on:
- Source disk size
- Network bandwidth
- Change rate on source

**Typical times:**
- 10 GB disk: 10-20 minutes
- 50 GB disk: 30-60 minutes
- 100 GB disk: 1-2 hours

**Check progress:**
```bash
# Run this script to monitor
watch -n 30 'aws mgn describe-source-servers \
  --region us-east-1 \
  --query "items[*].[sourceServerID,dataReplicationInfo.dataReplicationState,dataReplicationInfo.lagDuration]" \
  --output table'
```

### Step 11: Verify Replication Server

MGN automatically creates replication servers:

```bash
# List replication servers (they have specific tags)
aws ec2 describe-instances \
  --filters "Name=tag:AWSApplicationMigrationServiceManaged,Values=true" \
  --query 'Reservations[*].Instances[*].[InstanceId,InstanceType,State.Name,Tags[?Key==`Name`].Value|[0]]' \
  --output table \
  --region us-east-1
```

**Replication Server Characteristics:**
- Automatically created by MGN
- Runs in staging subnet
- Instance type: t3.small (default)
- Has EBS volumes matching source disks
- Managed by AWS (don't modify!)

### Step 12: Generate Activity on Source Server

While replication is ongoing, create some changes:

```bash
# SSH back to source server
ssh -i your-key.pem ec2-user@$SOURCE_IP

# Create test files
echo "Test file created at $(date)" > /tmp/test-file-1.txt
sudo sh -c 'echo "Another test at $(date)" > /var/www/html/test.txt'

# Modify web content
sudo sh -c 'echo "<p>Last modified: $(date)</p>" >> /var/www/html/index.html'

# Exit
exit
```

These changes will be replicated to AWS!

### Step 13: Check Replication Lag

```bash
# Check lag (should be < 10 seconds when ready for cutover)
aws mgn describe-source-servers \
  --region us-east-1 \
  --query 'items[*].dataReplicationInfo.lagDuration' \
  --output text
```

**Lag Interpretation:**
- `< 10 seconds`: Excellent, ready for cutover
- `10-60 seconds`: Good, acceptable for most workloads
- `> 60 seconds`: Check network bandwidth or source change rate

### Step 14: Review Source Server Details in Console

In MGN Console, click on your source server and review:

**Server Information:**
- Hostname
- Operating System
- IP addresses
- Disks and volumes

**Replication Status:**
- Data replication state
- Replication progress
- Last snapshot time
- Lag duration

**Launch Settings:**
- Target instance type
- Target subnet
- Security groups
- IAM role

## Verification Checklist

- [ ] Source server deployed successfully
- [ ] Web application accessible on source server
- [ ] MGN agent installed without errors
- [ ] Source server appears in MGN console
- [ ] Replication state is `CONTINUOUS_SYNC`
- [ ] Replication lag is < 10 seconds
- [ ] Replication server auto-created
- [ ] Test files created on source

## Troubleshooting

### Issue 1: Agent Installation Fails

**Error:** `Failed to register with MGN service`

**Solutions:**
1. Verify credentials are correct
2. Check source server has internet access
3. Verify security group allows outbound HTTPS (443)
4. Check MGN service is initialized: `aws mgn describe-replication-configuration-templates`

### Issue 2: Replication Stalled

**Error:** Replication state shows `STALLED`

**Solutions:**
1. Check source server connectivity
2. Verify replication server is running
3. Check security group allows port 1500
4. Review agent logs: `sudo tail -f /var/log/aws-replication-agent.log`

### Issue 3: High Replication Lag

**Symptom:** Lag > 60 seconds consistently

**Solutions:**
1. Check network bandwidth
2. Reduce change rate on source if possible
3. Consider larger replication server instance type
4. Enable bandwidth throttling if needed

### Issue 4: Source Server Not Appearing in Console

**Solutions:**
1. Wait 2-3 minutes after agent installation
2. Refresh MGN console
3. Verify region is correct
4. Check agent is running: `sudo systemctl status aws-replication-agent`

## Cost Tracking

**Current costs:**
- Source server (t3.micro): ~$0.01/hour
- Replication server (t3.small): ~$0.02/hour
- EBS volumes (staging): ~$0.10/GB/month
- Data transfer: First 100 GB free

**Estimated cost for this lab:** ~$0.50 - $1.00

## Key Learnings

1. **MGN Agent is lightweight**: Minimal performance impact on source
2. **Replication is continuous**: Changes are replicated in real-time
3. **Replication servers are managed**: AWS handles infrastructure
4. **Initial sync takes time**: Plan accordingly for production migrations
5. **Lag matters**: Lower lag = less data loss during cutover

## Next Steps

Proceed to **Lab 3: Testing** where you'll:
- Launch a test instance
- Verify application functionality
- Compare source and target
- Practice rollback

---

**Lab Complete!** ✅

Your source server is now being replicated to AWS. The data is continuously syncing, and you're ready to test the migration!
