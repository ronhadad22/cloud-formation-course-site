# Jenkins ECR Repositories CloudFormation Template

This directory contains CloudFormation templates and scripts to create ECR repositories for Jenkins CI/CD pipelines.

## 📁 Files

| File | Purpose |
|------|---------|
| `jenkins-ecr-repositories.yaml` | CloudFormation template for ECR repositories |
| `deploy-ecr.sh` | Deployment script with configuration |
| `README.md` | This documentation |

## 🚀 Quick Deployment

```bash
chmod +x deploy-ecr.sh
./deploy-ecr.sh
```

## 📦 What Gets Created

### **ECR Repositories**
- ✅ **sample-app** - Demo application repository
- ✅ **auth-service** - Authentication service repository
- ✅ **frontend** - Frontend application repository
- ✅ **backend** - Backend service repository
- ✅ **api-gateway** - API Gateway repository

### **Repository Features**
- ✅ **Image Scanning** - Vulnerability scanning on push
- ✅ **Lifecycle Policies** - Automatic cleanup of old images
- ✅ **Tagging** - Consistent tagging for organization
- ✅ **Immutable Tags** - Optional tag immutability

## ⚙️ Configuration

Edit the variables in `deploy-ecr.sh`:

```bash
# Stack configuration
STACK_NAME="jenkins-ecr-repositories"
REGION="us-east-1"
PROFILE="int-profile"

# Repository configuration
PROJECT_NAME="jenkins-demo"
ENVIRONMENT="dev"
REPOSITORY_NAMES="sample-app,auth-service,frontend,backend,api-gateway"

# Security and lifecycle
ENABLE_IMAGE_SCANNING="true"
IMAGE_TAG_MUTABILITY="MUTABLE"
LIFECYCLE_POLICY_DAYS="30"
```

## 🔄 Lifecycle Policies

Each repository includes automatic cleanup policies:

### **Tagged Images**
- ✅ Keep **last 10 tagged images**
- ✅ Delete older tagged images automatically

### **Untagged Images**
- ✅ Delete untagged images after **30 days** (configurable)
- ✅ Helps control storage costs

## 📤 Outputs

The CloudFormation stack provides these outputs:

| Output | Description | Export Name |
|--------|-------------|-------------|
| `SampleAppRepositoryURI` | Sample app repository URI | `{StackName}-SampleAppRepositoryURI` |
| `AuthServiceRepositoryURI` | Auth service repository URI | `{StackName}-AuthServiceRepositoryURI` |
| `FrontendRepositoryURI` | Frontend repository URI | `{StackName}-FrontendRepositoryURI` |
| `BackendRepositoryURI` | Backend repository URI | `{StackName}-BackendRepositoryURI` |
| `ApiGatewayRepositoryURI` | API Gateway repository URI | `{StackName}-ApiGatewayRepositoryURI` |
| `RepositoryList` | Comma-separated list of all URIs | `{StackName}-AllRepositoryURIs` |

## 🔧 Manual Deployment

If you prefer manual deployment:

```bash
aws cloudformation deploy \
    --template-file jenkins-ecr-repositories.yaml \
    --stack-name jenkins-ecr-repositories \
    --parameter-overrides \
        ProjectName=jenkins-demo \
        Environment=dev \
        RepositoryNames="sample-app,auth-service,frontend,backend,api-gateway" \
        EnableImageScanning=true \
        ImageTagMutability=MUTABLE \
        LifecyclePolicyDays=30 \
    --region us-east-1 \
    --profile int-profile
```

## 🏗️ Jenkins Integration

### **Environment Variables**
After deployment, use the generated `jenkins-ecr-env.yaml`:

```yaml
ECR_REGISTRY: "123456789012.dkr.ecr.us-east-1.amazonaws.com"
ECR_REGION: "us-east-1"
SAMPLE_APP_REPO: "123456789012.dkr.ecr.us-east-1.amazonaws.com/jenkins-demo/sample-app"
# ... other repositories
```

### **Sample Pipeline**
Use the generated `sample-pipeline.groovy`:

```groovy
pipeline {
    agent { label 'docker ecr' }
    environment {
        ECR_REGISTRY = "${ECR_REGISTRY}"
        AWS_DEFAULT_REGION = "${ECR_REGION}"
    }
    stages {
        stage('Build & Push') {
            steps {
                container('aws-cli') {
                    sh 'aws ecr get-login-password | docker login --username AWS --password-stdin ${ECR_REGISTRY}'
                }
                container('docker') {
                    sh '''
                        docker build -t ${REPOSITORY}:${BUILD_NUMBER} .
                        docker tag ${REPOSITORY}:${BUILD_NUMBER} ${ECR_REGISTRY}/${REPOSITORY}:${BUILD_NUMBER}
                        docker push ${ECR_REGISTRY}/${REPOSITORY}:${BUILD_NUMBER}
                    '''
                }
            }
        }
    }
}
```

## 🧪 Testing ECR Access

After deployment, test repository access:

```bash
# List repositories
aws ecr describe-repositories --region us-east-1 --profile int-profile

# Test login (requires ECR permissions)
aws ecr get-login-password --region us-east-1 --profile int-profile | \
    docker login --username AWS --password-stdin 123456789012.dkr.ecr.us-east-1.amazonaws.com

# Push a test image
docker tag alpine:latest 123456789012.dkr.ecr.us-east-1.amazonaws.com/jenkins-demo/sample-app:test
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/jenkins-demo/sample-app:test
```

## 📊 Repository Management

### **View Repository Contents**
```bash
# List images in a repository
aws ecr list-images \
    --repository-name jenkins-demo/sample-app \
    --region us-east-1 \
    --profile int-profile

# Get image details
aws ecr describe-images \
    --repository-name jenkins-demo/sample-app \
    --region us-east-1 \
    --profile int-profile
```

### **Manual Cleanup**
```bash
# Delete specific image
aws ecr batch-delete-image \
    --repository-name jenkins-demo/sample-app \
    --image-ids imageTag=old-tag \
    --region us-east-1 \
    --profile int-profile

# Delete untagged images
aws ecr list-images \
    --repository-name jenkins-demo/sample-app \
    --filter tagStatus=UNTAGGED \
    --query 'imageIds[*]' \
    --output json | \
aws ecr batch-delete-image \
    --repository-name jenkins-demo/sample-app \
    --image-ids file:///dev/stdin \
    --region us-east-1 \
    --profile int-profile
```

## 🔄 Updating Repositories

### **Add New Repository**
1. Edit `jenkins-ecr-repositories.yaml`
2. Add new repository resource
3. Update outputs section
4. Redeploy stack

### **Modify Lifecycle Policy**
1. Edit `LifecyclePolicyDays` parameter
2. Redeploy stack: `./deploy-ecr.sh`

### **Change Image Scanning**
1. Edit `EnableImageScanning` parameter
2. Redeploy stack

## 🗑️ Cleanup

To remove all repositories and images:

```bash
# Delete all images first (optional - will be done automatically)
for repo in sample-app auth-service frontend backend api-gateway; do
    aws ecr delete-repository \
        --repository-name jenkins-demo/$repo \
        --force \
        --region us-east-1 \
        --profile int-profile
done

# Delete CloudFormation stack
aws cloudformation delete-stack \
    --stack-name jenkins-ecr-repositories \
    --region us-east-1 \
    --profile int-profile
```

## 💰 Cost Optimization

### **Storage Costs**
- ✅ Lifecycle policies automatically clean up old images
- ✅ Monitor repository sizes regularly
- ✅ Use multi-stage Docker builds to reduce image size

### **Data Transfer**
- ✅ Use ECR in same region as EKS cluster
- ✅ Consider ECR VPC endpoints for private traffic

## 🔍 Troubleshooting

### **Repository Creation Fails**
- ✅ Check repository name format (lowercase, no special chars)
- ✅ Verify AWS permissions for ECR operations
- ✅ Ensure region is correct

### **Push/Pull Fails**
- ✅ Check ECR login: `aws ecr get-login-password`
- ✅ Verify repository exists and is accessible
- ✅ Check IAM permissions for ECR operations

### **Lifecycle Policy Not Working**
- ✅ Wait 24 hours for policy to take effect
- ✅ Check policy syntax in CloudFormation template
- ✅ Verify images meet policy criteria

## 📚 References

- [Amazon ECR User Guide](https://docs.aws.amazon.com/ecr/)
- [ECR Lifecycle Policies](https://docs.aws.amazon.com/AmazonECR/latest/userguide/LifecyclePolicies.html)
- [ECR Image Scanning](https://docs.aws.amazon.com/AmazonECR/latest/userguide/image-scanning.html)
- [Docker CLI with ECR](https://docs.aws.amazon.com/AmazonECR/latest/userguide/docker-basics.html)
