#!/bin/bash

# Setup IRSA for External Secrets Operator

set -e

# Configuration
STACK_NAME="eso-irsa-stack"
TEMPLATE_FILE="eso-irsa.yaml"
REGION="us-east-1"
PROFILE="int-profile"

# Parameters
CLUSTER_NAME="student-eks-cluster"
CLUSTER_REGION="us-east-1"
SERVICE_ACCOUNT_NAME="external-secrets"
SERVICE_ACCOUNT_NAMESPACE="external-secrets-system"
ROLE_NAME="ExternalSecretsOperatorRole"
POLICY_NAME="ExternalSecretsOperatorPolicy"

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

print_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

echo "🚀 Setting up IRSA for External Secrets Operator..."

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

SERVICE_ACCOUNT_ANNOTATION=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $REGION \
    --profile $PROFILE \
    --query 'Stacks[0].Outputs[?OutputKey==`ServiceAccountAnnotation`].OutputValue' \
    --output text)

echo ""
echo "🎉 ESO IRSA setup completed successfully!"
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
echo "   Annotation: $SERVICE_ACCOUNT_ANNOTATION"
echo ""

# Install External Secrets Operator
print_step "Installing External Secrets Operator..."
helm repo add external-secrets https://charts.external-secrets.io
helm repo update

helm upgrade --install external-secrets external-secrets/external-secrets \
    -n $SERVICE_ACCOUNT_NAMESPACE \
    --create-namespace \
    --set serviceAccount.annotations."eks\.amazonaws\.com/role-arn"="$ROLE_ARN" \
    --wait

print_success "External Secrets Operator installed successfully"

# Verify installation
print_step "Verifying ESO installation..."
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=external-secrets -n $SERVICE_ACCOUNT_NAMESPACE --timeout=300s

print_success "ESO is running and ready"

echo ""
echo "📝 Next Steps:"
echo "   1. Create secrets in AWS Secrets Manager"
echo "   2. Create SecretStore configuration"
echo "   3. Create ExternalSecret resources"
echo "   4. Test secret synchronization"
echo ""
echo "✨ External Secrets Operator is ready to use!"
