#!/bin/bash

# Install ArgoCD using Helm

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

echo "🚀 Installing ArgoCD..."

# Add Helm repository
print_step "Adding ArgoCD Helm repository..."
helm repo add argo https://argoproj.github.io/argo-helm
helm repo update

print_success "Helm repository added"

# Install ArgoCD
print_step "Installing ArgoCD..."
helm upgrade --install argocd argo/argo-cd \
    --namespace argocd \
    --create-namespace \
    --values argocd-values.yaml \
    --wait

print_success "ArgoCD installed successfully"

# Wait for pods to be ready
print_step "Waiting for ArgoCD pods to be ready..."
kubectl wait --for=condition=available --timeout=300s \
    deployment/argocd-server -n argocd

print_success "ArgoCD is ready"

# Get admin password
print_step "Retrieving admin password..."
ADMIN_PASSWORD=$(kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d)

echo ""
print_success "ArgoCD installation completed!"

echo ""
echo "📋 Access Information:"
echo "   Namespace: argocd"
echo "   Username: admin"
echo "   Password: $ADMIN_PASSWORD"
echo ""
echo "🌐 Access Options:"
echo ""
echo "   Option 1 - Port Forward (HTTP):"
echo "   kubectl port-forward service/argocd-server -n argocd 8081:80"
echo "   URL: http://localhost:8081"
echo ""
echo "   Option 2 - LoadBalancer (if configured):"
echo "   kubectl get svc argocd-server -n argocd"
echo ""
echo "📝 Useful Commands:"
echo "   View pods: kubectl get pods -n argocd"
echo "   View services: kubectl get svc -n argocd"
echo "   View logs: kubectl logs -f deployment/argocd-server -n argocd"
echo "   Delete initial secret: kubectl -n argocd delete secret argocd-initial-admin-secret"
echo ""
