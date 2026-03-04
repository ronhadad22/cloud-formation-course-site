# AWS Application Migration Service (MGN) - Student Demo Lab

## 🎓 For Students: Start Here!

**New to MGN?** Follow the simplified guide:  
👉 **[STUDENT-DEMO.md](STUDENT-DEMO.md)** - Complete demo in 45 minutes!

**For Instructors:**  
👉 **[INSTRUCTOR-NOTES.md](INSTRUCTOR-NOTES.md)** - Teaching guide and tips

---

## Overview

This directory contains hands-on labs and demonstrations for learning AWS Application Migration Service (MGN), which is AWS's primary service for lift-and-shift migrations of physical, virtual, or cloud servers to AWS.

## What is AWS MGN?

AWS Application Migration Service (MGN) is a highly automated lift-and-shift solution that simplifies, expedites, and reduces the cost of migrating applications to AWS. It allows you to quickly realize the benefits of migrating applications to the cloud without changes and with minimal downtime.

### Key Features

- **Continuous Data Replication**: Real-time replication of source servers to AWS
- **Automated Conversion**: Automatically converts source servers to boot and run natively on AWS
- **Non-Disruptive Testing**: Test migrated servers without impacting source systems
- **Minimal Downtime**: Cutover in minutes with automated orchestration
- **Wide Platform Support**: Supports physical, virtual, and cloud-based servers

## Architecture

```
Source Environment          AWS Cloud
┌─────────────────┐        ┌──────────────────────────────┐
│                 │        │                              │
│  Source Server  │───────▶│  Replication Server (Auto)   │
│  (On-Prem/VM)   │        │  ┌────────────────────────┐  │
│                 │        │  │ Staging Area (Subnet)  │  │
│  MGN Agent      │        │  │ - Replication Disks    │  │
│  Installed      │        │  │ - Data Conversion      │  │
└─────────────────┘        │  └────────────────────────┘  │
                           │           │                   │
                           │           ▼                   │
                           │  ┌────────────────────────┐  │
                           │  │ Target EC2 Instance    │  │
                           │  │ (After Cutover)        │  │
                           │  └────────────────────────┘  │
                           └──────────────────────────────┘
```

## Directory Structure

```
mgn/
├── README.md                          # This file
├── cloudformation/
│   ├── mgn-prerequisites.yaml         # IAM roles, VPC, subnets for MGN
│   ├── source-server-simulator.yaml   # Creates a source server to migrate
│   └── mgn-target-template.yaml       # Launch template for migrated servers
├── docs/
│   ├── 01-getting-started.md          # MGN basics and setup
│   ├── 02-agent-installation.md       # How to install MGN agent
│   ├── 03-replication-process.md      # Understanding replication
│   ├── 04-testing-cutover.md          # Testing and cutover procedures
│   └── 05-troubleshooting.md          # Common issues and solutions
├── labs/
│   ├── lab1-setup-mgn.md              # Lab 1: Initialize MGN
│   ├── lab2-migrate-server.md         # Lab 2: Migrate a test server
│   ├── lab3-testing.md                # Lab 3: Test before cutover
│   └── lab4-cutover.md                # Lab 4: Perform cutover
└── scripts/
    ├── install-agent.sh               # Script to install MGN agent
    ├── check-replication-status.sh    # Monitor replication progress
    └── cleanup.sh                     # Clean up MGN resources
```

## Prerequisites

### AWS Account Requirements

- AWS Account with appropriate permissions
- IAM permissions for MGN, EC2, VPC, and IAM
- VPC with at least one subnet for staging area
- Internet connectivity for replication

### Knowledge Prerequisites

- Basic understanding of EC2 and VPC
- Familiarity with Linux/Windows server administration
- Understanding of networking concepts (subnets, security groups, routing)

## Quick Start

**👉 For a step-by-step beginner-friendly guide, see [STUDENT-DEMO.md](STUDENT-DEMO.md)**

### 1. Initialize MGN Service

```bash
# Set your AWS profile
export AWS_PROFILE=your-profile

# Initialize MGN in your region
aws mgn initialize-service --region us-east-1

# Deploy prerequisites
aws cloudformation create-stack \
  --stack-name mgn-prerequisites \
  --template-body file://cloudformation/mgn-prerequisites.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --region us-east-1
```

### 2. Create a Source Server (For Demo)

```bash
# Deploy a source server to simulate migration
aws cloudformation create-stack \
  --stack-name mgn-source-server \
  --template-body file://cloudformation/source-server-simulator.yaml \
  --region us-east-1
```

### 3. Install MGN Agent

```bash
# SSH to source server
ssh -i your-key.pem ec2-user@source-server-ip

# Download and run installation script
wget -O ./aws-replication-installer-init.py https://aws-application-migration-service-us-east-1.s3.us-east-1.amazonaws.com/latest/linux/aws-replication-installer-init.py

sudo python3 aws-replication-installer-init.py \
  --region us-east-1 \
  --aws-access-key-id YOUR_ACCESS_KEY \
  --aws-secret-access-key YOUR_SECRET_KEY
```

### 4. Monitor Replication

```bash
# Check replication status
aws mgn describe-source-servers --region us-east-1

# Or use the provided script
./scripts/check-replication-status.sh
```

## Learning Path

### Module 1: Understanding MGN (30 minutes)
- Read: `docs/01-getting-started.md`
- Watch: AWS MGN overview video
- Lab: `labs/lab1-setup-mgn.md`

### Module 2: Agent Installation (45 minutes)
- Read: `docs/02-agent-installation.md`
- Lab: `labs/lab2-migrate-server.md`
- Practice: Install agent on different OS types

### Module 3: Replication & Testing (60 minutes)
- Read: `docs/03-replication-process.md`
- Lab: `labs/lab3-testing.md`
- Understand: Replication lag, data consistency

### Module 4: Cutover & Post-Migration (45 minutes)
- Read: `docs/04-testing-cutover.md`
- Lab: `labs/lab4-cutover.md`
- Practice: Rollback procedures

### Module 5: Troubleshooting (30 minutes)
- Read: `docs/05-troubleshooting.md`
- Practice: Common error scenarios

## Key Concepts

### Replication Server
- Automatically created by MGN in your AWS account
- Handles data replication from source to staging area
- Managed by AWS (you don't need to configure it)

### Staging Area
- Temporary subnet where replication occurs
- Contains low-cost disks for replicated data
- Not meant for production use

### Launch Template
- Defines how your target EC2 instance will be configured
- Includes instance type, security groups, IAM roles
- Can be customized per application

### Cutover
- Final step where you switch from source to target
- Stops replication and launches production instance
- Should be planned during maintenance window

### Replication Lag
- Time difference between source and replicated data
- Aim for <10 seconds before cutover
- Affected by network bandwidth and change rate

## Cost Considerations

### MGN Service Costs
- **Free for 90 days** per source server (2160 hours)
- After 90 days: $0.0255/hour per source server (~$18.36/month)

### Infrastructure Costs
- Replication servers (EC2 instances)
- EBS volumes for staging area
- Data transfer costs
- Target EC2 instances after cutover

### Cost Optimization Tips
1. Use appropriate instance types for replication servers
2. Clean up staging resources after successful cutover
3. Use AWS Cost Explorer to monitor MGN costs
4. Batch migrations to maximize 90-day free tier

## Best Practices

1. **Pre-Migration Assessment**
   - Document source server configurations
   - Identify dependencies between servers
   - Plan migration waves

2. **Network Planning**
   - Ensure adequate bandwidth for replication
   - Configure security groups properly
   - Plan for VPN or Direct Connect if needed

3. **Testing**
   - Always test before cutover
   - Validate application functionality
   - Test rollback procedures

4. **Cutover Planning**
   - Schedule during maintenance windows
   - Have rollback plan ready
   - Monitor closely post-cutover

5. **Post-Migration**
   - Optimize instance types and sizes
   - Implement AWS best practices (backups, monitoring)
   - Decommission source servers only after validation

## Common Use Cases

### 1. Data Center Migration
Migrate entire data centers to AWS with minimal downtime.

### 2. Disaster Recovery
Set up AWS as DR site with continuous replication.

### 3. Cloud-to-Cloud Migration
Migrate from other cloud providers to AWS.

### 4. Version Upgrades
Migrate to newer OS versions during the process.

## Support Resources

- **AWS Documentation**: https://docs.aws.amazon.com/mgn/
- **AWS MGN Console**: https://console.aws.amazon.com/mgn/
- **AWS Support**: For technical issues
- **AWS re:Post**: Community Q&A

## Cleanup

After completing the labs, clean up resources to avoid charges:

```bash
# Run cleanup script
./scripts/cleanup.sh

# Or manually delete stacks
aws cloudformation delete-stack --stack-name mgn-source-server
aws cloudformation delete-stack --stack-name mgn-prerequisites

# Remove MGN resources
aws mgn delete-source-server --source-server-id s-xxxxx
```

## Additional Notes

- MGN replaced AWS Server Migration Service (SMS) as the primary migration tool
- MGN is recommended for lift-and-shift migrations
- For application modernization, consider AWS App2Container or refactoring
- MGN supports both Linux and Windows servers

## License

This educational material is provided for learning purposes.

---

**Ready to start?** Begin with `labs/lab1-setup-mgn.md`
