# CodeCommit + CodePipeline CI/CD Lab

AWS-native CI/CD pipeline using CodeCommit, CodeBuild, and CodePipeline.

```
git push → CodeCommit → EventBridge → CodePipeline → CodeBuild → ECR → EC2
```

## What You'll Learn

- AWS CodeCommit for Git repositories
- CodeBuild for building Docker images
- CodePipeline for orchestrating CI/CD
- EventBridge for triggering pipelines
- IAM roles instead of managing secrets

## Files

| File | What it does |
|------|-------------|
| `app/server.js` | Simple Node.js web app |
| `app/Dockerfile` | Packages the app into a Docker image |
| `buildspec.yml` | CodeBuild instructions |
| `cloudformation/01-infrastructure.yaml` | Creates VPC, EC2, ECR, CodeCommit, CodeBuild, CodePipeline |

## Student Instructions

See **[LAB-GUIDE.md](LAB-GUIDE.md)** for step-by-step instructions.

## Cleanup

```bash
# Empty S3 bucket first
aws s3 rm s3://codecommit-lab-artifacts-<ACCOUNT-ID> --recursive

# Delete stack
aws cloudformation delete-stack --stack-name codecommit-lab
```

## Comparison with GitHub Actions Lab

This lab uses AWS-native services instead of GitHub. The key difference is **no secrets management needed** - everything uses IAM roles!
