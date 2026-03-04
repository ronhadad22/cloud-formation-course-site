# AWS Elastic Disaster Recovery (DRS) Lab

A hands-on lab where students deploy a payment processing application, set up AWS DRS for continuous replication across regions, simulate a regional disaster, and perform failover/failback.

## Architecture

```
SOURCE (eu-central-1)              TARGET (eu-west-1)
┌──────────────┐                   ┌──────────────┐
│  PayFlow App │   Continuous      │  DRS Staging │
│  (EC2)       │───Replication────▶│  Area        │
└──────────────┘   (block-level)   └──────┬───────┘
                                          │ On Failover
                                   ┌──────▼───────┐
                                   │  Recovery    │
                                   │  Instance    │
                                   └──────────────┘
```

## Lab Duration

~2 hours

## What Students Learn

- Deploy source infrastructure via CloudFormation
- Initialize AWS DRS in a target region
- Install the DRS replication agent
- Monitor continuous block-level replication
- Perform a recovery drill (non-disruptive)
- Simulate a regional disaster and failover
- Validate application integrity after failover
- Compare DRS (sub-second RPO) vs AWS Backup (24h RPO)
- DR strategies: pilot light, warm standby, multi-site

## Prerequisites

- AWS account with admin access
- AWS CLI configured
- SSH key pairs in both source and target regions

## Quick Start

```bash
# 1. Set environment
export SOURCE_REGION=eu-central-1
export TARGET_REGION=eu-west-1

# 2. Create key pairs in both regions
aws ec2 create-key-pair --key-name drs-lab-key --query 'KeyMaterial' \
  --output text --region $SOURCE_REGION > drs-lab-key-source.pem && chmod 400 drs-lab-key-source.pem

aws ec2 create-key-pair --key-name drs-lab-key --query 'KeyMaterial' \
  --output text --region $TARGET_REGION > drs-lab-key-target.pem && chmod 400 drs-lab-key-target.pem

# 3. Deploy source infrastructure (PayFlow app)
aws cloudformation create-stack \
  --stack-name drs-lab \
  --template-body file://cloudformation/01-source-infrastructure.yaml \
  --parameters ParameterKey=KeyPairName,ParameterValue=drs-lab-key \
  --capabilities CAPABILITY_NAMED_IAM \
  --region $SOURCE_REGION

# 4. Deploy target infrastructure (DRS staging VPC/subnet)
aws cloudformation create-stack \
  --stack-name drs-lab-target \
  --template-body file://cloudformation/02-target-infrastructure.yaml \
  --region $TARGET_REGION

# 5. Follow the student lab manual
# See student-lab-guide/LAB-MANUAL.md
```

## Project Structure

```
aws-drs-lab/
├── README.md
├── cloudformation/
│   ├── 01-source-infrastructure.yaml   # PayFlow app (EC2, VPC, SG) — deploy to eu-central-1
│   └── 02-target-infrastructure.yaml   # DRS staging VPC, subnet, SG — deploy to eu-west-1
├── scripts/
│   ├── check-replication-status.sh     # Monitor DRS replication
│   ├── simulate-disaster.sh            # Stop source to simulate outage
│   └── validate-failover.sh            # Validate recovered app
└── student-lab-guide/
    └── LAB-MANUAL.md                   # Full step-by-step lab manual
```

## Estimated Cost

| Resource | Cost |
|----------|------|
| Source EC2 (t3.small) | ~$0.02/hr |
| DRS replication | ~$0.028/hr/server |
| Staging area | ~$0.02/hr |
| Recovery instance | ~$0.02/hr (during drill/failover only) |
| **Total for 2-hour lab** | **~$0.20** |

**⚠️ Clean up after the lab!** DRS charges continuously while replication is active.

## Troubleshooting

- **DRS agent install fails:** Ensure the IAM user has `AWSElasticDisasterRecoveryAgentInstallationPolicy` and the target region is correct.
- **Replication stuck in INITIATING:** Check security groups allow outbound HTTPS (443) from the source server.
- **Recovery instance has no public IP:** Edit the EC2 launch template in DRS to enable auto-assign public IP.
- **Can't SSH to recovery instance:** Ensure the launch template has the correct key pair for the target region.
- **Web server not responding after failover:** SSH in and run `sudo systemctl start httpd`.
