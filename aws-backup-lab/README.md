# AWS Backup Disaster Recovery Simulation Lab

## Overview

A complete AWS Backup training platform that simulates a **healthcare application environment**. The instructor deploys infrastructure (EC2, EFS, S3) and loads sample data. **Students build the entire backup architecture from scratch** (KMS key, vaults, IAM role, backup plan, selection), then survive disaster scenarios and validate recovery.

**⚠️ This is for training and simulation only. No real patient data is used.**

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        AWS Backup                                │
│  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │  Primary Vault   │  │ Air-Gapped Vault │  │ Cross-Region  │  │
│  │  (KMS Encrypted) │  │ (Locked/Immutable│  │ Copy (us-west │  │
│  │                  │  │  7-365 day lock) │  │ -2)           │  │
│  └────────┬─────────┘  └────────┬─────────┘  └───────────────┘  │
│           │                     │                                │
│  ┌────────┴─────────────────────┴──────────────────────┐        │
│  │              Backup Plans                            │        │
│  │  Daily (02:00 UTC, 7-day retention)                  │        │
│  │  Weekly (Sunday, 30-day retention, air-gapped)       │        │
│  │  Selection: Tag Backup=true                          │        │
│  └──────────────────────┬──────────────────────────────┘        │
└─────────────────────────┼───────────────────────────────────────┘
                          │ Protects
          ┌───────────────┼───────────────────┐
          │               │                   │
    ┌─────┴─────┐  ┌─────┴──────┐  ┌────────┴────────┐
    │    EC2     │  │    EFS     │  │       S3        │
    │ App Server │  │  Patient   │  │  Logs & Billing │
    │ (t3.small) │  │  Files     │  │                 │
    └───────────┘  └────────────┘  └─────────────────┘
```

---

## Project Structure

```
aws-backup-lab/
├── README.md                              # This file
├── cloudformation/
│   ├── 01-infrastructure.yaml             # VPC, EC2, EFS, S3
│   └── 02-backup.yaml                     # Vaults, plans, selections, KMS (answer key / reference)
├── dataset-generator/
│   ├── generate_data.py                   # Generate fake medical data
│   ├── upload_to_efs.sh                   # Upload data to EFS
│   └── upload_to_s3.sh                    # Upload data to S3
├── disaster-simulations/
│   ├── 01-human-error.sh                  # Delete patient files from EFS
│   ├── 03-ransomware.sh                   # Simulate ransomware attack
│   └── 04-backup-deletion-attempt.sh      # Try to delete backups
├── validation-tools/
│   └── validate_restore.sh                # Verify restore integrity
└── student-lab-guide/
    └── LAB-MANUAL.md                      # Step-by-step student exercise
```

---

## Quick Start (Instructor)

### 1. Deploy Infrastructure + Load Data

```bash
# Set your region (change if needed)
export AWS_REGION=us-east-1

aws cloudformation create-stack \
  --stack-name backup-lab \
  --template-body file://cloudformation/01-infrastructure.yaml \
  --parameters ParameterKey=KeyPairName,ParameterValue=YOUR_KEY \
  --capabilities CAPABILITY_NAMED_IAM

cd dataset-generator
python3 generate_data.py
chmod +x upload_to_efs.sh upload_to_s3.sh
aws cloudformation describe-stacks --stack-name backup-lab \
  --query 'Stacks[0].Outputs[?OutputKey==`AppServerPublicIP`].OutputValue' --output text

./upload_to_efs.sh <THE_IP_FROM_ABOVE> ~/.ssh/<key pair name>.pem
./upload_to_s3.sh
```

### 2. Students Follow LAB-MANUAL.md

Students will:
1. Explore the infrastructure
2. **Build** backup architecture (KMS, vaults, IAM role, plan, selection)
3. Run on-demand backups
4. Survive disaster scenarios
5. Restore and validate

`02-backup.yaml` is the **answer key** — do not deploy it.

---

## Disaster Scenarios

| # | Scenario | Severity | What Happens | Recovery Method |
|---|----------|----------|-------------|------------------|
| 1 | Human Error | Medium | Patient files deleted from EFS | EFS restore from backup |
| 2 | Ransomware | Critical | Files "encrypted", web defaced | Restore from air-gapped vault |
| 3 | Backup Deletion | Critical | Attacker tries to delete backups | Vault policies block deletion |

All scripts are **safe** — they create local backups before destruction and support rollback.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `permission denied: ./script.sh` | Run `chmod +x *.sh` in the script directory first |
| `SSL: CERTIFICATE_VERIFY_FAILED` | Run `export AWS_CA_BUNDLE=/opt/homebrew/lib/python3.14/site-packages/certifi/cacert.pem` |
| `No module named 'yaml'` | Not needed — `generate_data.py` uses only built-in Python modules |
| `externally-managed-environment` (pip) | Not needed — no pip installs required |
| `No such file or directory` on template | Make sure you're in the `aws-backup-lab/` directory |
| Stack creation fails | Check key pair exists in your region: `aws ec2 describe-key-pairs` |
| `watch` command not found (Mac) | Install with `brew install watch`, or re-run the command manually |
| SSH `Permission denied (publickey)` | Check key path and that you're using `ec2-user@` as the username |
| EFS mount not ready on EC2 | Wait 2 minutes after stack creation, then SSH in |
| Can't delete air-gapped vault | Expected! Vault lock prevents deletion before retention period |

---

## Key Concepts Taught

- AWS Backup vaults, plans, and selections
- Logically air-gapped vaults (immutable backups)
- KMS encryption for backup data
- Tag-based automatic resource selection
- Cross-region backup copy
- On-demand vs scheduled backups
- Backup lifecycle (warm → cold → delete)
- RPO and RTO concepts
- Disaster recovery procedures
- Post-restore validation

---

## Cost Estimate

| Resource | Hourly Cost |
|----------|-------------|
| EC2 (t3.small) | $0.02 |
| EFS, S3, KMS | ~$0.00 |
| Backup storage | ~$0.05/GB/month |
| **Total** | **~$0.03/hour** |

**⚠️ Delete all resources when done!**

---

## Cleanup

Students clean up their own backup resources (vaults, plans, IAM role, KMS key).
Instructor deletes the infrastructure stack:

```bash
# Empty S3 and delete recovery points first, then:
aws cloudformation delete-stack --stack-name backup-lab
```

See `student-lab-guide/LAB-MANUAL.md` Phase 7 for detailed cleanup steps.
