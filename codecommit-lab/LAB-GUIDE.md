# AWS CodeCommit + CodePipeline CI/CD Lab

Learn AWS-native CI/CD using CodeCommit, CodeBuild, and CodePipeline.

## Architecture

```
Developer → CodeCommit → EventBridge → CodePipeline → CodeBuild → ECR → EC2
```

**Flow:**
1. Push code to CodeCommit repository
2. EventBridge detects the push and triggers CodePipeline
3. CodePipeline pulls source code
4. CodeBuild builds Docker image and pushes to ECR
5. Manually deploy to EC2 using the deploy script

---

## Prerequisites

- **AWS CLI configured** — See [../cicd-lab/AWS-CLI-SETUP.md](../cicd-lab/AWS-CLI-SETUP.md) for instructions
- **Git installed**
- **EC2 Key Pair** in your region ([Create one](https://console.aws.amazon.com/ec2/v2/home#KeyPairs:) if needed)

---

## Step 1 — Deploy the Infrastructure

This creates: VPC, EC2, ECR, CodeCommit repository, CodeBuild project, CodePipeline, S3 bucket for artifacts.

```bash
aws cloudformation deploy \
  --stack-name codecommit-lab \
  --template-file codecommit-lab/cloudformation/01-infrastructure.yaml \
  --parameter-overrides KeyPairName=<YOUR-KEY-PAIR-NAME> \
  --capabilities CAPABILITY_NAMED_IAM
```

**Wait ~3 minutes** for the stack to finish.

Get the stack outputs:

```bash
aws cloudformation describe-stacks \
  --stack-name codecommit-lab \
  --query 'Stacks[0].Outputs' --output table
```

Write down:
- **CodeRepositoryCloneUrlHttp** (e.g., `https://git-codecommit.us-east-1.amazonaws.com/v1/repos/codecommit-lab-app`)
- **PipelineUrl** (CodePipeline console URL)
- **AppURL** (e.g., `http://54.x.x.x`)

---

## Step 2 — Configure Git Credentials for CodeCommit

### Option A: HTTPS with Git Credentials

1. Go to **IAM Console** → **Users** → **Your User** → **Security credentials**
2. Scroll to **HTTPS Git credentials for AWS CodeCommit**
3. Click **Generate credentials**
4. Download and save the username and password

### Option B: SSH Keys

1. Generate SSH key:
   ```bash
   ssh-keygen -t rsa -b 4096 -f ~/.ssh/codecommit_rsa
   ```

2. Upload public key to IAM:
   - Go to **IAM Console** → **Users** → **Your User** → **Security credentials**
   - Scroll to **SSH keys for AWS CodeCommit**
   - Click **Upload SSH public key**
   - Paste contents of `~/.ssh/codecommit_rsa.pub`

3. Configure SSH:
   ```bash
   cat >> ~/.ssh/config << EOF
   Host git-codecommit.*.amazonaws.com
     User <YOUR-SSH-KEY-ID>
     IdentityFile ~/.ssh/codecommit_rsa
   EOF
   ```

---

## Step 3 — Clone the Repository and Push Initial Code

Clone the empty CodeCommit repository:

```bash
git clone <CodeRepositoryCloneUrlHttp>
cd codecommit-lab-app
```

Copy the application code from your GitHub clone:

```bash
# Assuming you cloned the course repo as a sibling directory
cp -r ../cloud-formation-course-site/codecommit-lab/app/* .
cp ../cloud-formation-course-site/codecommit-lab/buildspec.yml .
```

**Or** download the files directly from GitHub:

```bash
# Create app directory
mkdir -p app

# Download files
curl -o app/server.js https://raw.githubusercontent.com/ronhadad22/cloud-formation-course-site/main/codecommit-lab/app/server.js
curl -o app/package.json https://raw.githubusercontent.com/ronhadad22/cloud-formation-course-site/main/codecommit-lab/app/package.json
curl -o app/Dockerfile https://raw.githubusercontent.com/ronhadad22/cloud-formation-course-site/main/codecommit-lab/app/Dockerfile
curl -o buildspec.yml https://raw.githubusercontent.com/ronhadad22/cloud-formation-course-site/main/codecommit-lab/buildspec.yml
```

Commit and push:

```bash
git add .
git commit -m "Initial commit"

# Rename branch from master to main (CodeCommit default is master)
git branch -M main

git push origin main
```

---

## Step 4 — Watch the Pipeline

1. Go to the **PipelineUrl** from Step 1
2. Watch the pipeline execute:
   - **Source** stage: Pulls code from CodeCommit
   - **Build** stage: Builds Docker image and pushes to ECR

The pipeline should complete in ~2-3 minutes.

---

## Step 5 — Deploy to EC2

SSH into the EC2 instance:

```bash
ssh -i <YOUR-KEY-PAIR>.pem ec2-user@<APP-URL>
```

Run the deploy script:

```bash
./deploy.sh
```

This will:
- Login to ECR
- Pull the latest Docker image
- Start the container on port 80

---

## Step 6 — Verify the Deployment

Open the **App URL** in your browser:

```
http://<EC2-PUBLIC-IP>
```

You should see the CI/CD Demo App running!

Check the health endpoint:

```bash
curl http://<EC2-PUBLIC-IP>/api/health
```

---

## Step 7 — Make a Change

Edit the app locally:

```bash
nano app/server.js
```

Change the greeting or add a new feature, then commit and push:

```bash
git add app/server.js
git commit -m "Update greeting"
git push origin main
```

Watch the pipeline run again in the CodePipeline console, then SSH to EC2 and run `./deploy.sh` to deploy the new version.

---

## How It Works

### CodeCommit
AWS-managed Git repository service. Fully integrated with IAM for access control.

### CodeBuild
Reads `buildspec.yml` to:
1. Login to ECR
2. Build Docker image
3. Push image to ECR with commit hash as tag
4. Create `imagedefinitions.json` artifact

### CodePipeline
Orchestrates the CI/CD workflow:
- **Source stage**: Detects changes in CodeCommit
- **Build stage**: Triggers CodeBuild

### EventBridge
Triggers the pipeline automatically when code is pushed to the `main` branch.

---

## Files

| File | What it does |
|------|-------------|
| `app/server.js` | Simple Node.js web app |
| `app/Dockerfile` | Packages the app into a Docker image |
| `app/package.json` | Node.js dependencies |
| `buildspec.yml` | CodeBuild instructions (build & push Docker image) |
| `cloudformation/01-infrastructure.yaml` | Creates all AWS resources |

---

## Cleanup

```bash
# Empty the S3 artifacts bucket first
aws s3 rm s3://codecommit-lab-artifacts-<ACCOUNT-ID> --recursive

# Delete the stack
aws cloudformation delete-stack --stack-name codecommit-lab
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| **Git push fails with authentication error** | Check your Git credentials in IAM or SSH key configuration |
| **Pipeline fails at Build stage** | Check CodeBuild logs in CloudWatch Logs |
| **ECR push fails** | Verify CodeBuild role has ECR permissions |
| **App not loading in browser** | Wait 2-3 min after stack creation for Docker to install, then run deploy.sh |
| **Deploy script fails** | SSH to EC2 and check `docker ps` and `/var/log/cloud-init-output.log` |

---

## Differences from GitHub Actions Lab

| Feature | GitHub Actions | CodeCommit/CodePipeline |
|---------|----------------|-------------------------|
| **Repository** | GitHub | AWS CodeCommit |
| **CI/CD Service** | GitHub Actions | CodePipeline + CodeBuild |
| **Workflow Definition** | `.github/workflows/deploy.yml` | `buildspec.yml` + Pipeline stages |
| **Secrets** | GitHub Secrets | IAM roles (no secrets needed!) |
| **Trigger** | GitHub webhook | EventBridge rule |
| **Deployment** | SSM send-command | Manual (run deploy.sh) |
| **Cost** | Free for public repos | Pay per pipeline execution |

**Key Advantage of AWS Solution:** No need to manage AWS credentials as secrets - everything uses IAM roles!

---

## Next Steps

- Add a Deploy stage to CodePipeline to automatically deploy to EC2
- Use CodeDeploy for blue/green deployments
- Add automated tests in CodeBuild
- Set up notifications with SNS
