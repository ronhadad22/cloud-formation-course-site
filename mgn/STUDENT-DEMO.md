# AWS MGN Student Demo - Simple Guide

## What You'll Learn

Migrate a server from "on-premises" to AWS using AWS Application Migration Service (MGN).

**Time:** 30-45 minutes  
**Cost:** Less than $1

---

## Prerequisites

✅ AWS Account  
✅ AWS CLI configured  
✅ EC2 Key Pair created

---

## Step 1: Setup (5 minutes)

### Clone the Repository

```bash
# Clone the course repository
git clone https://github.com/ronhadad22/cloud-formation-course-site.git

# Navigate to the repository
cd cloud-formation-course-site

# Switch to the release branch
git checkout release

# Navigate to MGN directory
cd mgn
```

### Login to AWS

Choose the method that matches your AWS setup:

---

**Option 1: Configure AWS CLI with Access Keys (First Time Setup)**

If you haven't configured AWS CLI before, run:

```bash
aws configure
```

You will be prompted for:
```
AWS Access Key ID: YOUR_ACCESS_KEY
AWS Secret Access Key: YOUR_SECRET_KEY
Default region name: us-east-1
Default output format: json
```

---

**Option 2: Using Environment Variables (Mac/Linux):**
```bash
export AWS_ACCESS_KEY_ID=YOUR_ACCESS_KEY
export AWS_SECRET_ACCESS_KEY=YOUR_SECRET_KEY
export AWS_REGION=us-east-1
```

**Option 2: Using Environment Variables (Windows PowerShell):**
```powershell
$env:AWS_ACCESS_KEY_ID = "YOUR_ACCESS_KEY"
$env:AWS_SECRET_ACCESS_KEY = "YOUR_SECRET_KEY"
$env:AWS_REGION = "us-east-1"
```

---

**Option 3: Using SSO Profile (if your organization uses AWS SSO)**

Mac/Linux:
```bash
aws sso login --profile YOUR_PROFILE_NAME
export AWS_PROFILE=YOUR_PROFILE_NAME
export AWS_REGION=us-east-1
```

Windows PowerShell:
```powershell
aws sso login --profile YOUR_PROFILE_NAME
$env:AWS_PROFILE = "YOUR_PROFILE_NAME"
$env:AWS_REGION = "us-east-1"
```

---

**Verify your login:**
```bash
aws sts get-caller-identity
```

You should see your account ID and user ARN.

### Initialize MGN Service

```bash
# This activates MGN in your account (one-time setup)
aws mgn initialize-service --region us-east-1
```

### Deploy Infrastructure

```bash
# This creates VPC, subnets, and security groups
aws cloudformation create-stack \
  --stack-name mgn-prerequisites \
  --template-body file://cloudformation/mgn-prerequisites.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --region us-east-1

# Wait 2-3 minutes for completion
aws cloudformation wait stack-create-complete \
  --stack-name mgn-prerequisites \
  --region us-east-1

echo "✅ Infrastructure ready!"
```

### Get Your Credentials

```bash
# Get and save MGN agent credentials
MGN_ACCESS_KEY=$(aws cloudformation describe-stacks \
  --stack-name mgn-prerequisites \
  --region us-east-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`MGNAgentAccessKeyId`].OutputValue' \
  --output text)

MGN_SECRET_KEY=$(aws cloudformation describe-stacks \
  --stack-name mgn-prerequisites \
  --region us-east-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`MGNAgentSecretAccessKey`].OutputValue' \
  --output text)

# Display credentials
echo "Access Key: $MGN_ACCESS_KEY"
echo "Secret Key: $MGN_SECRET_KEY"

# Save to file for reference
cat > mgn-credentials.txt << EOF
MGN Agent Credentials
=====================
Access Key: $MGN_ACCESS_KEY
Secret Key: $MGN_SECRET_KEY

Use these when installing the MGN agent in Step 3.
EOF

echo "✅ Credentials saved to mgn-credentials.txt"
```

**💾 Your credentials are now saved in `mgn-credentials.txt`**

---

## Step 2: Create Source Server (5 minutes)

This creates a "fake on-premises" server with a web application.

```bash
# Replace 'your-key-name' with your actual EC2 key pair name
aws cloudformation create-stack \
  --stack-name mgn-source \
  --template-body file://cloudformation/source-server-simulator.yaml \
  --parameters ParameterKey=KeyPairName,ParameterValue=your-key-name \
  --capabilities CAPABILITY_NAMED_IAM \
  --region us-east-1

# Wait for server to be ready
aws cloudformation wait stack-create-complete \
  --stack-name mgn-source \
  --region us-east-1

# Get the server's IP address
SOURCE_IP=$(aws cloudformation describe-stacks \
  --stack-name mgn-source \
  --query 'Stacks[0].Outputs[?OutputKey==`SourceServerPublicIP`].OutputValue' \
  --output text \
  --region us-east-1)

echo "✅ Source server ready at: $SOURCE_IP"
```

### Test the Web Application

Open in your browser:
```
http://<SOURCE_IP>
```

You should see a purple page with "Source Server - MGN Demo" 🎉

---

## Step 3: Install MGN Agent (10 minutes)

### SSH to Source Server

```bash
ssh -i ~/.ssh/your-key.pem ec2-user@$SOURCE_IP
```

### Download MGN Agent

```bash
# Download the agent installer
wget -O ./aws-replication-installer-init.py \
  https://aws-application-migration-service-us-east-1.s3.us-east-1.amazonaws.com/latest/linux/aws-replication-installer-init.py
```

### Install Agent

```bash
# Use the credentials from Step 1 (saved in mgn-credentials.txt)
# Replace with your actual Access Key and Secret Key
sudo python3 aws-replication-installer-init.py \
  --region us-east-1 \
  --aws-access-key-id YOUR_ACCESS_KEY_FROM_STEP_1 \
  --aws-secret-access-key YOUR_SECRET_KEY_FROM_STEP_1
```

**💡 Tip:** You can view your credentials anytime:
```bash
cat ~/path/to/mgn-credentials.txt
```

**Expected output:**
```
AWS Replication Agent installation started
Installing replication agent...
Agent installation completed successfully
Starting replication...
Replication started successfully
```

### Exit SSH

```bash
exit
```

---

## Step 4: Monitor Replication (15 minutes)

### Check Status with Script

```bash
# Make script executable
chmod +x scripts/check-replication-status.sh

# Run monitoring script
./scripts/check-replication-status.sh
```

**What you'll see:**
- 🟡 `INITIAL_SYNC` - First-time copying data (10-20 minutes)
- 🟢 `CONTINUOUS_SYNC` - Ready for migration! (lag < 10 seconds)

### Or Check in AWS Console

1. Open: https://console.aws.amazon.com/mgn/home?region=us-east-1
2. Click **Source servers**
3. You should see your server replicating!

**Wait until status shows `CONTINUOUS_SYNC` before proceeding.**

---

## Step 5: Test Migration (5 minutes)

### Launch Test Instance

1. In MGN Console, select your source server
2. Click **Test and Cutover** → **Launch test instance**
3. Wait 5-10 minutes for instance to launch
4. Get the test instance IP from the console

### Verify Migration

Open the test instance IP in your browser:
```
http://<TEST_INSTANCE_IP>
```

You should see the **same purple page** - your app has been migrated! 🎉

---

## Step 6: Cleanup (5 minutes)

**Important:** Delete resources to avoid charges!

```bash
# Run cleanup script
./scripts/cleanup.sh

# Or manually delete stacks
aws cloudformation delete-stack --stack-name mgn-source --region us-east-1
aws cloudformation delete-stack --stack-name mgn-prerequisites --region us-east-1
```

---

## What You Learned

✅ How to initialize AWS MGN  
✅ How to install the MGN replication agent  
✅ How replication works (initial sync → continuous sync)  
✅ How to test a migration before cutover  
✅ The complete migration workflow

---

## Troubleshooting

### Agent Installation Fails - "Installation failed" during sync

**Problem:** Agent installs but fails at "Syncing the source server with the Application Migration Service Console"

**Solution:**
This is usually an IAM permissions issue. The credentials need additional permissions.

**If you deployed the stack before [DATE]**, update it:
```bash
aws cloudformation update-stack \
  --stack-name mgn-prerequisites \
  --template-body file://cloudformation/mgn-prerequisites.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --region us-east-1

# Wait for update
aws cloudformation wait stack-update-complete \
  --stack-name mgn-prerequisites \
  --region us-east-1
```

Then retry the agent installation with the same credentials.

### Agent Installation Fails - "Failed to register with MGN service"

**Problem:** Cannot connect to MGN service

**Solution:**
- Check your credentials are correct
- Verify source server has internet access (port 443 outbound)
- Make sure MGN is initialized: `aws mgn describe-replication-configuration-templates --region us-east-1`
- Check security group allows outbound HTTPS

### Server Not Showing in Console

**Solution:**
- Wait 2-3 minutes after agent installation
- Refresh the console
- Check agent is running: `sudo systemctl status aws-replication-agent`

### Replication Stuck at INITIAL_SYNC

**Solution:**
- This is normal for first-time sync
- Wait 10-20 minutes for a 10GB disk
- Check network connectivity

---

## Key Concepts

**MGN Agent:** Software installed on source server that replicates data to AWS

**Replication Server:** AWS automatically creates this to receive your data

**Staging Area:** Temporary storage where replicated data lives

**Test Instance:** A copy of your server for testing before final cutover

**Cutover:** The final step where you switch from source to migrated server

---

## Cost Breakdown

- MGN Service: **FREE** for first 90 days per server
- Source server (t3.micro): **~$0.01/hour**
- Replication server (t3.small): **~$0.02/hour**
- Total for demo: **< $1.00**

---

## Next Steps

Want to learn more?

- Read full documentation in `README.md`
- Try Lab 3 for advanced testing
- Practice with your own servers
- Learn about cutover procedures

---

**Questions?** Ask your instructor!

**Need help?** Check `docs/` folder for detailed guides.
