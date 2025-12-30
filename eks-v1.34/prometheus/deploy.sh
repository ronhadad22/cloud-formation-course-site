#!/bin/bash

# Prometheus Deployment Script for EKS
# This script deploys the kube-prometheus-stack to your existing EKS cluster

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Prometheus Stack Deployment for EKS ===${NC}\n"

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}Error: kubectl is not installed${NC}"
    exit 1
fi

# Check if helm is installed
if ! command -v helm &> /dev/null; then
    echo -e "${RED}Error: helm is not installed${NC}"
    echo "Install with: brew install helm"
    exit 1
fi

# Check cluster connection
echo -e "${YELLOW}Checking EKS cluster connection...${NC}"
if ! kubectl cluster-info &> /dev/null; then
    echo -e "${RED}Error: Cannot connect to Kubernetes cluster${NC}"
    echo "Make sure your kubeconfig is configured correctly"
    echo "Run: aws eks update-kubeconfig --region <region> --name <cluster-name>"
    exit 1
fi

CLUSTER_NAME=$(kubectl config current-context)
echo -e "${GREEN}✓ Connected to cluster: ${CLUSTER_NAME}${NC}\n"

# Add Prometheus Helm repository
echo -e "${YELLOW}Adding Prometheus Helm repository...${NC}"
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
echo -e "${GREEN}✓ Repository added${NC}\n"

# Create monitoring namespace
echo -e "${YELLOW}Creating monitoring namespace...${NC}"
kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -
echo -e "${GREEN}✓ Namespace ready${NC}\n"

# Deploy Prometheus stack
echo -e "${YELLOW}Deploying Prometheus stack...${NC}"
helm upgrade --install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --values values.yaml \
  --wait \
  --timeout 10m

echo -e "${GREEN}✓ Prometheus stack deployed successfully!${NC}\n"

# Wait for pods to be ready
echo -e "${YELLOW}Waiting for pods to be ready...${NC}"
kubectl wait --for=condition=ready pod -l "release=prometheus" -n monitoring --timeout=300s

echo -e "\n${GREEN}=== Deployment Complete ===${NC}\n"

# Get service endpoints
echo -e "${YELLOW}Service Endpoints:${NC}"
echo ""
echo "Prometheus:"
PROM_LB=$(kubectl get svc -n monitoring prometheus-kube-prometheus-prometheus -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null)
if [ -n "$PROM_LB" ]; then
    echo "  http://${PROM_LB}:9090"
else
    echo "  Pending... (LoadBalancer provisioning)"
fi
echo ""
echo "Grafana:"
GRAFANA_LB=$(kubectl get svc -n monitoring prometheus-grafana -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null)
if [ -n "$GRAFANA_LB" ]; then
    echo "  http://${GRAFANA_LB}"
else
    echo "  Pending... (LoadBalancer provisioning)"
fi
echo "  Username: admin"
echo "  Password: admin123"
echo ""
echo "Alertmanager:"
ALERT_LB=$(kubectl get svc -n monitoring prometheus-kube-prometheus-alertmanager -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null)
if [ -n "$ALERT_LB" ]; then
    echo "  http://${ALERT_LB}:9093"
else
    echo "  Pending... (LoadBalancer provisioning)"
fi
echo ""

echo -e "${YELLOW}Useful Commands:${NC}"
echo ""
echo "Check pod status:"
echo "  kubectl get pods -n monitoring"
echo ""
echo "View Prometheus logs:"
echo "  kubectl logs -n monitoring -l app.kubernetes.io/name=prometheus -f"
echo ""
echo "View Grafana logs:"
echo "  kubectl logs -n monitoring -l app.kubernetes.io/name=grafana -f"
echo ""
echo "Access Grafana locally (port-forward):"
echo "  kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80"
echo "  Then visit: http://localhost:3000"
echo ""
echo "Access Prometheus locally (port-forward):"
echo "  kubectl port-forward -n monitoring svc/prometheus-kube-prometheus-prometheus 9090:9090"
echo "  Then visit: http://localhost:9090"
