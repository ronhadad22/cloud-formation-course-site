#!/bin/bash

# Install Kyverno using Helm

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

echo "🚀 Installing Kyverno..."

# Add Helm repository
print_step "Adding Kyverno Helm repository..."
helm repo add kyverno https://kyverno.github.io/kyverno/
helm repo update

print_success "Helm repository added"

# Install Kyverno
print_step "Installing Kyverno..."
helm upgrade --install kyverno kyverno/kyverno \
    --namespace kyverno \
    --create-namespace \
    --values kyverno-values.yaml \
    --wait

print_success "Kyverno installed successfully"

# Wait for deployment to be ready
print_step "Waiting for Kyverno to be ready..."
kubectl wait --for=condition=available --timeout=300s \
    deployment/kyverno-admission-controller -n kyverno

print_success "Kyverno is ready"

# Verify installation
print_step "Verifying installation..."
echo ""
kubectl get deployments -n kyverno
echo ""
kubectl get pods -n kyverno
echo ""

print_success "Kyverno installation completed!"

echo ""
echo "📝 Useful Commands:"
echo "   View logs: kubectl logs -f deployment/kyverno-admission-controller -n kyverno"
echo "   Check status: kubectl get deployments -n kyverno"
echo "   List policies: kubectl get clusterpolicies"
echo "   List policy reports: kubectl get policyreports -A"
echo ""
