#!/bin/bash
set -e

echo "Starting application..."

# Get region from instance metadata
TOKEN=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600" 2>/dev/null || true)
if [ -n "$TOKEN" ]; then
  REGION=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/placement/region 2>/dev/null || true)
else
  REGION=$(curl -s http://169.254.169.254/latest/meta-data/placement/region 2>/dev/null || true)
fi

REGION=$(echo "$REGION" | tr -d '[:space:]')
if [ -z "$REGION" ]; then
  REGION="us-east-1"
fi

export AWS_DEFAULT_REGION="$REGION"

# Get account ID
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)

echo "Region: $REGION"
echo "Account: $ACCOUNT"

# Copy image tag from deployment
if [ -f /home/ec2-user/deployment/image_tag.txt ]; then
  IMAGE_TAG=$(cat /home/ec2-user/deployment/image_tag.txt)
else
  IMAGE_TAG="latest"
fi

IMAGE_URI="$ACCOUNT.dkr.ecr.$REGION.amazonaws.com/codecommit-lab-app:$IMAGE_TAG"

echo "Deploying image: $IMAGE_URI"

# Login to ECR
aws ecr get-login-password --region $REGION | \
  docker login --username AWS --password-stdin $ACCOUNT.dkr.ecr.$REGION.amazonaws.com

# Update docker-compose with new image
cd /home/ec2-user/app
sed -i "s|image:.*|image: $IMAGE_URI|" docker-compose.yml

# Pull and start
docker compose pull
docker compose up -d

echo "Application started successfully"
docker ps
