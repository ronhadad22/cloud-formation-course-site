# External Secrets Operator Setup Guide

Complete guide to set up External Secrets Operator with AWS Secrets Manager for your jewelry app.

## 🚀 Quick Setup (5 minutes)

### Step 1: Setup AWS Secrets Manager
```bash
./setup-secrets-manager.sh
```

### Step 2: Setup IRSA for ESO
```bash
cd irsa-setup/
./setup-eso-irsa.sh
```

### Step 3: Create SecretStore
```bash
kubectl apply -f secret-store.yaml
```

### Step 4: Deploy ExternalSecrets
```bash
kubectl apply -f external-secrets/
```

### Step 5: Verify Setup
```bash
kubectl get externalsecrets -A
kubectl get secrets -A | grep -E "(jenkins|jewlery|database)"
```

## 📋 Detailed Setup Steps

### 1. Prerequisites
- ✅ EKS cluster running
- ✅ kubectl configured
- ✅ Helm installed
- ✅ AWS CLI configured with appropriate permissions

### 2. AWS Secrets Manager Setup

Create all required secrets:
```bash
./setup-secrets-manager.sh
```

This creates secrets for:
- **Jenkins**: Admin password, GitHub token, Docker credentials
- **Database**: PostgreSQL and Redis connection details
- **Application**: JWT secrets, API keys, Stripe keys, etc.

### 3. IRSA Configuration

Setup IAM Role for Service Accounts:
```bash
cd irsa-setup/
./setup-eso-irsa.sh
```

This will:
- ✅ Deploy CloudFormation stack for IRSA
- ✅ Install External Secrets Operator with IRSA
- ✅ Configure service account annotations
- ✅ Verify ESO is running

### 4. SecretStore Configuration

Deploy SecretStore resources:
```bash
kubectl apply -f secret-store.yaml
```

This creates:
- ✅ **SecretStore** for `default` namespace
- ✅ **SecretStore** for `jenkins` namespace  
- ✅ **ClusterSecretStore** for cluster-wide access

### 5. ExternalSecret Deployment

Deploy ExternalSecret resources:
```bash
kubectl apply -f external-secrets/
```

This creates ExternalSecrets for:
- ✅ **Jenkins secrets** - Admin password, tokens, credentials
- ✅ **Database secrets** - PostgreSQL and Redis connections
- ✅ **Application secrets** - JWT, API keys, Stripe, OAuth

## 🧪 Testing the Setup

### Test Secret Synchronization
```bash
# Check ExternalSecret status
kubectl get externalsecrets -A

# Check if secrets are created
kubectl get secrets -A | grep -E "(jenkins|jewlery|database)"

# Describe an ExternalSecret for details
kubectl describe externalsecret jenkins-secrets -n jenkins
```

### Test Secret Access in Pod
```bash
# Deploy test pod
kubectl apply -f examples/pod-with-secrets.yaml

# Check pod logs to see secrets
kubectl logs test-secrets-access

# Exec into pod to inspect secrets
kubectl exec -it test-secrets-access -- /bin/sh
ls -la /secrets/
cat /secrets/config/config.json
```

### Test Application Deployment
```bash
# Deploy example application
kubectl apply -f examples/deployment-example.yaml

# Check deployment status
kubectl get deployment jewlery-app-backend
kubectl describe deployment jewlery-app-backend
```

## 🔧 Configuration Management

### Update Secrets in AWS
```bash
# Update a secret value
aws secretsmanager update-secret \
    --secret-id "jewlery-app/auth" \
    --secret-string '{"jwt_secret":"new_secret_value"}' \
    --region us-east-1

# ESO will automatically sync the new value within refresh interval
```

### Add New Secrets

1. **Create secret in AWS Secrets Manager:**
```bash
aws secretsmanager create-secret \
    --name "jewlery-app/new-secret" \
    --secret-string '{"key":"value"}' \
    --region us-east-1
```

2. **Update ExternalSecret resource:**
```yaml
data:
- secretKey: newSecret
  remoteRef:
    key: jewlery-app/new-secret
    property: key
```

3. **Apply the updated ExternalSecret:**
```bash
kubectl apply -f external-secrets/app-secrets.yaml
```

### Troubleshooting

#### ESO Pod Not Running
```bash
kubectl get pods -n external-secrets-system
kubectl describe pod -l app.kubernetes.io/name=external-secrets -n external-secrets-system
kubectl logs -l app.kubernetes.io/name=external-secrets -n external-secrets-system
```

#### ExternalSecret Not Syncing
```bash
kubectl describe externalsecret <name> -n <namespace>
kubectl get events -n <namespace> --sort-by='.lastTimestamp'
```

#### IRSA Issues
```bash
# Check service account annotation
kubectl describe serviceaccount external-secrets -n external-secrets-system

# Test AWS access from ESO pod
kubectl exec -it <eso-pod> -n external-secrets-system -- aws sts get-caller-identity
```

#### Secret Access Issues
```bash
# Check if secret exists
kubectl get secret <secret-name> -n <namespace>

# Check secret content
kubectl get secret <secret-name> -n <namespace> -o yaml

# Test secret in pod
kubectl run test-pod --image=alpine --rm -it --restart=Never -- /bin/sh
```

## 📊 Monitoring and Alerts

### Key Metrics to Monitor
- ✅ **ExternalSecret sync status**
- ✅ **Secret refresh intervals**
- ✅ **ESO pod health**
- ✅ **AWS Secrets Manager API calls**

### Useful Commands
```bash
# Check all ExternalSecrets status
kubectl get externalsecrets -A -o wide

# Monitor ESO logs
kubectl logs -f -l app.kubernetes.io/name=external-secrets -n external-secrets-system

# Check secret ages
kubectl get secrets -A --sort-by='.metadata.creationTimestamp'
```

## 🔐 Security Best Practices

### Secrets Management
- ✅ **Rotate secrets regularly** using AWS Secrets Manager rotation
- ✅ **Use least privilege** IAM policies for ESO
- ✅ **Monitor secret access** via CloudTrail
- ✅ **Encrypt secrets at rest** with KMS

### Access Control
- ✅ **Namespace isolation** - Use separate SecretStores per namespace
- ✅ **RBAC** - Limit who can create/modify ExternalSecrets
- ✅ **Service accounts** - Use dedicated service accounts per application

### Audit and Compliance
- ✅ **CloudTrail logging** for Secrets Manager access
- ✅ **Kubernetes audit logs** for secret access
- ✅ **Regular security reviews** of ExternalSecret configurations

## 💰 Cost Optimization

### Secrets Manager Costs
- ✅ **Consolidate secrets** - Use JSON objects instead of individual secrets
- ✅ **Optimize refresh intervals** - Balance security vs. API calls
- ✅ **Clean up unused secrets** - Remove old/unused secrets

### Example Cost Calculation
- **Secret storage**: $0.40/secret/month
- **API calls**: $0.05/10,000 calls
- **For 15 secrets with 1h refresh**: ~$6-8/month

## 🔄 Backup and Disaster Recovery

### Backup Strategy
```bash
# Export all secrets for backup
kubectl get secrets -A -o yaml > secrets-backup.yaml

# Export ExternalSecret configurations
kubectl get externalsecrets -A -o yaml > externalsecrets-backup.yaml
```

### Recovery Process
1. **Restore AWS Secrets Manager** from backup/snapshot
2. **Redeploy ESO** using IRSA setup script
3. **Apply SecretStore** configurations
4. **Apply ExternalSecret** resources
5. **Verify secret synchronization**

---

## 🎯 Next Steps

After completing this setup:

1. **Update secret values** with your actual credentials
2. **Deploy your applications** using the generated secrets
3. **Set up monitoring** for secret synchronization
4. **Configure secret rotation** in AWS Secrets Manager
5. **Implement backup procedures** for disaster recovery

Your External Secrets Operator is now ready to securely manage all your application secrets! 🚀
