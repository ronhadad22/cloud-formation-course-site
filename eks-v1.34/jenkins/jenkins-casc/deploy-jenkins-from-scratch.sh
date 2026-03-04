#!/bin/bash

set -e

echo "🚀 Deploying Jenkins from scratch with Configuration as Code..."

# Configuration
CLUSTER_NAME="student-eks-cluster"
REGION="us-east-1"
PROFILE="int-profile"
NAMESPACE="jenkins"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Step 1: Configure kubectl
print_step "Configuring kubectl for EKS cluster..."
aws eks update-kubeconfig --region $REGION --name $CLUSTER_NAME --profile $PROFILE
kubectl get nodes
print_success "Connected to EKS cluster"

# Step 2: Create storage class
print_step "Creating storage class for Jenkins..."
kubectl apply -f sc.yaml
print_success "Storage class created"

# Step 3: Setup IRSA
print_step "Setting up IRSA for ECR access..."
cd irsa-jenkins
chmod +x setup.sh
./setup.sh
cd ..
print_success "IRSA setup completed"

# Step 4: Add Helm repository
print_step "Adding Jenkins Helm repository..."
helm repo add jenkinsci https://charts.jenkins.io
helm repo update
print_success "Helm repository updated"

# Step 5: Deploy Jenkins with JCasC
print_step "Deploying Jenkins with Configuration as Code..."
helm install jenkins jenkinsci/jenkins \
    -n $NAMESPACE \
    --create-namespace \
    -f jenkins-values-casc.yaml \
    --wait \
    --timeout=10m

print_success "Jenkins deployed successfully"

# Step 6: Wait for Jenkins to be ready
print_step "Waiting for Jenkins to be fully ready..."
kubectl wait --for=condition=ready pod -l app.kubernetes.io/component=jenkins-controller -n $NAMESPACE --timeout=600s

# Step 7: Get access information
print_step "Getting Jenkins access information..."
JENKINS_PASSWORD=$(kubectl exec --namespace $NAMESPACE -it svc/jenkins -c jenkins -- /bin/cat /run/secrets/additional/chart-admin-password | tr -d '\r')

echo ""
echo "🎉 Jenkins deployment completed successfully!"
echo ""
echo "📍 Access Information:"
echo "   URL: http://localhost:8080 (after port-forward)"
echo "   Username: admin"
echo "   Password: $JENKINS_PASSWORD"
echo ""
echo "🔗 To access Jenkins, run:"
echo "   kubectl port-forward svc/jenkins 8080:8080 -n $NAMESPACE"
echo ""
echo "📝 Pre-configured features:"
echo "   ✅ Kubernetes cloud with ECR-enabled agents"
echo "   ✅ IRSA for automatic ECR authentication"
echo "   ✅ Sample ECR build pipeline job"
echo "   ✅ Essential plugins pre-installed"
echo "   ✅ Security and authorization configured"
echo ""
echo "🧪 Test the setup:"
echo "   1. Access Jenkins UI"
echo "   2. Run the 'ecr-build-sample' job"
echo "   3. Check ECR for the pushed image"
echo ""

# Optional: Start port-forward automatically
read -p "Start port-forward now? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_step "Starting port-forward..."
    kubectl port-forward svc/jenkins 8080:8080 -n $NAMESPACE
fi
