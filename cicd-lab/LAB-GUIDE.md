# CI/CD Lab — Student Guide

Build a CI/CD pipeline that automatically builds a Docker image, pushes it to AWS ECR, and deploys it to an EC2 instance using GitHub Actions.

## Architecture

```
git push → GitHub Actions → Build Docker Image → Push to ECR → Deploy to EC2 via SSM
```

```
┌──────────┐  push   ┌─────────────────┐  push image  ┌───────┐
│ Developer│───────▶ │ GitHub Actions   │────────────▶│  ECR  │
└──────────┘         │ (build + deploy) │              └───┬───┘
                     └────────┬─────────┘                  │
                              │ SSM command                 │ docker pull
                              ▼                             ▼
                     ┌──────────────────────────────────────────┐
                     │  EC2 Instance                            │
                     │  Docker container running on port 80     │
                     └──────────────────────────────────────────┘
```

---

## Prerequisites

- **AWS CLI configured** — See [AWS-CLI-SETUP.md](AWS-CLI-SETUP.md) for instructions
- **GitHub account**
- **EC2 Key Pair** in `eu-west-1` region ([Create one](https://console.aws.amazon.com/ec2/v2/home?region=eu-west-1#KeyPairs:) if needed)

---

## Step 1 — Fork and Clone the Repo

1. Go to https://github.com/ronhadad22/cloud-formation-course-site
2. Click **Fork**
3. **Important:** Uncheck "Copy the main branch only" (we need the `cicd-lab` branch)
4. Click **Create fork**
5. Clone your fork locally:

```bash
git clone https://github.com/<YOUR-USERNAME>/cloud-formation-course-site.git
cd cloud-formation-course-site
git checkout cicd-lab
```

6. **Set default branch and enable GitHub Actions:**
   - Go to your forked repo → **Settings** → **General** → **Default branch**
   - Change default branch from `main` to `cicd-lab` and confirm
   - Go to the **Actions** tab
   - Click **"I understand my workflows, go ahead and enable them"**

---

## Step 2 — Deploy the Infrastructure

This creates: VPC, Security Group, EC2 instance (with Docker), ECR repository, IAM role.

```bash
aws cloudformation deploy \
  --stack-name cicd-lab \
  --template-file cicd-lab/cloudformation/01-infrastructure.yaml \
  --parameter-overrides KeyPairName=<YOUR-KEY-PAIR-NAME> \
  --capabilities CAPABILITY_NAMED_IAM
```

**Wait ~3 minutes** for the stack to finish.

Get the stack outputs:

```bash
aws cloudformation describe-stacks \
  --stack-name cicd-lab \
  --query 'Stacks[0].Outputs' --output table
```

Write down:
- **EC2 Instance ID** (e.g. `i-0abc123...`)
- **App URL** (e.g. `http://54.x.x.x`)
- **ECR Repository URI**

---

## Step 3 — Configure GitHub Secrets and Variables

### Add Secrets

In your **forked repo** → **Settings** → **Secrets and variables** → **Actions** → **Secrets** → **New repository secret**

Add these 2 secrets:

| Secret Name | Value |
|-------------|-------|
| `AWS_ACCESS_KEY_ID` | Your IAM access key |
| `AWS_SECRET_ACCESS_KEY` | Your IAM secret key |

### Add Variables

Go to **Settings** → **Secrets and variables** → **Actions** → **Variables** → **New repository variable**

Add these 2 variables:

| Variable Name | Value |
|---------------|-------|
| `AWS_REGION` | The region you deployed in (e.g. `us-east-1`, `eu-west-1`) |
| `EC2_INSTANCE_ID` | Instance ID from Step 2 (e.g. `i-0abc123...`) |

> Your IAM user needs these permissions: `AmazonEC2ContainerRegistryPowerUser`, `AmazonSSMFullAccess`, `AmazonEC2ReadOnlyAccess`

---

## Step 4 — Trigger the Pipeline

Make a small change to the app and push:

```bash
# Edit the app (change the greeting text)
nano cicd-lab/app/server.js

# Commit and push
git add cicd-lab/app/server.js
git commit -m "my first deploy"
git push
```

---

## Step 5 — Watch the Pipeline

1. Go to your fork on GitHub
2. Click the **Actions** tab
3. Click the running workflow
4. Watch both jobs: **Build & Push** → **Deploy to EC2**

---

## Step 6 — Verify

Open the **App URL** from Step 2 in your browser:

```
http://<EC2-PUBLIC-IP>
```

You should see your updated app running!

You can also check the health endpoint:

```bash
curl http://<EC2-PUBLIC-IP>/api/health
```

---

## Step 7 — Make Another Change

Edit `server.js` again, push, and watch the pipeline automatically redeploy:

```bash
# Change something in the app
git add -A
git commit -m "v2 update"
git push
```

Go to **Actions** tab and watch it deploy again.

---

## Understanding the Files

### `cicd-lab/app/server.js`
A simple Node.js web server with 2 endpoints:
- `/` — Home page showing app version
- `/api/health` — Health check (JSON)

### `cicd-lab/app/Dockerfile`
Packages the app into a Docker image.

### `.github/workflows/deploy.yml`
The CI/CD pipeline with 2 jobs:
1. **Build & Push** — Builds Docker image, pushes to ECR
2. **Deploy** — Runs deploy script on EC2 via AWS SSM

### `cicd-lab/cloudformation/01-infrastructure.yaml`
Creates all AWS resources: VPC, EC2, ECR, Security Group, IAM Role.

---

## Cleanup

```bash
aws cloudformation delete-stack --stack-name cicd-lab
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| **Actions tab not showing workflows** | Go to your fork → **Actions** tab → Click "I understand my workflows, go ahead and enable them" |
| **Pipeline not triggering on push** | GitHub Actions are disabled by default on forks - see Step 1 to enable them |
| Pipeline fails at ECR login | Check `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` secrets |
| SSM deploy fails | Make sure EC2 instance is running and has SSM agent |
| App not loading in browser | Wait 2-3 min after stack creation for Docker to install |
| Health check fails | SSH into EC2 and run `docker ps` to check container status |
