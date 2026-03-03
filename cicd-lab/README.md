# CI/CD Lab — GitHub Actions + Docker + AWS EC2

A CI/CD pipeline that builds a Docker image, pushes to ECR, and deploys to EC2 — triggered by `git push`.

```
git push → GitHub Actions → Build Docker → Push to ECR → Deploy to EC2
```

## Files

| File | What it does |
|------|-------------|
| `app/server.js` | Simple Node.js web app |
| `app/Dockerfile` | Packages the app into a Docker image |
| `cloudformation/01-infrastructure.yaml` | Creates VPC, EC2, ECR, IAM |
| `.github/workflows/deploy.yml` | CI/CD pipeline (build → push → deploy) |

## Student Instructions

See **[LAB-GUIDE.md](LAB-GUIDE.md)** for step-by-step instructions.

## Cleanup

```bash
aws cloudformation delete-stack --stack-name cicd-lab \
  --region eu-west-1 --profile <YOUR-PROFILE>
```
