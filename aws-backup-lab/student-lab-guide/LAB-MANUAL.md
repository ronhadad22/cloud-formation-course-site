# AWS Backup Disaster Recovery Lab

## 🏥 The Story

You are the **Cloud Operations Engineer** at **MedCare General Hospital**. The hospital runs a critical healthcare application on AWS that manages:

- **Patient records** (stored on EFS)
- **Medical images** - X-rays, MRIs, CT scans (stored on EFS)
- **Billing records and logs** (stored on S3)
- **Application configurations** (stored on EFS)

The hospital's CISO has mandated a **disaster recovery plan** using AWS Backup. Your job is to:

1. Explore the existing infrastructure
2. **Build** the backup architecture from scratch (vaults, plans, selections)
3. Run on-demand backups
4. Survive disaster scenarios
5. Restore all data and validate recovery

**⚠️ This is a training simulation. No real patient data is used.**

---

## Learning Objectives

By the end of this lab, you will be able to:

- ✅ Explore a multi-service AWS environment (EC2, EFS, S3)
- ✅ **Create** AWS Backup vaults from scratch (+ optional air-gapped vault)
- ✅ **Create** a KMS key for backup encryption
- ✅ **Create** an IAM role for AWS Backup
- ✅ **Create** a backup plan with daily and weekly rules
- ✅ **Configure** tag-based backup selection
- ✅ Run on-demand backups for EC2, EFS, and S3
- ✅ Respond to disaster scenarios (human error, ransomware)
- ✅ Restore resources from AWS Backup recovery points
- ✅ Validate data integrity after restoration
- ✅ Explain RPO, RTO, and backup lifecycle concepts

**Time:** 60-90 minutes  
**Cost:** < $1

---

## Prerequisites

✅ AWS Account with admin access  
✅ AWS CLI configured  
✅ EC2 Key Pair created in your chosen region  
✅ Python 3 installed (for dataset generator)  
✅ SSH client available

---

## Phase 1: Deploy Infrastructure & Load Data (15 minutes)

### Step 1.1: Clone and Setup

```bash
git clone https://github.com/ronhadad22/cloud-formation-course-site.git
cd cloud-formation-course-site
git checkout release
cd aws-backup-lab
```

### Step 1.2: Set Your Region

```bash
# Set this ONCE — all commands and scripts will use it
export AWS_REGION=us-east-1
```

> **Change `us-east-1` to your preferred region if needed (e.g., `eu-west-1`, `us-east-2`).**

### Step 1.3: Deploy Infrastructure Stack

```bash
# Replace 'your-key-name' with your EC2 key pair name
aws cloudformation create-stack \
  --stack-name backup-lab \
  --template-body file://cloudformation/01-infrastructure.yaml \
  --parameters ParameterKey=KeyPairName,ParameterValue=your-key-name \
  --capabilities CAPABILITY_NAMED_IAM

# Wait for completion (3-5 minutes)
aws cloudformation wait stack-create-complete \
  --stack-name backup-lab

echo "✅ Infrastructure deployed!"
```

### Step 1.4: Load Sample Data

```bash
cd dataset-generator
python3 generate_data.py

# Get EC2 IP
EC2_IP=$(aws cloudformation describe-stacks --stack-name backup-lab \
  --query 'Stacks[0].Outputs[?OutputKey==`AppServerPublicIP`].OutputValue' --output text)

chmod +x upload_to_efs.sh upload_to_s3.sh
./upload_to_efs.sh $EC2_IP ~/.ssh/your-key.pem
./upload_to_s3.sh
cd ..
```

### Step 1.5: Get Stack Outputs

```bash
aws cloudformation describe-stacks \
  --stack-name backup-lab \
  --query 'Stacks[0].Outputs' \
  --output table
```

**Save these values — you'll need them throughout the lab:**
- `AppServerPublicIP`
- `S3BucketName`
- `EFSFileSystemId`
- `AppServerInstanceId`

### Step 1.6: Verify the Application

```bash
# Check the web server
curl http://APP_SERVER_PUBLIC_IP

# SSH into the app server
ssh -i ~/.ssh/your-key.pem ec2-user@APP_SERVER_PUBLIC_IP

# Check EFS data
echo "=== EFS Data ==="
find /mnt/efs/hospital-data -type f | wc -l
du -sh /mnt/efs/hospital-data/*

exit

# Check S3 data
aws s3 ls s3://BUCKET_NAME/ --recursive --summarize | tail -2
```

> **Q1:** How many total files are on EFS? How many objects are in S3? What types of data does the hospital store?

### Step 1.7: Check What Resources Exist

```bash
# List resources tagged for backup
aws resourcegroupstaggingapi get-resources \
  --tag-filters Key=Backup,Values=true \
  --query 'ResourceTagMappingList[].ResourceARN' \
  --output table
```

> **Q2:** How many resources are tagged `Backup=true`? What types are they? (EC2, EFS, S3)

> **Q3:** Right now, are these resources actually being backed up? (Hint: check AWS Backup console — are there any vaults or plans?)

---

## Phase 2: Build the Backup Architecture (25 minutes)

The hospital has infrastructure and data but **NO backup protection**. The CISO wants you to build it. You'll create everything from scratch.

### Step 2.1: Create a KMS Key for Backup Encryption

All backup data must be encrypted. Create a customer-managed KMS key:

1. Go to the **KMS Console** in your region
2. Click **Create key**
3. Key type: **Symmetric**
4. Key usage: **Encrypt and decrypt**
5. Alias: `backup-lab-key`
6. Key administrator: your IAM user/role
7. Key usage permissions: your IAM user/role
8. Click **Finish**

Or via CLI:

```bash
KMS_KEY_ID=$(aws kms create-key \
  --description "Backup Lab Encryption Key" \
  --query 'KeyMetadata.KeyId' --output text)

aws kms create-alias \
  --alias-name alias/backup-lab-key \
  --target-key-id $KMS_KEY_ID

echo "KMS Key ID: $KMS_KEY_ID"
```

> **Q4:** Why do we use a customer-managed KMS key instead of the default AWS-managed key?

### Step 2.2: Create the Primary Backup Vault

1. Go to the **AWS Backup Console** in your region
2. Click **Backup vaults** → **Create backup vault**
3. Name: `backup-lab-primary-vault`
4. Encryption key: select `backup-lab-key`
5. Click **Create backup vault**

Or via CLI:

```bash
aws backup create-backup-vault \
  --backup-vault-name backup-lab-primary-vault \
  --encryption-key-arn arn:aws:kms:${AWS_REGION}:$(aws sts get-caller-identity --query Account --output text):key/$KMS_KEY_ID
```

Now add an **access policy** to prevent accidental deletion of recovery points:

```bash
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

aws backup put-backup-vault-access-policy \
  --backup-vault-name backup-lab-primary-vault \
  --policy "{
    \"Version\": \"2012-10-17\",
    \"Statement\": [{
      \"Sid\": \"DenyDeleteRecoveryPoints\",
      \"Effect\": \"Deny\",
      \"Principal\": \"*\",
      \"Action\": [
        \"backup:DeleteRecoveryPoint\",
        \"backup:UpdateRecoveryPointLifecycle\"
      ],
      \"Resource\": \"*\",
      \"Condition\": {
        \"StringNotEquals\": {
          \"aws:PrincipalArn\": \"arn:aws:iam::${ACCOUNT_ID}:root\"
        }
      }
    }]
  }"
```

> **Q5:** What does the access policy above do? Who can still delete recovery points?

### Step 2.3: (Optional) Create a Logically Air-Gapped Vault

> **⚠️ This step is optional.** The vault lock enforces a minimum 7-day retention — recovery points cannot be deleted before that, even by admins. Skip this if you want a simpler cleanup.

This vault provides **immutable** backup protection — even admins can't delete recovery points before the retention period.

1. In the Backup console, click **Create backup vault**
2. Name: `backup-lab-airgapped-vault`
3. Encryption key: select `backup-lab-key`
4. Click **Create backup vault**

Now **lock** the vault:

```bash
aws backup put-backup-vault-lock-configuration \
  --backup-vault-name backup-lab-airgapped-vault \
  --min-retention-days 7 \
  --max-retention-days 365
```

> **Q6:** What is the difference between the primary vault's access policy and the air-gapped vault's lock configuration? Which one is stronger?

### Step 2.4: Create an IAM Role for AWS Backup

AWS Backup needs an IAM role to access your resources:

```bash
# Create the role with trust policy for backup.amazonaws.com
aws iam create-role \
  --role-name BackupLabRole \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "backup.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

# Attach the AWS managed backup policies
aws iam attach-role-policy --role-name BackupLabRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForBackup

aws iam attach-role-policy --role-name BackupLabRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForRestores

aws iam attach-role-policy --role-name BackupLabRole \
  --policy-arn arn:aws:iam::aws:policy/AWSBackupServiceRolePolicyForS3Backup

aws iam attach-role-policy --role-name BackupLabRole \
  --policy-arn arn:aws:iam::aws:policy/AWSBackupServiceRolePolicyForS3Restore

BACKUP_ROLE="arn:aws:iam::${ACCOUNT_ID}:role/BackupLabRole"
echo "Backup Role ARN: $BACKUP_ROLE"
```

> **Q7:** Why does AWS Backup need its own IAM role? What principle of security does this follow?

### Step 2.5: Create a Backup Plan

The hospital CISO has issued the following **backup requirements**. Your job is to design a backup plan that meets them.

#### CISO Requirements

| Requirement | Details |
|-------------|---------|
| **Patient Records (EFS)** | RPO: 24 hours. Must be recoverable within 1 hour (RTO). Retain daily backups for at least 7 days. |
| **Medical Images (EFS)** | RPO: 24 hours. Same EFS file system as patient records — covered by the same backup. |
| **Billing & Logs (S3)** | RPO: 24 hours. Retain for at least 7 days. S3 versioning is enabled but backups are still required for point-in-time recovery. |
| **Application Server (EC2)** | RPO: 24 hours. Must be recoverable within 30 minutes (RTO). Retain for at least 7 days. |
| **Backup Window** | All backups must run during off-hours: between **02:00–10:00 UTC**. |
| **Encryption** | All backups must be encrypted with the customer-managed KMS key you created. |
| **Immutability (Optional)** | If you created the air-gapped vault, add a weekly rule that stores backups there with 30-day retention. |

#### Your Task

Based on the requirements above, create a backup plan:

1. Go to **Backup plans** → **Create backup plan**
2. Choose **Build a new plan**
3. Design the plan name, rules, schedule, vault, and lifecycle to meet the CISO requirements

**Hints:**
- You need at least **one rule** that covers the daily RPO requirement
- Think about which vault each rule should target
- A cron expression like `cron(0 2 * * ? *)` means "every day at 02:00 UTC"
- A cron expression like `cron(0 3 ? * 1 *)` means "every Sunday at 03:00 UTC"
- `StartWindowMinutes` is how long AWS Backup waits before starting the job
- `CompletionWindowMinutes` is the maximum time allowed for the job to finish
- Use the CLI `aws backup create-backup-plan --backup-plan '{...}'` or the console

> **Q8:** What RPO does your plan achieve? What is the worst-case data loss scenario?

> **Q9:** How does your plan meet the CISO's encryption requirement?

Save the **Backup Plan ID** from the output — you'll need it in the next step.

### Step 2.6: Create a Backup Selection (Tag-Based)

Tell the backup plan **which resources** to protect:

```bash
BACKUP_PLAN_ID="<paste-your-backup-plan-id-here>"

aws backup create-backup-selection \
  --backup-plan-id $BACKUP_PLAN_ID \
  --backup-selection '{
    "SelectionName": "TagBasedSelection",
    "IamRoleArn": "arn:aws:iam::'$ACCOUNT_ID':role/BackupLabRole",
    "ListOfTags": [{
      "ConditionType": "STRINGEQUALS",
      "ConditionKey": "Backup",
      "ConditionValue": "true"
    }]
  }'
```

Or in the console:
1. In your backup plan, click **Assign resources**
2. Resource assignment name: `TagBasedSelection`
3. IAM role: `BackupLabRole`
4. Under **Resource selection**: choose **Include specific resource types** → select by tag
5. Tag key: `Backup`, Tag value: `true`

> **Q10:** What happens if a new EC2 instance is launched with the tag `Backup=true`? Does the backup plan need to be updated?

### Step 2.7: Verify Your Backup Architecture

```bash
# List vaults
aws backup list-backup-vaults \
  --query 'BackupVaultList[].BackupVaultName' --output table

# List backup plans
aws backup list-backup-plans \
  --query 'BackupPlansList[].{Name:BackupPlanName,Id:BackupPlanId}' --output table

# Check vault lock on air-gapped vault (only if you created it)
aws backup describe-backup-vault \
  --backup-vault-name backup-lab-airgapped-vault
```

> **Q11:** Confirm you have at least 1 vault, 1 backup plan with at least 1 rule, and 1 tag-based selection. If you created the air-gapped vault, is it locked?

---

## Phase 3: Run On-Demand Backups (10 minutes)

Now that your backup architecture is in place, let's create recovery points before simulating disasters.

### Step 3.1: Get Resource ARNs

```bash
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
BACKUP_ROLE="arn:aws:iam::${ACCOUNT_ID}:role/BackupLabRole"

INSTANCE_ID=$(aws cloudformation describe-stacks \
  --stack-name backup-lab \
  --query 'Stacks[0].Outputs[?OutputKey==`AppServerInstanceId`].OutputValue' --output text)

EFS_ID=$(aws cloudformation describe-stacks \
  --stack-name backup-lab \
  --query 'Stacks[0].Outputs[?OutputKey==`EFSFileSystemId`].OutputValue' --output text)

BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name backup-lab \
  --query 'Stacks[0].Outputs[?OutputKey==`S3BucketName`].OutputValue' --output text)
```

### Step 3.2: Start Backup Jobs

```bash
# EC2
aws backup start-backup-job \
  --backup-vault-name backup-lab-primary-vault \
  --resource-arn arn:aws:ec2:${AWS_REGION}:${ACCOUNT_ID}:instance/${INSTANCE_ID} \
  --iam-role-arn $BACKUP_ROLE
echo "✅ EC2 backup started"

# EFS
aws backup start-backup-job \
  --backup-vault-name backup-lab-primary-vault \
  --resource-arn arn:aws:elasticfilesystem:${AWS_REGION}:${ACCOUNT_ID}:file-system/${EFS_ID} \
  --iam-role-arn $BACKUP_ROLE
echo "✅ EFS backup started"

# S3
aws backup start-backup-job \
  --backup-vault-name backup-lab-primary-vault \
  --resource-arn arn:aws:s3:::${BUCKET_NAME} \
  --iam-role-arn $BACKUP_ROLE
echo "✅ S3 backup started"
```

### Step 3.3: Monitor Backup Jobs

```bash
# Watch backup jobs (run every 30 seconds)
watch -n 30 'aws backup list-backup-jobs \
  --by-state RUNNING \
  --query "BackupJobs[].{Resource:ResourceType,Status:State,Pct:PercentDone}" \
  --output table'
```

Wait for all jobs to complete (5-15 minutes). Then verify:

```bash
aws backup list-recovery-points-by-backup-vault \
  --backup-vault-name backup-lab-primary-vault \
  --query 'RecoveryPoints[].{Type:ResourceType,Created:CreationDate,Status:Status}' \
  --output table
```

> **Q12:** How many recovery points are in the vault? What types of resources were backed up?

---

## Phase 4: Disaster Scenarios 💥

**⚠️ Make sure all backups from Phase 3 are COMPLETED before proceeding!**

### Scenario 1: Human Error — File Deletion

**The Story:** A junior admin ran a cleanup script that accidentally deleted patient records and medical images from EFS.

```bash
cd ../disaster-simulations
chmod +x *.sh

# Run the disaster
./01-human-error.sh APP_SERVER_PUBLIC_IP ~/.ssh/your-key.pem
```

> **Q13:** SSH into the server. How many patient files remain? How many medical images?

**Your Task:** Restore the EFS file system from the backup recovery point.

**Hints:**
1. Go to **AWS Backup** → **Backup vaults** → `backup-lab-primary-vault`
2. Find the EFS recovery point
3. Click **Restore** 
4. Choose to restore to the same EFS file system
5. Select a restore directory (e.g., `/aws-backup-restore`)

```bash
# After restore, check the restored files on EC2:
ssh -i ~/.ssh/your-key.pem ec2-user@APP_SERVER_PUBLIC_IP
ls /mnt/efs/aws-backup-restore/
# Copy restored files back:
sudo cp -r /mnt/efs/aws-backup-restore/hospital-data/* /mnt/efs/hospital-data/
```

> **Q14:** Were all files restored? Compare the count before and after.

---

### Scenario 2: Ransomware Attack 🔒 

**The Story:** A phishing email led to ransomware infiltrating the system. Files are "encrypted" and ransom notes appear everywhere. The web server is defaced.

```bash
./03-ransomware.sh APP_SERVER_PUBLIC_IP ~/.ssh/your-key.pem
```

Check the damage:
```bash
# Check the web server
curl http://APP_SERVER_PUBLIC_IP

# SSH in and check files
ssh -i ~/.ssh/your-key.pem ec2-user@APP_SERVER_PUBLIC_IP
find /mnt/efs/hospital-data -name "*.encrypted" | head -10
find /mnt/efs/hospital-data -name "RANSOM_NOTE.txt"
cat /mnt/efs/hospital-data/patients/RANSOM_NOTE.txt
```

> **Q15:** How many files were "encrypted"? How many ransom notes were dropped?

**Your Task:** This is a critical incident. You need to:
1. Restore EFS from the air-gapped vault (if you created it) or primary vault
2. Restore the EC2 instance (to fix the defaced web server)
3. Verify no ransomware artifacts remain

---

### Scenario 3: Backup Deletion Attempt 

**The Story:** The attacker realizes you have backups and tries to delete them.

```bash
./04-backup-deletion-attempt.sh
```

> **Q16:** Were the attacker's deletion attempts successful? Why or why not?

> **Q17:** What is the difference between the primary vault's access policy and the air-gapped vault's lock configuration? (Answer even if you skipped the air-gapped vault)

---

## Phase 5: Validate Recovery (5 minutes)

After restoring from all disasters, run the validation tool:

```bash
cd ../validation-tools
chmod +x validate_restore.sh
./validate_restore.sh APP_SERVER_PUBLIC_IP ~/.ssh/your-key.pem BUCKET_NAME
```

> **Q18:** What is your recovery score? Which checks passed and which failed?

---

## Phase 6: Investigation Questions

Answer these questions based on your experience:

> **Q19:** What is RTO (Recovery Time Objective)? How long did it take you to restore each resource type?

> **Q20:** If you needed to add cross-region copy to your backup plan, how would you do it? When would you need this?

> **Q21:** If you needed to reduce RPO from 24 hours to 1 hour, what would you change in the backup plan?

---

## Phase 7: Cleanup ⚠️

**Important:** Delete everything to avoid charges!

```bash
# 1. Delete recovery points from primary vault
VAULT="backup-lab-primary-vault"
for RP in $(aws backup list-recovery-points-by-backup-vault \
  --backup-vault-name $VAULT \
  --query 'RecoveryPoints[].RecoveryPointArn' --output text 2>/dev/null); do
  echo "Deleting: $RP"
  aws backup delete-recovery-point \
    --backup-vault-name $VAULT \
    --recovery-point-arn $RP 2>/dev/null || true
done

# 2. Delete backup plan
BACKUP_PLAN_ID=$(aws backup list-backup-plans \
  --query 'BackupPlansList[?BackupPlanName==`backup-lab-daily-plan`].BackupPlanId' --output text)
aws backup delete-backup-plan --backup-plan-id $BACKUP_PLAN_ID 2>/dev/null || true

# 3. Delete backup vaults
aws backup delete-backup-vault --backup-vault-name backup-lab-primary-vault 2>/dev/null || true
# If you created the air-gapped vault — it may not be deletable due to lock, that's expected!
aws backup delete-backup-vault --backup-vault-name backup-lab-airgapped-vault 2>/dev/null || true

# 4. Delete IAM role
for POLICY in AWSBackupServiceRolePolicyForBackup AWSBackupServiceRolePolicyForRestores AWSBackupServiceRolePolicyForS3Backup AWSBackupServiceRolePolicyForS3Restore; do
  aws iam detach-role-policy --role-name BackupLabRole \
    --policy-arn arn:aws:iam::aws:policy/service-role/$POLICY 2>/dev/null || \
  aws iam detach-role-policy --role-name BackupLabRole \
    --policy-arn arn:aws:iam::aws:policy/$POLICY 2>/dev/null || true
done
aws iam delete-role --role-name BackupLabRole 2>/dev/null || true

# 5. Empty S3 bucket and delete infrastructure stack
BUCKET=$(aws cloudformation describe-stacks \
  --stack-name backup-lab \
  --query 'Stacks[0].Outputs[?OutputKey==`S3BucketName`].OutputValue' --output text)
aws s3 rm s3://$BUCKET --recursive

aws cloudformation delete-stack --stack-name backup-lab
aws cloudformation wait stack-delete-complete --stack-name backup-lab

# 6. Delete KMS key (schedule for deletion)
KEY_ID=$(aws kms list-aliases \
  --query 'Aliases[?AliasName==`alias/backup-lab-key`].TargetKeyId' --output text)
aws kms schedule-key-deletion --key-id $KEY_ID --pending-window-in-days 7 2>/dev/null || true

echo "✅ All resources deleted!"
```

---

## Answer Key

<details>
<summary>Click to reveal answers (try on your own first!)</summary>

**Q1:** ~90+ files on EFS (50 patients + 20 images + billing + logs + configs). ~15+ objects in S3. Data types: patient JSON records, DICOM medical images, billing CSVs, application logs, YAML configs.

**Q2:** At least 3 resources: EC2 instance, EFS file system, S3 bucket.

**Q3:** No! The resources are tagged `Backup=true` but there are no backup vaults or plans yet. Tags alone don't create backups.

**Q4:** Customer-managed keys give you full control over key rotation, access policies, and deletion. The default AWS-managed key can't be customized.

**Q5:** The policy denies `backup:DeleteRecoveryPoint` and `backup:UpdateRecoveryPointLifecycle` for all principals except root. This prevents accidental or malicious deletion of recovery points.

**Q6:** Access policy is a resource-based IAM policy that can be modified by authorized users. Vault lock is immutable once applied — even the account root cannot change it during the lock period. The lock is stronger.

**Q7:** Least privilege principle. AWS Backup only gets the specific permissions it needs to read/write backup data, not full admin access.

**Q8:** RPO is ~24 hours. Worst case: disaster at 01:59 UTC means you lose almost 24 hours of data since the last backup at 02:00 UTC. A valid plan has a daily rule running at 02:00 UTC targeting the primary vault with 7-day retention. Optionally, a weekly rule to the air-gapped vault with 30-day retention.

**Q9:** The backup vault (`backup-lab-primary-vault`) was created with the customer-managed KMS key `backup-lab-key`. All recovery points stored in that vault are automatically encrypted with that key.

**Q10:** No update needed! Tag-based selection automatically includes any new resource with `Backup=true`. This is the main advantage over resource-based selection.

**Q11:** You should see at least 1 vault (primary), 1 plan with at least 1 rule, and 1 tag-based selection. If you created the air-gapped vault, it should show `Locked: true`.

**Q12:** 3 recovery points (one per resource type): EC2, EFS, S3.

**Q13:** 0 patient JSON files, 0 medical images. The disaster script deleted them.

**Q14:** Yes, all files should be restored from the EFS backup recovery point.

**Q15:** All files in patients/, configs/, billing/, logs/ were renamed to .encrypted. Ransom notes in 5 directories.

**Q16:** No! The vault access policy (primary) blocked the deletion attempts. If you created the air-gapped vault, its vault lock also blocked them.

**Q17:** Access policy can be modified by authorized users. Vault lock is immutable — even root can't change it. The air-gapped vault provides stronger protection against ransomware.

**Q18:** Aim for 100% — all checks should pass after full recovery.

**Q19:** RTO varies: EFS restore ~5-10 min, EC2 restore ~10-15 min, S3 restore ~5 min.

**Q20:** Add a `CopyActions` section to the backup rule specifying a destination vault in us-west-2. Needed for region-wide outages.

**Q21:** Change the backup schedule from daily to hourly: `cron(0 * * * ? *)`.

</details>

---

## What You Learned

✅ **Created** KMS keys, backup vaults, IAM roles, backup plans, and selections from scratch  
✅ AWS Backup centralizes backup management across EC2, EFS, and S3  
✅ Backup vaults store recovery points with encryption and access policies  
✅ (Optional) Logically air-gapped vaults provide **immutable** backup protection  
✅ Tag-based selection automatically includes new resources  
✅ Different disaster types require different recovery strategies  
✅ RPO and RTO are critical metrics for disaster recovery planning  
✅ Validation after restore is essential to confirm data integrity

---

## Cost Breakdown

| Resource | Cost |
|----------|------|
| EC2 (t3.small) | ~$0.02/hour |
| EFS | ~$0.01 (minimal data) |
| S3 | ~$0.00 (minimal data) |
| AWS Backup storage | ~$0.05/GB/month |
| KMS | ~$0.00 (free tier) |
| **Total for 1-hour lab** | **~$0.05** |

**⚠️ Delete all resources when done!**

---

**Questions?** Ask your instructor!
