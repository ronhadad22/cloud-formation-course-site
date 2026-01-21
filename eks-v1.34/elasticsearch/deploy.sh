#!/bin/bash

set -e

echo "🚀 Deploying Elasticsearch and Kibana to EKS using Helm"
echo "=================================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if helm is installed
if ! command -v helm &> /dev/null; then
    echo "❌ Helm is not installed. Please install Helm first:"
    echo "   brew install helm"
    exit 1
fi

# Check if kubectl is configured
if ! kubectl cluster-info &> /dev/null; then
    echo "❌ kubectl is not configured or cannot connect to cluster"
    echo "   Run: aws eks update-kubeconfig --region us-east-1 --name student-eks-cluster"
    exit 1
fi

echo -e "${GREEN}✓${NC} Prerequisites checked"

# Add Elastic Helm repository
echo ""
echo "📦 Adding Elastic Helm repository..."
helm repo add elastic https://helm.elastic.co
helm repo update

echo -e "${GREEN}✓${NC} Helm repository added"

# Create namespace
echo ""
echo "📁 Creating namespace..."
kubectl create namespace elasticsearch --dry-run=client -o yaml | kubectl apply -f -

echo -e "${GREEN}✓${NC} Namespace created"

# Create gp3 StorageClass if it doesn't exist
echo ""
echo "💾 Creating gp3 StorageClass..."
cat <<EOF | kubectl apply -f -
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: gp3
provisioner: ebs.csi.aws.com
parameters:
  type: gp3
  fsType: ext4
  encrypted: "true"
volumeBindingMode: WaitForFirstConsumer
allowVolumeExpansion: true
EOF

echo -e "${GREEN}✓${NC} StorageClass created"

# Deploy Elasticsearch
echo ""
echo "🔍 Deploying Elasticsearch..."
helm upgrade --install elasticsearch elastic/elasticsearch \
  --namespace elasticsearch \
  --values values.yaml \
  --wait \
  --timeout 10m

echo -e "${GREEN}✓${NC} Elasticsearch deployed"

# Deploy Kibana
echo ""
echo "📊 Deploying Kibana..."
helm upgrade --install kibana elastic/kibana \
  --namespace elasticsearch \
  --values kibana-values.yaml \
  --wait \
  --timeout 5m

echo -e "${GREEN}✓${NC} Kibana deployed"

# Show status
echo ""
echo "=================================================="
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo "=================================================="
echo ""
echo "📋 Check status:"
echo "   kubectl get pods -n elasticsearch"
echo ""
echo "🔗 Get Kibana URL:"
echo "   kubectl get svc -n elasticsearch kibana-kibana"
echo ""
echo "🧪 Test Elasticsearch:"
echo "   kubectl port-forward -n elasticsearch svc/elasticsearch-master 9200:9200"
echo "   curl http://localhost:9200"
echo ""
echo -e "${YELLOW}⚠️  Note: It may take a few minutes for the LoadBalancer to be ready${NC}"
