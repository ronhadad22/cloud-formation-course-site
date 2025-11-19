# External Secrets Operator with AWS Secrets Manager

This setup integrates External Secrets Operator (ESO) with AWS Secrets Manager to securely manage secrets in your EKS cluster.

## 🏗️ Architecture Overview

```
AWS Secrets Manager → ESO Controller → Kubernetes Secrets → Applications
```

## 🚀 Quick Setup

### 1. Install ESO
```bash
helm repo add external-secrets https://charts.external-secrets.io
helm install external-secrets external-secrets/external-secrets -n external-secrets-system --create-namespace
```

### 2. Setup IRSA for ESO
```bash
cd irsa-setup/
./setup-eso-irsa.sh
```

### 3. Create SecretStore
```bash
kubectl apply -f secret-store.yaml
```

### 4. Create ExternalSecrets
```bash
kubectl apply -f external-secrets/
```

## 📁 Directory Structure

```
external-secrets/
├── README.md                    # This file
├── irsa-setup/                  # IRSA configuration for ESO
│   ├── eso-irsa.yaml           # CloudFormation template
│   └── setup-eso-irsa.sh       # Setup script
├── secret-store.yaml           # SecretStore configuration
├── external-secrets/           # ExternalSecret definitions
│   ├── jenkins-secrets.yaml   # Jenkins credentials
│   ├── database-secrets.yaml  # Database credentials
│   └── app-secrets.yaml       # Application secrets
└── examples/                   # Usage examples
    ├── pod-with-secrets.yaml  # Pod using secrets
    └── deployment-example.yaml # Deployment example
```

## 🔐 Benefits

- ✅ **Centralized Secret Management** - All secrets in AWS Secrets Manager
- ✅ **Automatic Rotation** - Secrets automatically updated in K8s
- ✅ **IRSA Integration** - No hardcoded AWS credentials
- ✅ **Namespace Isolation** - Secrets scoped to specific namespaces
- ✅ **Audit Trail** - CloudTrail logs all secret access
