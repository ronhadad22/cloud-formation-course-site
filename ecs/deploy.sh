#!/bin/bash

set -e

export AWS_PROFILE=int-profile
REGION="us-east-1"
ENV_NAME="ecs-demo"

echo "=== Deploying ECS Cluster with Service Discovery ==="
echo ""

# Step 1: Deploy VPC
echo "Step 1: Deploying VPC..."
aws cloudformation create-stack \
  --stack-name ${ENV_NAME}-vpc \
  --template-body file://01-vpc.yaml \
  --region $REGION \
  --parameters ParameterKey=EnvironmentName,ParameterValue=$ENV_NAME

echo "Waiting for VPC stack to complete..."
aws cloudformation wait stack-create-complete \
  --stack-name ${ENV_NAME}-vpc \
  --region $REGION

VPC_ID=$(aws cloudformation describe-stacks \
  --stack-name ${ENV_NAME}-vpc \
  --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`VPC`].OutputValue' \
  --output text)

echo "✓ VPC created: $VPC_ID"
echo ""

# Step 2: Deploy ECS Cluster
echo "Step 2: Deploying ECS Cluster..."
aws cloudformation create-stack \
  --stack-name ${ENV_NAME}-cluster \
  --template-body file://02-ecs-cluster.yaml \
  --region $REGION \
  --parameters ParameterKey=EnvironmentName,ParameterValue=$ENV_NAME \
  --capabilities CAPABILITY_IAM

echo "Waiting for ECS cluster stack to complete..."
aws cloudformation wait stack-create-complete \
  --stack-name ${ENV_NAME}-cluster \
  --region $REGION

CLUSTER_NAME=$(aws cloudformation describe-stacks \
  --stack-name ${ENV_NAME}-cluster \
  --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`ClusterName`].OutputValue' \
  --output text)

echo "✓ ECS Cluster created: $CLUSTER_NAME"
echo ""

# Step 3: Deploy Service Discovery Namespace
echo "Step 3: Deploying Service Discovery Namespace..."
aws cloudformation create-stack \
  --stack-name ${ENV_NAME}-service-discovery \
  --template-body file://03-service-discovery.yaml \
  --region $REGION \
  --parameters ParameterKey=EnvironmentName,ParameterValue=$ENV_NAME

echo "Waiting for Service Discovery stack to complete..."
aws cloudformation wait stack-create-complete \
  --stack-name ${ENV_NAME}-service-discovery \
  --region $REGION

NAMESPACE_ID=$(aws cloudformation describe-stacks \
  --stack-name ${ENV_NAME}-service-discovery \
  --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`NamespaceId`].OutputValue' \
  --output text)

echo "✓ Service Discovery Namespace created: $NAMESPACE_ID (${ENV_NAME}.local)"
echo ""

# Step 4: Wait for ECS instances to register
echo "Step 4: Waiting for ECS instances to register with cluster..."
sleep 60

INSTANCE_COUNT=0
MAX_RETRIES=20
RETRY=0

while [ $INSTANCE_COUNT -lt 1 ] && [ $RETRY -lt $MAX_RETRIES ]; do
  INSTANCE_COUNT=$(aws ecs list-container-instances \
    --cluster $CLUSTER_NAME \
    --region $REGION \
    --query 'length(containerInstanceArns)' \
    --output text)
  
  if [ $INSTANCE_COUNT -lt 1 ]; then
    echo "  Waiting for instances... (attempt $((RETRY+1))/$MAX_RETRIES)"
    sleep 15
    RETRY=$((RETRY+1))
  fi
done

echo "✓ $INSTANCE_COUNT ECS instance(s) registered"
echo ""

# Step 5: Deploy ECS Service
echo "Step 5: Deploying ECS Service with Service Discovery..."
aws cloudformation create-stack \
  --stack-name ${ENV_NAME}-service \
  --template-body file://04-ecs-service.yaml \
  --region $REGION \
  --parameters ParameterKey=EnvironmentName,ParameterValue=$ENV_NAME

echo "Waiting for ECS service stack to complete..."
aws cloudformation wait stack-create-complete \
  --stack-name ${ENV_NAME}-service \
  --region $REGION

SERVICE_NAME=$(aws cloudformation describe-stacks \
  --stack-name ${ENV_NAME}-service \
  --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`ServiceName`].OutputValue' \
  --output text)

echo "✓ ECS Service created: $SERVICE_NAME"
echo ""

# Summary
echo "=== Deployment Complete ==="
echo ""
echo "Resources Created:"
echo "  VPC: $VPC_ID"
echo "  ECS Cluster: $CLUSTER_NAME"
echo "  Service Discovery: ${ENV_NAME}.local"
echo "  Service Endpoint: nginx.${ENV_NAME}.local"
echo "  ECS Service: $SERVICE_NAME"
echo ""

# Verify deployment
echo "Verifying ECS Service..."
aws ecs describe-services \
  --cluster $CLUSTER_NAME \
  --services $SERVICE_NAME \
  --region $REGION \
  --query 'services[0].[serviceName,status,runningCount,desiredCount]' \
  --output table

echo ""
echo "Service Discovery Services:"
aws servicediscovery list-services \
  --region $REGION \
  --filters Name=NAMESPACE_ID,Values=$NAMESPACE_ID \
  --query 'Services[].[Name,Id]' \
  --output table

echo ""
echo "✓ Deployment successful!"
echo ""
echo "Note: Tasks will register with Service Discovery at: nginx.${ENV_NAME}.local"
