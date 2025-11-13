#!/bin/bash

# IRSA Cleanup for Jenkins ECR Access
# Run with: ./cleanup.sh

PROFILE="int-profile"
ACCOUNT_ID="950555670656"

echo "🧹 Cleaning up IRSA resources..."

# 1. Delete Kubernetes resources
echo "🗑️ Deleting service account..."
kubectl delete -f jenkins-service-account.yaml --ignore-not-found

# 2. Detach policy from role
echo "🔗 Detaching policy..."
aws iam detach-role-policy \
    --role-name JenkinsECRRole \
    --policy-arn arn:aws:iam::$ACCOUNT_ID:policy/JenkinsECRPolicy \
    --profile $PROFILE

# 3. Delete IAM role
echo "🔑 Deleting IAM role..."
aws iam delete-role \
    --role-name JenkinsECRRole \
    --profile $PROFILE

# 4. Delete IAM policy
echo "📋 Deleting ECR policy..."
aws iam delete-policy \
    --policy-arn arn:aws:iam::$ACCOUNT_ID:policy/JenkinsECRPolicy \
    --profile $PROFILE

echo "✅ Cleanup complete!"
