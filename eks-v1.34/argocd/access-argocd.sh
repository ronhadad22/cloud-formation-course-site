#!/bin/bash

# Access ArgoCD - Get credentials and start port forwarding

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🔐 ArgoCD Access Information${NC}"
echo ""

# Get admin password
ADMIN_PASSWORD=$(kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" 2>/dev/null | base64 -d)

if [ -z "$ADMIN_PASSWORD" ]; then
    echo -e "${YELLOW}⚠️  Admin password not found. ArgoCD may still be initializing.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Credentials:${NC}"
echo "   URL: http://localhost:8081"
echo "   Username: admin"
echo "   Password: $ADMIN_PASSWORD"
echo ""
echo -e "${BLUE}📋 Starting port forward...${NC}"
echo "   Press Ctrl+C to stop"
echo ""

# Start port forwarding
kubectl port-forward service/argocd-server -n argocd 8081:80
