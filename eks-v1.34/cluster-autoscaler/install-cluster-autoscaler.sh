#!/bin/bash

# Install Cluster Autoscaler using Helm

set -e

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

echo "🚀 Installing Cluster Autoscaler..."

# Add Helm repository
print_step "Adding autoscaler Helm repository..."
helm repo add autoscaler https://kubernetes.github.io/autoscaler
helm repo update

print_success "Helm repository added"

# Install Cluster Autoscaler
print_step "Installing Cluster Autoscaler..."
helm upgrade --install cluster-autoscaler autoscaler/cluster-autoscaler \
    --namespace kube-system \
    --values cluster-autoscaler-values.yaml \
    --wait

print_success "Cluster Autoscaler installed successfully"

# Wait for deployment to be ready
print_step "Waiting for Cluster Autoscaler to be ready..."
kubectl wait --for=condition=available --timeout=300s \
    deployment/cluster-autoscaler -n kube-system

print_success "Cluster Autoscaler is ready"

# Verify installation
print_step "Verifying installation..."
echo ""
kubectl get deployment cluster-autoscaler -n kube-system
echo ""
kubectl get pods -n kube-system -l app.kubernetes.io/name=aws-cluster-autoscaler
echo ""

print_success "Cluster Autoscaler installation completed!"

echo ""
echo "📝 Useful Commands:"
echo "   View logs: kubectl logs -f deployment/cluster-autoscaler -n kube-system"
echo "   Check status: kubectl get deployment cluster-autoscaler -n kube-system"
echo "   Describe: kubectl describe deployment cluster-autoscaler -n kube-system"
echo ""
