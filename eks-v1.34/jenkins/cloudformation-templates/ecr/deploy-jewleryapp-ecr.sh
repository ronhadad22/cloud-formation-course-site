#!/bin/bash

# Deploy ECR CloudFormation stack for Jewelry App repositories

set -e

# Configuration
STACK_NAME="jewleryapp-ecr-repositories"
TEMPLATE_FILE="jewleryapp-ecr-repositories.yaml"
REGION="us-east-1"
PROFILE="int-profile"

# Parameters
PROJECT_NAME="jewleryapp"
ENVIRONMENT="dev"
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

echo "🚀 Deploying Jewelry App ECR Repositories CloudFormation Stack..."

# Deploy CloudFormation stack
print_step "Deploying CloudFormation stack..."
aws cloudformation deploy \
    --template-file $TEMPLATE_FILE \
    --stack-name $STACK_NAME \
    --parameter-overrides \
        ProjectName=$PROJECT_NAME \
        Environment=$ENVIRONMENT \
        EnableImageScanning=$ENABLE_IMAGE_SCANNING \
        ImageTagMutability=$IMAGE_TAG_MUTABILITY \
        LifecyclePolicyDays=$LIFECYCLE_POLICY_DAYS \
    --region $REGION \
    --profile $PROFILE

print_success "CloudFormation stack deployed successfully"

# Get stack outputs
print_step "Getting repository information..."

AUTH_URI=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $REGION \
    --profile $PROFILE \
    --query 'Stacks[0].Outputs[?OutputKey==`AuthRepositoryURI`].OutputValue' \
    --output text)

BACKEND_URI=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $REGION \
    --profile $PROFILE \
    --query 'Stacks[0].Outputs[?OutputKey==`BackendRepositoryURI`].OutputValue' \
    --output text)

FRONTEND_URI=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $REGION \
    --profile $PROFILE \
    --query 'Stacks[0].Outputs[?OutputKey==`FrontendRepositoryURI`].OutputValue' \
    --output text)

ECR_REGISTRY=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $REGION \
    --profile $PROFILE \
    --query 'Stacks[0].Outputs[?OutputKey==`ECRRegistry`].OutputValue' \
    --output text)

echo ""
echo "🎉 Jewelry App ECR repositories created successfully!"
echo ""
echo "📋 Stack Information:"
echo "   Stack Name: $STACK_NAME"
echo "   Region: $REGION"
echo "   Project: $PROJECT_NAME"
echo "   Environment: $ENVIRONMENT"
echo ""
echo "📦 Created Repositories:"
echo "   Auth Service:  $AUTH_URI"
echo "   Backend (BE):  $BACKEND_URI"
echo "   Frontend (FE): $FRONTEND_URI"
echo ""
echo "🔗 ECR Registry: $ECR_REGISTRY"
echo ""
echo "⚙️ Repository Configuration:"
echo "   Image Scanning: $ENABLE_IMAGE_SCANNING"
echo "   Tag Mutability: $IMAGE_TAG_MUTABILITY"
echo "   Lifecycle Policy: Delete untagged images after $LIFECYCLE_POLICY_DAYS days"
echo "   Image Retention: Keep last 10 tagged images"
echo ""

# Create Jenkins environment variables file
print_step "Creating Jenkins environment variables..."
cat > jewleryapp-jenkins-env.yaml << EOF
# Jenkins Environment Variables for Jewelry App ECR Repositories
# Add these to your Jenkins pipeline or global environment variables

ECR_REGISTRY: "$ECR_REGISTRY"
ECR_REGION: "$REGION"

# Repository URIs
AUTH_REPO: "$AUTH_URI"
BACKEND_REPO: "$BACKEND_URI"
FRONTEND_REPO: "$FRONTEND_URI"

# Repository Names (for tagging)
AUTH_NAME: "$PROJECT_NAME/auth"
BACKEND_NAME: "$PROJECT_NAME/be"
FRONTEND_NAME: "$PROJECT_NAME/fe"
EOF

print_success "Jenkins environment variables created: jewleryapp-jenkins-env.yaml"

# Create sample Jenkins pipeline for jewelry app
print_step "Creating sample Jenkins pipeline..."
cat > jewleryapp-pipeline.groovy << 'EOF'
pipeline {
    agent { label 'docker ecr' }
    
    environment {
        ECR_REGISTRY = "950555670656.dkr.ecr.us-east-1.amazonaws.com"
        AWS_DEFAULT_REGION = "us-east-1"
        IMAGE_TAG = "${BUILD_NUMBER}"
        PROJECT_NAME = "jewleryapp"
    }
    
    parameters {
        choice(
            name: 'SERVICE',
            choices: ['auth', 'be', 'fe'],
            description: 'Select service to build'
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
                        def serviceName = params.SERVICE
                        def repoName = "${PROJECT_NAME}/${serviceName}"
                        
                        sh """
                            echo "Building ${serviceName} service..."
                            
                            # Navigate to service directory if it exists
                            if [ -d "${serviceName}" ]; then
                                cd ${serviceName}
                            fi
                            
                            # Build Docker image
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
                        def serviceName = params.SERVICE
                        def repoName = "${PROJECT_NAME}/${serviceName}"
                        
                        sh """
                            # Tag for ECR
                            docker tag ${repoName}:${IMAGE_TAG} ${ECR_REGISTRY}/${repoName}:${IMAGE_TAG}
                            docker tag ${repoName}:latest ${ECR_REGISTRY}/${repoName}:latest
                            
                            # Push to ECR
                            docker push ${ECR_REGISTRY}/${repoName}:${IMAGE_TAG}
                            docker push ${ECR_REGISTRY}/${repoName}:latest
                            
                            echo "✅ Successfully pushed ${repoName}:${IMAGE_TAG} to ECR"
                        """
                    }
                }
            }
        }
    }
    
    post {
        always {
            echo "Build completed for ${params.SERVICE}:${IMAGE_TAG}"
        }
        success {
            echo "✅ Successfully built and pushed ${params.SERVICE}:${IMAGE_TAG}"
        }
        failure {
            echo "❌ Failed to build/push ${params.SERVICE}:${IMAGE_TAG}"
        }
        cleanup {
            container('docker') {
                sh '''
                    # Clean up local images to save space
                    docker system prune -f
                '''
            }
        }
    }
}
EOF

print_success "Sample Jenkins pipeline created: jewleryapp-pipeline.groovy"

echo ""
echo "📝 Next Steps:"
echo "   1. Use the repository URIs in your Jenkins pipelines:"
echo "      - Auth: $AUTH_URI"
echo "      - Backend: $BACKEND_URI" 
echo "      - Frontend: $FRONTEND_URI"
echo ""
echo "   2. Import jewleryapp-jenkins-env.yaml into Jenkins environment variables"
echo "   3. Use jewleryapp-pipeline.groovy as a template for your builds"
echo "   4. Ensure Jenkins agents have ECR access via IRSA"
echo ""
echo "🧪 Test ECR Access:"
echo "   aws ecr describe-repositories --region $REGION --profile $PROFILE"
echo ""
echo "🔐 Test ECR Login:"
echo "   aws ecr get-login-password --region $REGION --profile $PROFILE | \\"
echo "     docker login --username AWS --password-stdin $ECR_REGISTRY"
echo ""
echo "✨ Jewelry App ECR repositories are ready for Jenkins CI/CD!"
