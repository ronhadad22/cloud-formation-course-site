#!/bin/bash

# Deploy IRSA CloudFormation stack for Jenkins ECR access

set -e

# Configuration
STACK_NAME="jenkins-irsa-stack"
TEMPLATE_FILE="jenkins-irsa.yaml"
REGION="us-east-1"
PROFILE="int-profile"

# Parameters (customize as needed)
CLUSTER_NAME="student-eks-cluster"
CLUSTER_REGION="us-east-1"
SERVICE_ACCOUNT_NAME="jenkins-agent"
SERVICE_ACCOUNT_NAMESPACE="jenkins"
ROLE_NAME="JenkinsECRRole"
POLICY_NAME="JenkinsECRPolicy"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_step() {
    echo -e "${BLUE}📋 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

echo "🚀 Deploying Jenkins IRSA CloudFormation Stack..."

# Check if EKS cluster exists
print_step "Checking if EKS cluster exists..."
if aws eks describe-cluster --name $CLUSTER_NAME --region $REGION --profile $PROFILE > /dev/null 2>&1; then
    print_success "EKS cluster '$CLUSTER_NAME' found"
else
    print_error "EKS cluster '$CLUSTER_NAME' not found in region $REGION"
    exit 1
fi

# Deploy CloudFormation stack
print_step "Deploying CloudFormation stack..."
aws cloudformation deploy \
    --template-file $TEMPLATE_FILE \
    --stack-name $STACK_NAME \
    --parameter-overrides \
        ClusterName=$CLUSTER_NAME \
        ClusterRegion=$CLUSTER_REGION \
        ServiceAccountName=$SERVICE_ACCOUNT_NAME \
        ServiceAccountNamespace=$SERVICE_ACCOUNT_NAMESPACE \
        RoleName=$ROLE_NAME \
        PolicyName=$POLICY_NAME \
    --capabilities CAPABILITY_NAMED_IAM \
    --region $REGION \
    --profile $PROFILE

print_success "CloudFormation stack deployed successfully"

# Get stack outputs
print_step "Getting stack outputs..."
ROLE_ARN=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $REGION \
    --profile $PROFILE \
    --query 'Stacks[0].Outputs[?OutputKey==`RoleArn`].OutputValue' \
    --output text)

POLICY_ARN=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $REGION \
    --profile $PROFILE \
    --query 'Stacks[0].Outputs[?OutputKey==`PolicyArn`].OutputValue' \
    --output text)

SERVICE_ACCOUNT_ANNOTATION=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $REGION \
    --profile $PROFILE \
    --query 'Stacks[0].Outputs[?OutputKey==`ServiceAccountAnnotation`].OutputValue' \
    --output text)

echo ""
echo "🎉 IRSA setup completed successfully!"
echo ""
echo "📋 Stack Information:"
echo "   Stack Name: $STACK_NAME"
echo "   Region: $REGION"
echo ""
echo "🔑 IAM Resources:"
echo "   Role ARN: $ROLE_ARN"
echo "   Policy ARN: $POLICY_ARN"
echo ""
echo "☸️ Kubernetes Configuration:"
echo "   Service Account: $SERVICE_ACCOUNT_NAMESPACE/$SERVICE_ACCOUNT_NAME"
echo "   Annotation: $SERVICE_ACCOUNT_ANNOTATION"
echo ""
echo "📝 Next Steps:"
echo "   1. Create the Kubernetes service account with the annotation:"
echo "      kubectl create serviceaccount $SERVICE_ACCOUNT_NAME -n $SERVICE_ACCOUNT_NAMESPACE"
echo "      kubectl annotate serviceaccount $SERVICE_ACCOUNT_NAME -n $SERVICE_ACCOUNT_NAMESPACE $SERVICE_ACCOUNT_ANNOTATION"
echo ""
echo "   2. Use this service account in your Jenkins agent pod templates"
echo "   3. Test ECR access with: aws sts get-caller-identity"
echo ""

# Create Kubernetes service account YAML
print_step "Creating Kubernetes service account YAML..."
cat > service-account.yaml << EOF
apiVersion: v1
kind: ServiceAccount
metadata:
  name: $SERVICE_ACCOUNT_NAME
  namespace: $SERVICE_ACCOUNT_NAMESPACE
  annotations:
    $SERVICE_ACCOUNT_ANNOTATION
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: $SERVICE_ACCOUNT_NAME
rules:
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
- apiGroups: [""]
  resources: ["pods/exec"]
  verbs: ["create"]
- apiGroups: [""]
  resources: ["pods/log"]
  verbs: ["get", "list", "watch"]
- apiGroups: [""]
  resources: ["secrets"]
  verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: $SERVICE_ACCOUNT_NAME
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: $SERVICE_ACCOUNT_NAME
subjects:
- kind: ServiceAccount
  name: $SERVICE_ACCOUNT_NAME
  namespace: $SERVICE_ACCOUNT_NAMESPACE
EOF

print_success "Kubernetes service account YAML created: service-account.yaml"

# Optional: Apply the service account
read -p "Apply the Kubernetes service account now? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_step "Applying Kubernetes service account..."
    kubectl apply -f service-account.yaml
    print_success "Service account applied successfully"
fi

echo ""
echo "✨ IRSA setup is complete and ready for Jenkins!"
