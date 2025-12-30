#!/bin/bash

# Prometheus Uninstall Script for EKS
# This script removes the kube-prometheus-stack from your EKS cluster

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Prometheus Stack Removal ===${NC}\n"

# Check if helm is installed
if ! command -v helm &> /dev/null; then
    echo -e "${RED}Error: helm is not installed${NC}"
    exit 1
fi

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}Error: kubectl is not installed${NC}"
    exit 1
fi

# Confirm deletion
echo -e "${RED}WARNING: This will delete all Prometheus data and configurations!${NC}"
read -p "Are you sure you want to uninstall Prometheus? (yes/no): " -r
echo
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo "Uninstall cancelled."
    exit 0
fi

# Uninstall Helm release
echo -e "${YELLOW}Uninstalling Prometheus Helm release...${NC}"
helm uninstall prometheus -n monitoring || echo "Release not found or already deleted"
echo -e "${GREEN}✓ Helm release removed${NC}\n"

# Wait for pods to terminate
echo -e "${YELLOW}Waiting for pods to terminate...${NC}"
kubectl wait --for=delete pod -l "release=prometheus" -n monitoring --timeout=120s 2>/dev/null || true
echo -e "${GREEN}✓ Pods terminated${NC}\n"

# Delete PVCs (optional - comment out to keep data)
echo -e "${YELLOW}Deleting Persistent Volume Claims...${NC}"
kubectl delete pvc -n monitoring -l "release=prometheus" 2>/dev/null || echo "No PVCs found"
echo -e "${GREEN}✓ PVCs deleted${NC}\n"

# Ask about namespace deletion
read -p "Do you want to delete the monitoring namespace? (yes/no): " -r
echo
if [[ $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo -e "${YELLOW}Deleting monitoring namespace...${NC}"
    kubectl delete namespace monitoring
    echo -e "${GREEN}✓ Namespace deleted${NC}\n"
else
    echo "Keeping monitoring namespace"
fi

echo -e "${GREEN}=== Uninstall Complete ===${NC}\n"
