#!/bin/bash

# Deploy ECR CloudFormation stack for Jenkins repositories

set -e

# Configuration
STACK_NAME="jenkins-ecr-repositories"
TEMPLATE_FILE="jenkins-ecr-repositories.yaml"
REGION="us-east-1"
PROFILE="int-profile"

# Parameters (customize as needed)
PROJECT_NAME="jenkins-demo"
ENVIRONMENT="dev"
REPOSITORY_NAMES="sample-app,auth-service,frontend,backend,api-gateway"
ENABLE_IMAGE_SCANNING="true"
IMAGE_TAG_MUTABILITY="MUTABLE"
LIFECYCLE_POLICY_DAYS="30"

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

echo "🚀 Deploying Jenkins ECR Repositories CloudFormation Stack..."

# Deploy CloudFormation stack
print_step "Deploying CloudFormation stack..."
aws cloudformation deploy \
    --template-file $TEMPLATE_FILE \
    --stack-name $STACK_NAME \
    --parameter-overrides \
        ProjectName=$PROJECT_NAME \
        Environment=$ENVIRONMENT \
        RepositoryNames=$REPOSITORY_NAMES \
        EnableImageScanning=$ENABLE_IMAGE_SCANNING \
        ImageTagMutability=$IMAGE_TAG_MUTABILITY \
        LifecyclePolicyDays=$LIFECYCLE_POLICY_DAYS \
    --region $REGION \
    --profile $PROFILE

print_success "CloudFormation stack deployed successfully"

# Get stack outputs
print_step "Getting repository information..."

SAMPLE_APP_URI=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $REGION \
    --profile $PROFILE \
    --query 'Stacks[0].Outputs[?OutputKey==`SampleAppRepositoryURI`].OutputValue' \
    --output text)

AUTH_SERVICE_URI=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $REGION \
    --profile $PROFILE \
    --query 'Stacks[0].Outputs[?OutputKey==`AuthServiceRepositoryURI`].OutputValue' \
    --output text)

FRONTEND_URI=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $REGION \
    --profile $PROFILE \
    --query 'Stacks[0].Outputs[?OutputKey==`FrontendRepositoryURI`].OutputValue' \
    --output text)

BACKEND_URI=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $REGION \
    --profile $PROFILE \
    --query 'Stacks[0].Outputs[?OutputKey==`BackendRepositoryURI`].OutputValue' \
    --output text)

API_GATEWAY_URI=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $REGION \
    --profile $PROFILE \
    --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayRepositoryURI`].OutputValue' \
    --output text)

echo ""
echo "🎉 ECR repositories created successfully!"
echo ""
echo "📋 Stack Information:"
echo "   Stack Name: $STACK_NAME"
echo "   Region: $REGION"
echo "   Project: $PROJECT_NAME"
echo "   Environment: $ENVIRONMENT"
echo ""
echo "📦 Created Repositories:"
echo "   Sample App:    $SAMPLE_APP_URI"
echo "   Auth Service:  $AUTH_SERVICE_URI"
echo "   Frontend:      $FRONTEND_URI"
echo "   Backend:       $BACKEND_URI"
echo "   API Gateway:   $API_GATEWAY_URI"
echo ""
echo "⚙️ Repository Configuration:"
echo "   Image Scanning: $ENABLE_IMAGE_SCANNING"
echo "   Tag Mutability: $IMAGE_TAG_MUTABILITY"
echo "   Lifecycle Policy: Delete untagged images after $LIFECYCLE_POLICY_DAYS days"
echo "   Image Retention: Keep last 10 tagged images"
echo ""

# Create Jenkins environment variables file
print_step "Creating Jenkins environment variables..."
cat > jenkins-ecr-env.yaml << EOF
# Jenkins Environment Variables for ECR Repositories
# Add these to your Jenkins pipeline or global environment variables

ECR_REGISTRY: "$(echo $SAMPLE_APP_URI | cut -d'/' -f1)"
ECR_REGION: "$REGION"

# Repository URIs
SAMPLE_APP_REPO: "$SAMPLE_APP_URI"
AUTH_SERVICE_REPO: "$AUTH_SERVICE_URI"
FRONTEND_REPO: "$FRONTEND_URI"
BACKEND_REPO: "$BACKEND_URI"
API_GATEWAY_REPO: "$API_GATEWAY_URI"

# Repository Names (for tagging)
SAMPLE_APP_NAME: "$PROJECT_NAME/sample-app"
AUTH_SERVICE_NAME: "$PROJECT_NAME/auth-service"
FRONTEND_NAME: "$PROJECT_NAME/frontend"
BACKEND_NAME: "$PROJECT_NAME/backend"
API_GATEWAY_NAME: "$PROJECT_NAME/api-gateway"
EOF

print_success "Jenkins environment variables created: jenkins-ecr-env.yaml"

# Create sample Jenkins pipeline
print_step "Creating sample Jenkins pipeline..."
cat > sample-pipeline.groovy << 'EOF'
pipeline {
    agent { label 'docker ecr' }
    
    environment {
        ECR_REGISTRY = "${ECR_REGISTRY}"
        AWS_DEFAULT_REGION = "${ECR_REGION}"
        IMAGE_TAG = "${BUILD_NUMBER}"
    }
    
    parameters {
        choice(
            name: 'REPOSITORY',
            choices: ['sample-app', 'auth-service', 'frontend', 'backend', 'api-gateway'],
            description: 'Select repository to build'
        )
        string(
            name: 'GIT_BRANCH',
            defaultValue: 'main',
            description: 'Git branch to build'
        )
    }
    
    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }
        
        stage('Build') {
            steps {
                container('docker') {
                    script {
                        def repoName = "${PROJECT_NAME}/${params.REPOSITORY}"
                        sh """
                            docker build -t ${repoName}:${IMAGE_TAG} .
                            docker tag ${repoName}:${IMAGE_TAG} ${repoName}:latest
                        """
                    }
                }
            }
        }
        
        stage('Push to ECR') {
            steps {
                container('aws-cli') {
                    sh 'aws ecr get-login-password --region ${AWS_DEFAULT_REGION} | docker login --username AWS --password-stdin ${ECR_REGISTRY}'
                }
                container('docker') {
                    script {
                        def repoName = "${PROJECT_NAME}/${params.REPOSITORY}"
                        sh """
                            docker tag ${repoName}:${IMAGE_TAG} ${ECR_REGISTRY}/${repoName}:${IMAGE_TAG}
                            docker tag ${repoName}:latest ${ECR_REGISTRY}/${repoName}:latest
                            
                            docker push ${ECR_REGISTRY}/${repoName}:${IMAGE_TAG}
                            docker push ${ECR_REGISTRY}/${repoName}:latest
                        """
                    }
                }
            }
        }
    }
    
    post {
        always {
            echo "Build completed for ${params.REPOSITORY}:${IMAGE_TAG}"
        }
        success {
            echo "✅ Successfully pushed ${params.REPOSITORY}:${IMAGE_TAG} to ECR"
        }
        failure {
            echo "❌ Failed to build/push ${params.REPOSITORY}:${IMAGE_TAG}"
        }
    }
}
EOF

print_success "Sample Jenkins pipeline created: sample-pipeline.groovy"

echo ""
echo "📝 Next Steps:"
echo "   1. Use the repository URIs in your Jenkins pipelines"
echo "   2. Import jenkins-ecr-env.yaml into Jenkins environment variables"
echo "   3. Use sample-pipeline.groovy as a template for your builds"
echo "   4. Ensure Jenkins agents have ECR access via IRSA"
echo ""
echo "🧪 Test ECR Access:"
echo "   aws ecr describe-repositories --region $REGION --profile $PROFILE"
echo ""
echo "✨ ECR repositories are ready for Jenkins CI/CD!"
