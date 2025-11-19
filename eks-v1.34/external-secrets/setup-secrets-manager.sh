#!/bin/bash

# Setup AWS Secrets Manager with sample secrets for jewelry app

set -e

REGION="us-east-1"
PROFILE="int-profile"

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

print_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

echo "🔐 Setting up AWS Secrets Manager secrets..."

# Jenkins secrets
print_step "Creating Jenkins secrets..."
aws secretsmanager create-secret \
    --name "jenkins/admin" \
    --description "Jenkins admin credentials" \
    --secret-string '{"password":"'$(openssl rand -base64 32)'"}' \
    --region $REGION \
    --profile $PROFILE 2>/dev/null || echo "Secret jenkins/admin already exists"

aws secretsmanager create-secret \
    --name "jenkins/github" \
    --description "Jenkins GitHub integration" \
    --secret-string '{"token":"ghp_your_github_token_here"}' \
    --region $REGION \
    --profile $PROFILE 2>/dev/null || echo "Secret jenkins/github already exists"

aws secretsmanager create-secret \
    --name "jenkins/docker" \
    --description "Jenkins Docker registry credentials" \
    --secret-string '{"password":"your_docker_password_here"}' \
    --region $REGION \
    --profile $PROFILE 2>/dev/null || echo "Secret jenkins/docker already exists"

aws secretsmanager create-secret \
    --name "jenkins/ecr" \
    --description "Jenkins ECR credentials" \
    --secret-string '{"registry":"950555670656.dkr.ecr.us-east-1.amazonaws.com","token":"auto-generated"}' \
    --region $REGION \
    --profile $PROFILE 2>/dev/null || echo "Secret jenkins/ecr already exists"

# Database secrets
print_step "Creating database secrets..."
aws secretsmanager create-secret \
    --name "rds/postgres" \
    --description "PostgreSQL database credentials" \
    --secret-string '{
        "host":"your-rds-endpoint.amazonaws.com",
        "port":"5432",
        "dbname":"jewleryapp",
        "username":"postgres",
        "password":"'$(openssl rand -base64 32)'"
    }' \
    --region $REGION \
    --profile $PROFILE 2>/dev/null || echo "Secret rds/postgres already exists"

aws secretsmanager create-secret \
    --name "elasticache/redis" \
    --description "Redis cache credentials" \
    --secret-string '{
        "host":"your-redis-cluster.cache.amazonaws.com",
        "port":"6379",
        "password":"'$(openssl rand -base64 32)'"
    }' \
    --region $REGION \
    --profile $PROFILE 2>/dev/null || echo "Secret elasticache/redis already exists"

# Application secrets
print_step "Creating jewelry app secrets..."
aws secretsmanager create-secret \
    --name "jewlery-app/auth" \
    --description "Jewelry app authentication secrets" \
    --secret-string '{"jwt_secret":"'$(openssl rand -base64 64)'"}' \
    --region $REGION \
    --profile $PROFILE 2>/dev/null || echo "Secret jewlery-app/auth already exists"

aws secretsmanager create-secret \
    --name "jewlery-app/api" \
    --description "Jewelry app API secrets" \
    --secret-string '{"api_key":"'$(openssl rand -hex 32)'"}' \
    --region $REGION \
    --profile $PROFILE 2>/dev/null || echo "Secret jewlery-app/api already exists"

aws secretsmanager create-secret \
    --name "jewlery-app/encryption" \
    --description "Jewelry app encryption key" \
    --secret-string '{"key":"'$(openssl rand -base64 32)'"}' \
    --region $REGION \
    --profile $PROFILE 2>/dev/null || echo "Secret jewlery-app/encryption already exists"

aws secretsmanager create-secret \
    --name "jewlery-app/stripe" \
    --description "Stripe payment integration" \
    --secret-string '{
        "secret_key":"sk_test_your_stripe_secret_key_here",
        "publishable_key":"pk_test_your_stripe_publishable_key_here"
    }' \
    --region $REGION \
    --profile $PROFILE 2>/dev/null || echo "Secret jewlery-app/stripe already exists"

aws secretsmanager create-secret \
    --name "jewlery-app/email" \
    --description "Email service credentials" \
    --secret-string '{"password":"your_email_service_password"}' \
    --region $REGION \
    --profile $PROFILE 2>/dev/null || echo "Secret jewlery-app/email already exists"

aws secretsmanager create-secret \
    --name "jewlery-app/oauth" \
    --description "OAuth integration secrets" \
    --secret-string '{"client_secret":"your_oauth_client_secret"}' \
    --region $REGION \
    --profile $PROFILE 2>/dev/null || echo "Secret jewlery-app/oauth already exists"

aws secretsmanager create-secret \
    --name "jewlery-app/config" \
    --description "Application configuration" \
    --secret-string '{
        "db_host":"your-rds-endpoint.amazonaws.com",
        "db_port":"5432",
        "db_name":"jewleryapp",
        "redis_host":"your-redis-cluster.cache.amazonaws.com",
        "redis_port":"6379",
        "email_enabled":"true",
        "payment_enabled":"true"
    }' \
    --region $REGION \
    --profile $PROFILE 2>/dev/null || echo "Secret jewlery-app/config already exists"

print_success "AWS Secrets Manager setup completed!"

echo ""
echo "📋 Created Secrets:"
echo "   Jenkins:"
echo "     - jenkins/admin"
echo "     - jenkins/github" 
echo "     - jenkins/docker"
echo "     - jenkins/ecr"
echo ""
echo "   Database:"
echo "     - rds/postgres"
echo "     - elasticache/redis"
echo ""
echo "   Application:"
echo "     - jewlery-app/auth"
echo "     - jewlery-app/api"
echo "     - jewlery-app/encryption"
echo "     - jewlery-app/stripe"
echo "     - jewlery-app/email"
echo "     - jewlery-app/oauth"
echo "     - jewlery-app/config"
echo ""
echo "📝 Next Steps:"
echo "   1. Update secret values with your actual credentials"
echo "   2. Setup IRSA for External Secrets Operator"
echo "   3. Deploy SecretStore and ExternalSecret resources"
echo "   4. Test secret synchronization"
echo ""
echo "🔧 Update secrets with:"
echo "   aws secretsmanager update-secret --secret-id <secret-name> --secret-string '<new-value>'"
