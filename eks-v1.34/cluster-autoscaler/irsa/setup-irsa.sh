#!/bin/bash

# Setup IRSA for Cluster Autoscaler

set -e

# Configuration
STACK_NAME="cluster-autoscaler-irsa-stack"
TEMPLATE_FILE="cluster-autoscaler-irsa.yaml"
REGION="us-east-1"
PROFILE="int-profile"

# Parameters
CLUSTER_NAME="student-eks-cluster"
SERVICE_ACCOUNT_NAME="cluster-autoscaler"
SERVICE_ACCOUNT_NAMESPACE="kube-system"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_step() {
    echo -e "${BLUE}📋 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

echo "🚀 Setting up IRSA for Cluster Autoscaler..."

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
        ClusterRegion=$REGION \
        ServiceAccountName=$SERVICE_ACCOUNT_NAME \
        ServiceAccountNamespace=$SERVICE_ACCOUNT_NAMESPACE \
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

echo ""
echo "🎉 Cluster Autoscaler IRSA setup completed successfully!"
echo ""
echo "📋 Stack Information:"
echo "   Stack Name: $STACK_NAME"
echo "   Region: $REGION"
echo ""
echo "🔑 IAM Resources:"
echo "   Role ARN: $ROLE_ARN"
echo ""
echo "☸️ Kubernetes Configuration:"
echo "   Service Account: $SERVICE_ACCOUNT_NAMESPACE/$SERVICE_ACCOUNT_NAME"
echo "   Annotation: eks.amazonaws.com/role-arn=$ROLE_ARN"
echo ""
echo "📝 Next Steps:"
echo "   1. Install Cluster Autoscaler using Helm"
echo "   2. Verify the deployment"
echo ""
