# Jenkins IRSA Setup for ECR Access

This directory contains AWS IAM Roles for Service Accounts (IRSA) configuration for Jenkins to access ECR securely.

## 🚀 Quick Setup

```bash
cd irsa-jenkins
./setup.sh
```

## 📁 Files

- `jenkins-ecr-policy.json` - IAM policy for ECR permissions
- `jenkins-trust-policy.json` - Trust policy for IRSA
- `jenkins-service-account.yaml` - Kubernetes ServiceAccount with IRSA annotation
- `setup.sh` - Automated setup script
- `cleanup.sh` - Cleanup script

## ✅ What This Does

1. **Creates IAM Policy** - ECR read/write permissions for Jenkins
2. **Creates IAM Role** - With trust relationship to EKS OIDC provider
3. **Creates ServiceAccount** - In `jenkins` namespace with role annotation
4. **Updates Jenkinsfile** - To use IRSA instead of AWS credentials

## 🔧 Manual Steps (if needed)

```bash
# Create policy
aws iam create-policy --policy-name JenkinsECRPolicy --policy-document file://jenkins-ecr-policy.json --profile int-profile

# Create role
aws iam create-role --role-name JenkinsECRRole --assume-role-policy-document file://jenkins-trust-policy.json --profile int-profile

# Attach policy
aws iam attach-role-policy --role-name JenkinsECRRole --policy-arn arn:aws:iam::950555670656:policy/JenkinsECRPolicy --profile int-profile

# Apply K8s resources
kubectl apply -f jenkins-service-account.yaml
```

## 🧹 Cleanup

```bash
./cleanup.sh
```

## 🎯 Benefits

- ✅ **Secure** - No AWS credentials stored in Jenkins
- ✅ **Scoped** - Only ECR permissions, only for Jenkins pods
- ✅ **AWS Best Practice** - Uses IRSA instead of instance profiles
- ✅ **Auditable** - Clear IAM role and policy separation
