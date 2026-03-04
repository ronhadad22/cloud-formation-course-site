#!/bin/bash

# Install AWS Load Balancer Controller using Helm

set -e

# Configuration
REGION="us-east-1"
PROFILE="int-profile"
CLUSTER_NAME="student-eks-cluster"

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

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

echo "🚀 Installing AWS Load Balancer Controller..."

# Get VPC ID
print_step "Getting VPC ID for cluster..."
VPC_ID=$(aws eks describe-cluster \
    --name $CLUSTER_NAME \
    --region $REGION \
    --profile $PROFILE \
    --query 'cluster.resourcesVpcConfig.vpcId' \
    --output text)

if [ -z "$VPC_ID" ]; then
    print_error "Failed to get VPC ID"
    exit 1
fi

print_success "VPC ID: $VPC_ID"

# Update values file with VPC ID
print_step "Updating values file with VPC ID..."
sed -i.bak "s/vpcId: vpc-.*/vpcId: $VPC_ID/" alb-controller-values.yaml
rm -f alb-controller-values.yaml.bak

print_success "Values file updated"

# Install TargetGroupBinding CRDs
print_step "Installing TargetGroupBinding CRDs..."
kubectl apply -f https://raw.githubusercontent.com/aws/eks-charts/master/stable/aws-load-balancer-controller/crds/crds.yaml

print_success "CRDs installed"

# Add Helm repository
print_step "Adding EKS Helm repository..."
helm repo add eks https://aws.github.io/eks-charts
helm repo update

print_success "Helm repository added"

# Install AWS Load Balancer Controller
print_step "Installing AWS Load Balancer Controller..."
helm upgrade --install aws-load-balancer-controller eks/aws-load-balancer-controller \
    --namespace kube-system \
    --values alb-controller-values.yaml \
    --wait

print_success "AWS Load Balancer Controller installed successfully"

# Wait for deployment to be ready
print_step "Waiting for AWS Load Balancer Controller to be ready..."
kubectl wait --for=condition=available --timeout=300s \
    deployment/aws-load-balancer-controller -n kube-system

print_success "AWS Load Balancer Controller is ready"

# Verify installation
print_step "Verifying installation..."
echo ""
kubectl get deployment aws-load-balancer-controller -n kube-system
echo ""
kubectl get pods -n kube-system -l app.kubernetes.io/name=aws-load-balancer-controller
echo ""

print_success "AWS Load Balancer Controller installation completed!"

echo ""
echo "📝 Useful Commands:"
echo "   View logs: kubectl logs -f deployment/aws-load-balancer-controller -n kube-system"
echo "   Check status: kubectl get deployment aws-load-balancer-controller -n kube-system"
echo "   List ingress classes: kubectl get ingressclass"
echo "   View webhooks: kubectl get validatingwebhookconfigurations | grep aws-load-balancer"
echo ""
echo "📖 Next Steps:"
echo "   1. Create an Ingress resource with ingressClassName: alb"
echo "   2. Check the examples in the examples/ directory"
echo ""
