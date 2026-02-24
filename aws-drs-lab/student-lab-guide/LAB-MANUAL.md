# AWS Elastic Disaster Recovery (DRS) Lab

## Scenario: PayFlow Payment Processing

**PayFlow** is a fintech startup processing thousands of payment transactions daily. Their payment gateway runs in a single AWS region. After a recent compliance audit, the CISO has mandated:

- **RPO < 1 second** — near-zero data loss
- **RTO < 15 minutes** — full recovery within 15 minutes
- **Automated failover** capability to a secondary region
- **Regular DR drills** to prove recovery works

Traditional backups (RPO ~24 hours) don't meet these requirements. Your job is to implement **AWS Elastic Disaster Recovery (DRS)** to achieve near-zero RPO with sub-15-minute RTO.

**⚠️ This is a training simulation. No real financial data is used.**

---

## Learning Objectives

By the end of this lab, you will be able to:

- ✅ Deploy a source application in one AWS region
- ✅ Initialize AWS DRS in a target (recovery) region
- ✅ Install the DRS replication agent on a source server
- ✅ Monitor continuous block-level replication
- ✅ Perform a recovery drill without impacting the source
- ✅ Simulate a regional disaster and perform failover
- ✅ Validate application integrity after failover
- ✅ Compare DRS (near-zero RPO) vs AWS Backup (24h RPO)
- ✅ Explain DR strategies: pilot light, warm standby, multi-site

---

## DR Strategy Comparison

Before we start, understand where DRS fits among DR strategies:

| Strategy | RPO | RTO | Cost | Example |
|----------|-----|-----|------|---------|
| **Backup & Restore** | Hours | Hours | $ | AWS Backup (previous lab) |
| **Pilot Light** | Minutes | 10-30 min | $$ | Minimal infra in standby region |
| **Warm Standby** | Seconds | Minutes | $$$ | Scaled-down copy running |
| **Multi-Site Active/Active** | Near-zero | Near-zero | $$$$ | Full duplicate in both regions |
| **AWS DRS** | Sub-second | ~15 min | $$ | Continuous replication, on-demand recovery |

AWS DRS provides **pilot light** level cost with **warm standby** level RPO/RTO — the best value for most workloads.

---

## Architecture Overview

```
SOURCE REGION (eu-central-1)          TARGET REGION (eu-west-1)
┌─────────────────────┐               ┌─────────────────────┐
│  PayFlow App Server │               │  AWS DRS Service    │
│  ┌───────────────┐  │   Continuous  │  ┌───────────────┐  │
│  │ EC2 Instance  │──│───Replication─│──│ Staging Area  │  │
│  │ (t3.small)    │  │   (encrypted) │  │ (lightweight) │  │
│  └───────────────┘  │               │  └───────────────┘  │
│  ┌───────────────┐  │               │                     │
│  │ App Data      │  │               │  On Failover:       │
│  │ /opt/payflow  │  │               │  ┌───────────────┐  │
│  └───────────────┘  │               │  │ Recovery EC2  │  │
│  ┌───────────────┐  │               │  │ (full copy)   │  │
│  │ Web Server    │  │               │  └───────────────┘  │
│  │ (httpd)       │  │               │                     │
│  └───────────────┘  │               └─────────────────────┘
└─────────────────────┘
```

**Key concept:** DRS continuously replicates block-level data from source to a lightweight **staging area** in the target region. On failover, it launches a full EC2 instance from the replicated data.

---

## Prerequisites

- AWS account with admin access
- AWS CLI configured (`aws configure` or SSO)
- SSH key pair created in **both** regions
- Two regions available (this lab uses `eu-central-1` as source, `eu-west-1` as target)

---

## Phase 1: Deploy Source Infrastructure (15 minutes)

### Step 1.1: Set Environment Variables

```bash
export AWS_REGION=eu-central-1
export AWS_PROFILE=<your-profile>
export SOURCE_REGION=eu-central-1
export TARGET_REGION=eu-west-1
```

### Step 1.2: Create Key Pairs

You need a key pair in **both** regions:

```bash
# Source region key pair (skip if you already have one)
aws ec2 create-key-pair \
  --key-name drs-lab-key \
  --query 'KeyMaterial' --output text \
  --region $SOURCE_REGION > drs-lab-key-source.pem
chmod 400 drs-lab-key-source.pem

# Target region key pair
aws ec2 create-key-pair \
  --key-name drs-lab-key \
  --query 'KeyMaterial' --output text \
  --region $TARGET_REGION > drs-lab-key-target.pem
chmod 400 drs-lab-key-target.pem
```

### Step 1.3: Deploy Both Stacks

You need to deploy **two** CloudFormation stacks — one in each region:

**Stack 1 — Source region (`eu-central-1`):** deploys the PayFlow EC2 app

```bash
aws cloudformation create-stack \
  --stack-name drs-lab \
  --template-body file://cloudformation/01-source-infrastructure.yaml \
  --parameters ParameterKey=KeyPairName,ParameterValue=drs-lab-key \
  --capabilities CAPABILITY_NAMED_IAM \
  --region $SOURCE_REGION

aws cloudformation wait stack-create-complete \
  --stack-name drs-lab \
  --region $SOURCE_REGION
```

**Stack 2 — Target region (`eu-west-1`):** creates the VPC and subnet for the DRS staging area

```bash
aws cloudformation create-stack \
  --stack-name drs-lab-target \
  --template-body file://cloudformation/02-target-infrastructure.yaml \
  --region $TARGET_REGION

aws cloudformation wait stack-create-complete \
  --stack-name drs-lab-target \
  --region $TARGET_REGION
```

> **Why two stacks?** The source stack deploys the application being protected. The target stack creates the dedicated VPC where DRS will run its staging area (replication servers, conversion servers). Without this, you'd have to use an unrelated default VPC.

### Step 1.4: Get Stack Outputs

```bash
aws cloudformation describe-stacks \
  --stack-name drs-lab \
  --region $SOURCE_REGION \
  --query 'Stacks[0].Outputs' --output table

aws cloudformation describe-stacks \
  --stack-name drs-lab-target \
  --region $TARGET_REGION \
  --query 'Stacks[0].Outputs' --output table
```

Save these values:

```bash
SOURCE_IP=$(aws cloudformation describe-stacks \
  --stack-name drs-lab \
  --region $SOURCE_REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`AppServerPublicIP`].OutputValue' --output text)

SOURCE_INSTANCE=$(aws cloudformation describe-stacks \
  --stack-name drs-lab \
  --region $SOURCE_REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`AppServerInstanceId`].OutputValue' --output text)

STAGING_SUBNET=$(aws cloudformation describe-stacks \
  --stack-name drs-lab-target \
  --region $TARGET_REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`StagingSubnetId`].OutputValue' --output text)

STAGING_SG=$(aws cloudformation describe-stacks \
  --stack-name drs-lab-target \
  --region $TARGET_REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`DRSStagingSecurityGroupId`].OutputValue' --output text)

RECOVERY_SG=$(aws cloudformation describe-stacks \
  --stack-name drs-lab-target \
  --region $TARGET_REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`RecoveryInstanceSecurityGroupId`].OutputValue' --output text)

echo "Source IP:       $SOURCE_IP"
echo "Source Instance: $SOURCE_INSTANCE"
echo "Staging Subnet:  $STAGING_SUBNET"
echo "Staging SG:      $STAGING_SG"
echo "Recovery SG:     $RECOVERY_SG"
```

### Step 1.5: Verify the Application

```bash
# Test the web app
curl http://$SOURCE_IP

# Test the health API
curl http://$SOURCE_IP/api/health | jq .

# Test the transactions API
curl http://$SOURCE_IP/api/transactions | jq .
```

> **Q1:** What region is the PayFlow app running in? What would happen if this entire region went down?

### Step 1.6: SSH and Explore the Server

```bash
ssh -i drs-lab-key-source.pem ec2-user@$SOURCE_IP

# Check app data
ls -la /opt/payflow/data/
cat /opt/payflow/config/app.json | jq .
wc -l /opt/payflow/logs/transactions.log

exit
```

> **Q2:** How much data does the PayFlow app have? What would be lost in a disaster without DR?

---

## Phase 2: Initialize AWS DRS (15 minutes)

### Step 2.1: Initialize DRS in the Target Region (Console)

AWS DRS must be initialized in the **target** (recovery) region before you can replicate servers. This must be done manually through the AWS Console — it walks you through a 6-step wizard that creates all the required IAM roles, instance profiles, and default replication settings.

**⚠️ Make sure you are in the `eu-west-1` region before starting.**

1. Open the [AWS DRS Console](https://eu-west-1.console.aws.amazon.com/drs/home?region=eu-west-1) in **`eu-west-1`**
2. Click **Set up Elastic Disaster Recovery**

The wizard has 6 steps — go through each and use the defaults unless noted:

**Step 1 — Set up replication servers:**
- **Staging area subnet:** select the subnet named **`drs-lab-staging-subnet`** (from the `drs-lab-target` CloudFormation stack you deployed in Step 1.3 — use the value of `$STAGING_SUBNET`)
- **Replication server instance type:** `t3.small`
- **Service access:** review the note — DRS will create a service-linked role to access EC2, KMS, and IAM on your behalf. Click **View details** to see what it creates.
- Click **Next**

**Step 2 — Specify volumes and security groups:**
- **Replication server security groups:** select the security group named **`drs-lab-drs-staging-sg`** (from the `drs-lab-target` stack — use the value of `$STAGING_SG`). This SG already has ports 443 and 1500 open for replication traffic.
- **EBS volume type:** GP3
- Click **Next**

**Step 3 — Configure additional replication settings:**
- **Data routing:** Public IP
- Leave all other defaults
- Click **Next**

**Step 4 — Set default DRS launch settings:**
- Leave defaults
- Click **Next**

**Step 5 — Set default EC2 launch template:**
- **Subnet:** select `drs-lab-staging-subnet` (from the `drs-lab-target` stack — use `$STAGING_SUBNET`) so recovery instances land in our dedicated VPC
- **Security groups:** select `drs-lab-recovery-instance-sg` (from the `drs-lab-target` stack — use `$RECOVERY_SG`). This allows SSH (22) and HTTP (80) for the recovered PayFlow app.
- **Instance type:** leave as `Using instance type right-sizing`
- **EBS volume type:** leave as `Do not include in this template`
- Click **Next**

**Step 6 — Review and initialize:**
- Review the summary
- Click **Initialize**

Wait for initialization to complete (usually under a minute). You will land on the **Source servers** page, which will be empty — that's expected.

> **Q3:** Why do we initialize DRS in the *target* region and not the source region? What does the service-linked role allow DRS to do?

### Step 2.2: Install the DRS Replication Agent

> **Note:** No IAM credentials are needed. The CloudFormation stack already attached `AWSElasticDisasterRecoveryAgentInstallationPolicy` to the EC2 instance role. The agent will authenticate automatically via the instance metadata service.

SSH into the source server and install the agent:

```bash
ssh -i drs-lab-key-source.pem ec2-user@$SOURCE_IP
```

On the source server:

```bash
# Download the DRS agent installer
wget -O aws-replication-installer-init \
  https://aws-elastic-disaster-recovery-eu-west-1.s3.eu-west-1.amazonaws.com/latest/linux/aws-replication-installer-init

chmod +x aws-replication-installer-init

# Install the agent — uses the EC2 instance role automatically (no keys needed)
sudo ./aws-replication-installer-init \
  --region eu-west-1 \
  --no-prompt
```

```bash
exit
```

> **Q4:** Why is using the EC2 instance role more secure than creating a dedicated IAM user with access keys?

> **Q5:** What does the replication agent do at the block level? How is this different from file-level backup?

### Step 2.3: Monitor Initial Sync

The initial sync copies all disk data to the target region. This takes 5-15 minutes depending on data size.

```bash
# Check replication status (TARGET_REGION must be set — the script checks DRS in eu-west-1)
cd scripts
chmod +x *.sh
AWS_REGION=$TARGET_REGION ./check-replication-status.sh
```

Or via the console:
1. Go to **DRS Console** in `eu-west-1`
2. Click **Source servers**
3. Watch the replication state change:
   - `INITIATING` → `INITIAL_SYNC` → `CONTINUOUS`

Wait until the state is **CONTINUOUS** before proceeding.

```bash
# Poll until ready (check every 30 seconds)
while true; do
  STATE=$(aws drs describe-source-servers \
    --region $TARGET_REGION \
    --query 'items[0].dataReplicationInfo.dataReplicationState' \
    --output text 2>/dev/null)
  echo "$(date +%H:%M:%S) Replication state: $STATE"
  if [ "$STATE" == "CONTINUOUS" ]; then
    echo "✅ Replication is continuous — ready for failover!"
    break
  fi
  sleep 30
done
```

> **Q6:** What is the difference between INITIAL_SYNC and CONTINUOUS replication? What happens to RPO during each phase?

> **Q7:** Look at the DRS console — what resources were created in the target region's staging area?

---

## Phase 3: Configure Recovery Settings (10 minutes)

Before performing a failover, configure how the recovered instance should launch.

### Step 3.1: Get the Source Server ID

```bash
SOURCE_SERVER_ID=$(aws drs describe-source-servers \
  --region $TARGET_REGION \
  --query 'items[0].sourceServerID' \
  --output text)

echo "Source Server ID: $SOURCE_SERVER_ID"
```

### Step 3.2: Review Launch Configuration

```bash
aws drs get-launch-configuration \
  --source-server-id $SOURCE_SERVER_ID \
  --region $TARGET_REGION \
  --output json | jq .
```

### Step 3.3: Update the EC2 Launch Template

The EC2 launch template controls how recovery instances are launched. You need to add a key pair and security group — without these you won't be able to SSH in or access the recovered app.

**Part A — General launch settings:**

1. In the DRS console (`eu-west-1`), go to **Source servers** → click your server
2. Click the **Launch settings** tab
3. Under **General launch settings**, click **Edit**
4. Set:
   - **Instance type right-sizing:** Off (launches with source instance type — t3.small)
   - **Copy private IP:** No
5. Click **Save**

**Part B — EC2 launch template (key pair + security group):**

6. Under **EC2 launch template**, click **Edit** (or click the template link)
7. Click **Create new version**
8. Set the following:
   - **Key pair:** `drs-lab-key` (the key you created in the **target** region — `drs-lab-key-target.pem`)
   - **Security groups:** add `drs-lab-recovery-instance-sg` (use the value of `$RECOVERY_SG` — this SG allows SSH port 22 and HTTP port 80)
   - **Instance type:** `t3.small`
9. Click **Create template version**
10. Set the new version as the **Default version**

> ⚠️ Without the key pair you cannot SSH to the recovery instance. Without the security group the app will be inaccessible.

> **Q8:** Why might you want to change the instance type during failover? When would you keep it the same?

---

## Phase 4: Recovery Drill (15 minutes)

A **recovery drill** launches a test instance in the target region **without affecting** the source server or replication. This is how you validate your DR plan.

### Step 4.1: Initiate a Recovery Drill

1. In the DRS console (`eu-west-1`), go to **Source servers**
2. Select your source server
3. Click **Initiate recovery drill**
4. Confirm the drill

Or via CLI:

```bash
DRILL_JOB=$(aws drs start-recovery \
  --region $TARGET_REGION \
  --is-drill \
  --source-servers sourceServerID=$SOURCE_SERVER_ID \
  --query 'job.jobID' \
  --output text)

echo "Drill Job ID: $DRILL_JOB"
```

### Step 4.2: Monitor the Drill

```bash
# Check drill status
aws drs describe-jobs \
  --region $TARGET_REGION \
  --query 'items[?jobID==`'$DRILL_JOB'`].{Status:status,Type:type,Created:creationDateTime}' \
  --output table
```

Wait for the drill to complete (5-10 minutes). Then find the recovery instance:

```bash
# Get the recovery instance IDs
# DRS recovery instance ID (ri-xxx) — used for DRS operations
DRILL_RECOVERY_ID=$(aws drs describe-recovery-instances \
  --region $TARGET_REGION \
  --query 'items[0].recoveryInstanceID' \
  --output text)

# EC2 instance ID (i-xxx) — used for EC2 operations
DRILL_INSTANCE_ID=$(aws drs describe-recovery-instances \
  --region $TARGET_REGION \
  --query 'items[0].ec2InstanceID' \
  --output text)

DRILL_PUBLIC_IP=$(aws ec2 describe-instances \
  --instance-ids $DRILL_INSTANCE_ID \
  --region $TARGET_REGION \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text)

echo "Drill Instance IP: $DRILL_PUBLIC_IP"
```

### Step 4.3: Validate the Drill

```bash
# Test the recovered app
curl http://$DRILL_PUBLIC_IP
curl http://$DRILL_PUBLIC_IP/api/health | jq .

# Run full validation (run from the aws-drs-lab/ directory)
./scripts/validate-failover.sh $DRILL_PUBLIC_IP drs-lab-key-target.pem
```

> **Q9:** Is the source server still running during the drill? Is replication still active?

> **Q10:** What is the purpose of regular recovery drills? How often should a company run them?

### Step 4.4: Clean Up the Drill

After validating, terminate the drill instance:

1. In the DRS console, go to **Recovery instances**
2. Select the drill instance
3. Click **Actions** → **Disconnect from AWS**
4. Then **Actions** → **Delete recovery instance**

Or via CLI:

```bash
# Disconnect from DRS using the DRS recovery instance ID
aws drs disconnect-recovery-instance \
  --recovery-instance-id $DRILL_RECOVERY_ID \
  --region $TARGET_REGION

# Terminate the EC2 instance using the EC2 instance ID
aws ec2 terminate-instances \
  --instance-ids $DRILL_INSTANCE_ID \
  --region $TARGET_REGION
```

---

## Phase 5: Disaster Simulation & Failover (20 minutes)

### Step 5.1: Simulate a Regional Disaster

```bash
# Run from the aws-drs-lab/ directory
./scripts/simulate-disaster.sh $SOURCE_INSTANCE $SOURCE_REGION
```

Verify the source app is down:

```bash
curl --connect-timeout 5 http://$SOURCE_IP || echo "SOURCE IS DOWN!"
```

> **Q11:** In a real regional outage, would you be able to stop the instance like we did? What would actually happen?

### Step 5.2: Perform Failover

This is the real thing — not a drill.

1. In the DRS console (`eu-west-1`), go to **Source servers**
2. Select your source server
3. Click **Initiate recovery** (not drill this time)
4. Select **Use most recent data**
5. Confirm the failover

Or via CLI:

```bash
FAILOVER_JOB=$(aws drs start-recovery \
  --region $TARGET_REGION \
  --source-servers sourceServerID=$SOURCE_SERVER_ID \
  --query 'job.jobID' \
  --output text)

echo "Failover Job ID: $FAILOVER_JOB"
```

### Step 5.3: Monitor Failover Progress

```bash
# Check job status
aws drs describe-jobs \
  --region $TARGET_REGION \
  --query 'items[?jobID==`'$FAILOVER_JOB'`].{Status:status,Type:type,Participants:participatingServers[0].launchStatus}' \
  --output table
```

Wait for the failover to complete. Then get the recovery instance:

```bash
# Get the EC2 instance ID of the real failover instance (excludes drills)
RECOVERY_INSTANCE=$(aws drs describe-recovery-instances \
  --region $TARGET_REGION \
  --query 'items[?isDrill==`false`] | [-1].ec2InstanceID' \
  --output text)

RECOVERY_IP=$(aws ec2 describe-instances \
  --instance-ids $RECOVERY_INSTANCE \
  --region $TARGET_REGION \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text)

echo "Recovery Instance: $RECOVERY_INSTANCE"
echo "Recovery IP: $RECOVERY_IP"
```

### Step 5.4: Validate Failover

```bash
# Quick check
curl http://$RECOVERY_IP
curl http://$RECOVERY_IP/api/health | jq .

# Full validation (run from the aws-drs-lab/ directory)
./scripts/validate-failover.sh $RECOVERY_IP drs-lab-key-target.pem
```

> **Q12:** How long did the failover take from initiation to a working app? Does this meet the CISO's 15-minute RTO requirement?

> **Q13:** Compare the data on the recovered instance with the source. Is any data missing? What does this tell you about the RPO?

### Step 5.5: Update DNS (Conceptual)

In a real scenario, you would now update DNS to point to the recovery instance:

```bash
# Example (conceptual — not executed in this lab):
# aws route53 change-resource-record-sets \
#   --hosted-zone-id Z1234567890 \
#   --change-batch '{
#     "Changes": [{
#       "Action": "UPSERT",
#       "ResourceRecordSet": {
#         "Name": "payflow.example.com",
#         "Type": "A",
#         "TTL": 60,
#         "ResourceRecords": [{"Value": "'$RECOVERY_IP'"}]
#       }
#     }]
#   }'
```

> **Q14:** Why is DNS failover important? What happens if you skip this step?

---

## Phase 6: Failback (Optional — 15 minutes)

After the source region recovers, you can **failback** — reverse-replicate from the target back to the source.

### Step 6.1: Restart the Source Instance

```bash
aws ec2 start-instances \
  --instance-ids $SOURCE_INSTANCE \
  --region $SOURCE_REGION

aws ec2 wait instance-running \
  --instance-ids $SOURCE_INSTANCE \
  --region $SOURCE_REGION

echo "Source instance is running again."
```

### Step 6.2: Initiate Failback Replication

In the DRS console (`eu-west-1`):
1. Go to **Recovery instances**
2. Select the recovery instance
3. Click **Actions** → **Start failback**
4. This will install a replication agent on the recovery instance to replicate back to the source region

### Step 6.3: Monitor Failback

Wait for failback replication to reach **CONTINUOUS** state, then:
1. Click **Actions** → **Complete failback**
2. This launches the instance in the source region with the latest data

> **Q15:** Why is failback important? What would happen if you just kept running in the target region permanently?

---

## Phase 7: Investigation Questions

Answer these based on your experience:

> **Q16:** Compare AWS DRS vs AWS Backup:
> - What is the RPO of each?
> - What is the RTO of each?
> - What is the cost difference?
> - When would you use each?

> **Q17:** Your company runs 50 servers. The CISO wants DR for all of them. How would you decide which servers need DRS (near-zero RPO) vs AWS Backup (24h RPO)?

> **Q18:** What is the difference between a recovery drill and an actual failover in DRS?

> **Q19:** A compliance auditor asks: "How do you prove your DR plan works?" What evidence would you show them?

---

## Phase 8: Cleanup ⚠️

**Important:** Delete everything to avoid ongoing charges. DRS charges ~$0.028/hr per replicated server.

```bash
# 1. Delete recovery instances in target region
# DRS recovery instance IDs (ri-xxx) needed for disconnect
RECOVERY_DRS_IDS=$(aws drs describe-recovery-instances \
  --region $TARGET_REGION \
  --query 'items[].recoveryInstanceID' --output text)

# EC2 instance IDs (i-xxx) needed for termination
RECOVERY_EC2_IDS=$(aws drs describe-recovery-instances \
  --region $TARGET_REGION \
  --query 'items[].ec2InstanceID' --output text)

for DRS_ID in $RECOVERY_DRS_IDS; do
  aws drs disconnect-recovery-instance \
    --recovery-instance-id $DRS_ID \
    --region $TARGET_REGION 2>/dev/null || true
done

for EC2_ID in $RECOVERY_EC2_IDS; do
  aws ec2 terminate-instances \
    --instance-ids $EC2_ID \
    --region $TARGET_REGION 2>/dev/null || true
done

# 2. Disconnect source servers from DRS
SOURCE_SERVERS=$(aws drs describe-source-servers \
  --region $TARGET_REGION \
  --query 'items[].sourceServerID' --output text)

for SRV in $SOURCE_SERVERS; do
  aws drs disconnect-source-server \
    --source-server-id $SRV \
    --region $TARGET_REGION 2>/dev/null || true
  aws drs delete-source-server \
    --source-server-id $SRV \
    --region $TARGET_REGION 2>/dev/null || true
done

# 3. Delete replication configuration template
TEMPLATE_ID=$(aws drs describe-replication-configuration-templates \
  --region $TARGET_REGION \
  --query 'items[0].replicationConfigurationTemplateID' --output text 2>/dev/null)

if [ "$TEMPLATE_ID" != "None" ] && [ -n "$TEMPLATE_ID" ]; then
  aws drs delete-replication-configuration-template \
    --replication-configuration-template-id $TEMPLATE_ID \
    --region $TARGET_REGION 2>/dev/null || true
fi

# 4. Delete CloudFormation stack (source region)
aws cloudformation delete-stack \
  --stack-name drs-lab \
  --region $SOURCE_REGION

aws cloudformation wait stack-delete-complete \
  --stack-name drs-lab \
  --region $SOURCE_REGION

# 5. Delete CloudFormation stack (target region)
aws cloudformation delete-stack \
  --stack-name drs-lab-target \
  --region $TARGET_REGION

aws cloudformation wait stack-delete-complete \
  --stack-name drs-lab-target \
  --region $TARGET_REGION

# 6. Delete key pairs
aws ec2 delete-key-pair --key-name drs-lab-key --region $SOURCE_REGION 2>/dev/null || true
aws ec2 delete-key-pair --key-name drs-lab-key --region $TARGET_REGION 2>/dev/null || true
rm -f drs-lab-key-source.pem drs-lab-key-target.pem

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "⚠️  Also check the DRS console in $TARGET_REGION for any remaining:"
echo "   - Staging area subnets/security groups"
echo "   - Replication servers"
echo "   These are usually cleaned up automatically, but verify."
```

---

## Answer Key

<details>
<summary>Click to reveal answers (try on your own first!)</summary>

**Q1:** The app runs in eu-central-1. If the entire region went down, the payment processing service would be completely unavailable — no transactions could be processed, causing revenue loss and SLA violations.

**Q2:** The app has transaction data (~5 records), config files, and ~100 lines of logs. In a disaster without DR, all in-flight transactions and recent data would be lost. With only daily backups, up to 24 hours of transactions could be lost.

**Q3:** DRS is initialized in the target region because that's where replicated data is stored and where recovery instances will be launched. The source region only runs the lightweight replication agent. The service-linked role (`AWSServiceRoleForElasticDisasterRecovery`) gives DRS permission to launch and manage EC2 instances (replication servers, conversion servers, recovery instances), manage EBS volumes, and use KMS for encryption — all in the target region on your behalf.

**Q4:** The EC2 instance role is more secure because: no long-lived credentials are stored on disk (reducing the risk of credential theft), permissions are automatically managed by AWS IAM, and access is tied to the instance lifecycle — when the instance is terminated, access is gone. Access keys, by contrast, persist independently and must be manually rotated and revoked.

**Q5:** The replication agent captures block-level changes on the disk (like a continuous snapshot). Unlike file-level backup which copies individual files periodically, block-level replication captures every disk write in near-real-time, achieving sub-second RPO.

**Q6:** During INITIAL_SYNC, all existing disk data is being copied — RPO is undefined (not yet protected). During CONTINUOUS, only new changes are replicated in real-time — RPO is sub-second.

**Q7:** DRS creates a staging area with: a lightweight replication server (t3.small), EBS volumes to store replicated data, a security group, and a subnet. These are minimal-cost resources.

**Q8:** You might upsize during failover if the source was undersized, or downsize to save costs during a temporary DR situation. Keep it the same for production failover to maintain performance characteristics.

**Q9:** Yes! The source server continues running normally during a drill. Replication stays active. The drill creates a separate test instance from the replicated data — it's completely non-disruptive.

**Q10:** Regular drills prove that DR actually works. Companies should run them quarterly at minimum, monthly for critical systems. Drills catch configuration drift, permission issues, and application compatibility problems before a real disaster.

**Q11:** In a real regional outage, you wouldn't be able to interact with the source region at all — no API calls, no console access. The failover decision would be based on monitoring/health checks detecting the outage. AWS DRS handles this because the replication data is already in the target region.

**Q12:** DRS failover typically takes 10-25 minutes. The first failover in a new environment may take longer (up to 30 min) because DRS needs to start and warm up the conversion server. Subsequent failovers are faster. In this lab you likely saw ~15-25 minutes. Whether this meets the 15-minute RTO depends on your exact environment — in a production deployment with a continuously-running staging area, RTO is consistently closer to 15 minutes.

**Q13:** With continuous replication, the recovered instance should have all data up to the moment replication was interrupted. The RPO is typically sub-second — only the last few writes before the outage might be lost.

**Q14:** DNS failover redirects users to the recovery instance. Without it, users would still try to connect to the old (down) IP address. In production, you'd use Route 53 health checks with automatic failover.

**Q15:** Failback is important because: (1) the target region may be more expensive or have less capacity, (2) you want to return to your primary architecture, (3) you need to re-establish DR protection (the target region is now unprotected). Running permanently in the target region means you have no DR if that region also fails.

**Q16:** DRS vs Backup comparison:
- RPO: DRS = sub-second, Backup = 24 hours
- RTO: DRS = ~15 minutes, Backup = 1-4 hours
- Cost: DRS = ~$0.028/hr/server + staging, Backup = ~$0.05/GB/month
- Use DRS for critical apps needing near-zero RPO. Use Backup for less critical data, compliance archives, and cost-sensitive workloads.

**Q17:** Tier your servers: Tier 1 (payment processing, customer-facing) → DRS. Tier 2 (internal tools, batch processing) → Backup. Tier 3 (dev/test) → No DR. Base the decision on business impact of downtime and data loss.

**Q18:** A drill creates a test instance without affecting source replication. A failover is the real thing — it's used during an actual disaster. After failover, you need to re-establish replication (failback) to restore DR protection.

**Q19:** Show the auditor: (1) drill reports with timestamps and success metrics, (2) RTO/RPO measurements from drills, (3) runbook documentation, (4) DRS console showing continuous replication status, (5) automated monitoring alerts for replication lag.

</details>

---

## What You Learned

✅ AWS DRS provides near-zero RPO through continuous block-level replication
✅ DRS staging area is lightweight and cost-effective compared to warm standby
✅ Recovery drills validate DR without impacting production
✅ Failover launches a full instance from replicated data in minutes
✅ Failback restores the original architecture after the source recovers
✅ DRS fits between pilot light and warm standby in the DR strategy spectrum
✅ Different workloads need different DR strategies based on RPO/RTO/cost requirements

---

## Cost Breakdown

| Resource | Cost | Duration |
|----------|------|----------|
| Source EC2 (t3.small) | ~$0.02/hr | Lab duration |
| DRS replication | ~$0.028/hr/server | Lab duration |
| Staging area (replication server) | ~$0.02/hr | Lab duration |
| Staging EBS volumes | ~$0.08/GB/month | Lab duration |
| Recovery instance (during drill/failover) | ~$0.02/hr | ~30 min |
| **Estimated total for 2-hour lab** | **~$0.20** | |

**⚠️ Remember to clean up!** DRS charges continuously while replication is active.
