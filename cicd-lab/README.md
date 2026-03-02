# CI/CD Lab — GitHub Actions + Docker + AWS EC2

A hands-on lab where students build a CI/CD pipeline using **GitHub Actions** to automatically build a Docker image, push it to **Amazon ECR**, and deploy it to an **EC2 instance** via SSH.

## Architecture

```
Developer                GitHub Actions               AWS
┌──────────┐   git push   ┌──────────────────┐        ┌─────────────────┐
│  Code    │─────────────▶│  1. Build Docker │        │  ECR Repository │
│  Change  │              │  2. Push to ECR  │───────▶│  cicd-lab-app   │
└──────────┘              │  3. SSH Deploy   │        └─────────────────┘
                          └────────┬─────────┘                │
                                   │ SSH                      │ docker pull
                                   ▼                          ▼
                          ┌──────────────────────────────────────┐
                          │  EC2 Instance (Docker)               │
                          │  ┌────────────────────────────────┐  │
                          │  │  cicd-app container (port 80)  │  │
                          │  └────────────────────────────────┘  │
                          └──────────────────────────────────────┘
```

## What Students Learn

1. **CloudFormation** — VPC, Security Groups, EC2, ECR, IAM roles
2. **Docker** — Building and running containerized apps
3. **Amazon ECR** — Private container registry with lifecycle policies
4. **GitHub Actions** — CI/CD pipeline with build, push, deploy jobs
5. **SSH Deployment** — Deploying containers to EC2 via SSH

## Prerequisites

- AWS account with CLI configured
- GitHub account
- EC2 Key Pair in your region
- Docker installed locally (optional, for local testing)

## Quick Start

### Phase 1: Deploy Infrastructure

```bash
aws cloudformation deploy \
  --stack-name cicd-lab \
  --template-file cloudformation/01-infrastructure.yaml \
  --parameter-overrides KeyPairName=<your-key> \
  --capabilities CAPABILITY_NAMED_IAM \
  --region eu-west-1
```

### Phase 2: Get Stack Outputs

```bash
aws cloudformation describe-stacks \
  --stack-name cicd-lab \
  --query 'Stacks[0].Outputs' --output table
```

### Phase 3: Configure GitHub Secrets

In your GitHub repo → Settings → Secrets and variables → Actions, add:

| Secret | Value |
|--------|-------|
| `AWS_ACCESS_KEY_ID` | IAM user access key (with ECR push + SSM permissions) |
| `AWS_SECRET_ACCESS_KEY` | IAM user secret key |
| `EC2_INSTANCE_ID` | Instance ID from stack outputs (e.g. `i-0abc123...`) |

### Phase 4: Push Code & Watch Pipeline

```bash
git add .
git commit -m "Initial CI/CD pipeline"
git push origin main
```

Go to the **Actions** tab in your GitHub repo to watch the pipeline run.

### Phase 5: Verify

```bash
# Get the app server IP
APP_IP=$(aws cloudformation describe-stacks \
  --stack-name cicd-lab \
  --query 'Stacks[0].Outputs[?OutputKey==`AppServerPublicIP`].OutputValue' --output text)

curl http://$APP_IP
curl http://$APP_IP/api/health | jq .
```

## Project Structure

```
cicd-lab/
├── .github/
│   └── workflows/
│       └── deploy.yml                # GitHub Actions CI/CD pipeline
├── app/
│   ├── Dockerfile                    # Docker build instructions
│   ├── package.json                  # Node.js dependencies
│   └── server.js                     # Simple web application
├── cloudformation/
│   └── 01-infrastructure.yaml        # VPC, SG, EC2, ECR, IAM
└── README.md
```

## Pipeline Flow

```
push to main
    │
    ▼
┌─────────────────────┐
│  build-and-push     │
│  ├─ Checkout code   │
│  ├─ Set version tag │
│  ├─ AWS credentials │
│  ├─ ECR login       │
│  └─ Docker build    │
│     & push to ECR   │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  deploy             │
│  ├─ SSH to EC2      │
│  ├─ Pull new image  │
│  ├─ Restart app     │
│  └─ Health check    │
└─────────────────────┘
```

## Making Changes

To trigger a new deployment, edit `app/server.js` and push:

```bash
# Example: change the greeting
sed -i 's/Hello from the CI\/CD Pipeline!/Version 2 — Updated via CI\/CD!/' app/server.js
git add -A && git commit -m "v2: update greeting" && git push
```

The pipeline will automatically build a new image, push to ECR, and deploy to EC2.

## Manual Trigger

You can also trigger the pipeline manually:
1. Go to **Actions** → **CI/CD Pipeline** → **Run workflow**
2. Optionally set a custom version tag (e.g. `2.0.0`)

## Cleanup

```bash
# Delete the CloudFormation stack
aws cloudformation delete-stack --stack-name cicd-lab --region eu-west-1

# Wait for deletion
aws cloudformation wait stack-delete-complete --stack-name cicd-lab --region eu-west-1
```

## Estimated Cost

| Resource | Type | ~Cost/hr |
|----------|------|----------|
| EC2 | t3.small | $0.021 |
| ECR | Storage | ~$0.10/GB/month |
| **Total** | | **~$0.02/hr** |

## Troubleshooting

- **Pipeline fails at ECR login**: Check `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` secrets have ECR push permissions
- **SSM deploy fails**: Ensure the EC2 instance has the `AmazonSSMManagedInstanceCore` IAM policy and the IAM user has `AmazonSSMFullAccess`
- **SSM command times out**: SSH in and check `/var/log/cicd-setup.log` — Docker may still be installing
- **App not responding on port 80**: Check `docker ps` on the instance — the container maps 80→3000
- **ECR push denied**: Ensure IAM user has `AmazonEC2ContainerRegistryPowerUser` policy
