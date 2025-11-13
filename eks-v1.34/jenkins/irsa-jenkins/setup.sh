#!/bin/bash

# IRSA Setup for Jenkins ECR Access
# Run with: ./setup.sh

PROFILE="int-profile"
REGION="us-east-2"
CLUSTER_NAME="student-eks-cluster"
ACCOUNT_ID="950555670656"

echo "🔐 Setting up IRSA for Jenkins ECR access..."

# 1. Create ECR Policy
echo "📋 Creating ECR policy..."
aws iam create-policy \
    --policy-name JenkinsECRPolicy \
    --policy-document file://jenkins-ecr-policy.json \
    --profile $PROFILE

# 2. Create IAM Role with Trust Policy
echo "🔑 Creating IAM role..."
aws iam create-role \
    --role-name JenkinsECRRole \
    --assume-role-policy-document file://jenkins-trust-policy.json \
    --profile $PROFILE

# 3. Attach Policy to Role
echo "🔗 Attaching policy to role..."
aws iam attach-role-policy \
    --role-name JenkinsECRRole \
    --policy-arn arn:aws:iam::$ACCOUNT_ID:policy/JenkinsECRPolicy \
    --profile $PROFILE

# 4. Update kubeconfig
echo "⚙️ Updating kubeconfig..."
aws eks update-kubeconfig \
    --region $REGION \
    --name $CLUSTER_NAME \
    --profile $PROFILE

# 5. Apply Kubernetes resources
echo "🚀 Creating service account..."
kubectl apply -f jenkins-service-account.yaml

echo "✅ IRSA setup complete!"
echo "🎯 Jenkins pods will now use IRSA for ECR access"
