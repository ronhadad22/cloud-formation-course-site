# Jenkins IRSA CloudFormation Template

This directory contains CloudFormation templates and scripts to set up IAM Roles for Service Accounts (IRSA) for Jenkins ECR access.

## 📁 Files

| File | Purpose |
|------|---------|
| `jenkins-irsa.yaml` | CloudFormation template for IRSA setup |
| `deploy-irsa.sh` | Deployment script with configuration |
| `README.md` | This documentation |

## 🚀 Quick Deployment

```bash
chmod +x deploy-irsa.sh
./deploy-irsa.sh
```

## 📋 What Gets Created

### **IAM Resources**
- ✅ **IAM Policy** (`JenkinsECRPolicy`) - ECR permissions
- ✅ **IAM Role** (`JenkinsECRRole`) - Assumable by service account
- ✅ **Trust Relationship** - Links to EKS OIDC provider

### **Lambda Function**
- ✅ **OIDC Provider Detector** - Automatically gets cluster OIDC ID
- ✅ **IAM Role for Lambda** - Minimal permissions for EKS describe

### **Kubernetes Resources** (Generated)
- ✅ **Service Account YAML** - Ready to apply to cluster
- ✅ **RBAC Configuration** - ClusterRole and ClusterRoleBinding

## ⚙️ Configuration

Edit the variables in `deploy-irsa.sh`:

```bash
# Stack configuration
STACK_NAME="jenkins-irsa-stack"
REGION="us-east-1"
PROFILE="int-profile"

# EKS configuration
CLUSTER_NAME="student-eks-cluster"
CLUSTER_REGION="us-east-1"

# Kubernetes configuration
SERVICE_ACCOUNT_NAME="jenkins-agent"
SERVICE_ACCOUNT_NAMESPACE="jenkins"

# IAM configuration
ROLE_NAME="JenkinsECRRole"
POLICY_NAME="JenkinsECRPolicy"
```

## 🔐 ECR Permissions Granted

The IAM policy grants the following ECR permissions:

- ✅ **Authentication**: `ecr:GetAuthorizationToken`
- ✅ **Pull Images**: `ecr:BatchCheckLayerAvailability`, `ecr:GetDownloadUrlForLayer`, `ecr:BatchGetImage`
- ✅ **Push Images**: `ecr:InitiateLayerUpload`, `ecr:UploadLayerPart`, `ecr:CompleteLayerUpload`, `ecr:PutImage`
- ✅ **Repository Management**: `ecr:CreateRepository`, `ecr:DescribeRepositories`
- ✅ **Image Management**: `ecr:ListImages`, `ecr:DescribeImages`, `ecr:BatchDeleteImage`
- ✅ **Identity**: `sts:GetCallerIdentity`

## 📤 Outputs

The CloudFormation stack provides these outputs:

| Output | Description | Export Name |
|--------|-------------|-------------|
| `RoleArn` | IAM role ARN for service account annotation | `{StackName}-JenkinsECRRoleArn` |
| `PolicyArn` | IAM policy ARN | `{StackName}-JenkinsECRPolicyArn` |
| `ServiceAccountAnnotation` | Ready-to-use annotation for service account | `{StackName}-ServiceAccountAnnotation` |
| `OIDCProviderID` | EKS cluster OIDC provider ID | `{StackName}-OIDCProviderID` |

## 🔧 Manual Deployment

If you prefer manual deployment:

```bash
# Deploy the stack
aws cloudformation deploy \
    --template-file jenkins-irsa.yaml \
    --stack-name jenkins-irsa-stack \
    --parameter-overrides \
        ClusterName=student-eks-cluster \
        ClusterRegion=us-east-1 \
        ServiceAccountName=jenkins-agent \
        ServiceAccountNamespace=jenkins \
        RoleName=JenkinsECRRole \
        PolicyName=JenkinsECRPolicy \
    --capabilities CAPABILITY_NAMED_IAM \
    --region us-east-1 \
    --profile int-profile

# Apply the generated service account
kubectl apply -f service-account.yaml
```

## 🧪 Testing IRSA

After deployment, test the setup:

```bash
# Create a test pod with the service account
kubectl run test-pod \
    --image=amazon/aws-cli:latest \
    --serviceaccount=jenkins-agent \
    --namespace=jenkins \
    --rm -it --restart=Never \
    -- aws sts get-caller-identity

# Test ECR access
kubectl run test-ecr \
    --image=amazon/aws-cli:latest \
    --serviceaccount=jenkins-agent \
    --namespace=jenkins \
    --rm -it --restart=Never \
    -- aws ecr describe-repositories --region us-east-1
```

## 🔄 Updating the Stack

To update the configuration:

```bash
# Modify parameters in deploy-irsa.sh
# Then redeploy
./deploy-irsa.sh
```

## 🗑️ Cleanup

To remove all resources:

```bash
# Delete Kubernetes resources
kubectl delete -f service-account.yaml

# Delete CloudFormation stack
aws cloudformation delete-stack \
    --stack-name jenkins-irsa-stack \
    --region us-east-1 \
    --profile int-profile
```

## 🔍 Troubleshooting

### **Stack Creation Fails**
- ✅ Check EKS cluster exists and is accessible
- ✅ Verify AWS credentials and permissions
- ✅ Ensure region matches cluster location

### **Service Account Not Working**
- ✅ Verify annotation is correct: `kubectl describe sa jenkins-agent -n jenkins`
- ✅ Check OIDC provider exists: `aws iam list-open-id-connect-providers`
- ✅ Verify trust relationship in IAM role

### **ECR Access Denied**
- ✅ Check IAM policy permissions
- ✅ Verify role assumption works: `aws sts get-caller-identity`
- ✅ Test with AWS CLI in pod

## 📚 References

- [IAM Roles for Service Accounts](https://docs.aws.amazon.com/eks/latest/userguide/iam-roles-for-service-accounts.html)
- [Amazon ECR User Guide](https://docs.aws.amazon.com/ecr/)
- [EKS OIDC Provider](https://docs.aws.amazon.com/eks/latest/userguide/enable-iam-roles-for-service-accounts.html)
