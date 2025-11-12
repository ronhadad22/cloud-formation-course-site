#!/bin/bash

# Frontend Deployment Script for React App
# This script builds and deploys the React frontend to S3 + CloudFront

set -euo pipefail

# Configuration
REPO_URL="https://github.com/ronhadad22/3tierapp-course-site.git"
FRONTEND_PATH="course-site"
BUILD_DIR="build"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Required Parameters (provide via environment variables or command line):"
    echo "  -b, --backend-url BACKEND_URL    Backend API URL (e.g., https://your-alb.elb.amazonaws.com)"
    echo "  -s, --s3-bucket S3_BUCKET        S3 bucket name for deployment"
    echo "  -d, --distribution-id DIST_ID    CloudFront distribution ID"
    echo ""
    echo "Optional Parameters:"
    echo "  -p, --profile AWS_PROFILE        AWS CLI profile to use (default: default)"
    echo "  -r, --region AWS_REGION          AWS region (default: us-east-1)"
    echo "  -c, --clean                      Clean build directory before deployment"
    echo "  -n, --no-cache                   Skip CloudFront cache invalidation"
    echo "  -h, --help                       Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  REACT_APP_API_URL               Backend API URL"
    echo "  S3_BUCKET_NAME                  S3 bucket name"
    echo "  CLOUDFRONT_DISTRIBUTION_ID      CloudFront distribution ID"
    echo "  AWS_PROFILE                     AWS CLI profile"
    echo "  AWS_REGION                      AWS region"
    echo ""
    echo "Examples:"
    echo "  $0 -b https://my-alb.elb.amazonaws.com -s my-frontend-bucket -d E1234567890"
    echo "  REACT_APP_API_URL=https://api.example.com S3_BUCKET_NAME=my-bucket $0"
}

# Parse command line arguments
BACKEND_URL="${REACT_APP_API_URL:-}"
S3_BUCKET="${S3_BUCKET_NAME:-}"
DISTRIBUTION_ID="${CLOUDFRONT_DISTRIBUTION_ID:-}"
AWS_PROFILE="${AWS_PROFILE:-default}"
AWS_REGION="${AWS_REGION:-us-east-1}"
CLEAN_BUILD=false
SKIP_INVALIDATION=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -b|--backend-url)
            BACKEND_URL="$2"
            shift 2
            ;;
        -s|--s3-bucket)
            S3_BUCKET="$2"
            shift 2
            ;;
        -d|--distribution-id)
            DISTRIBUTION_ID="$2"
            shift 2
            ;;
        -p|--profile)
            AWS_PROFILE="$2"
            shift 2
            ;;
        -r|--region)
            AWS_REGION="$2"
            shift 2
            ;;
        -c|--clean)
            CLEAN_BUILD=true
            shift
            ;;
        -n|--no-cache)
            SKIP_INVALIDATION=true
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Validate required parameters
if [[ -z "$BACKEND_URL" ]]; then
    print_error "Backend URL is required. Use -b/--backend-url or set REACT_APP_API_URL"
    show_usage
    exit 1
fi

if [[ -z "$S3_BUCKET" ]]; then
    print_error "S3 bucket name is required. Use -s/--s3-bucket or set S3_BUCKET_NAME"
    show_usage
    exit 1
fi

if [[ -z "$DISTRIBUTION_ID" ]]; then
    print_error "CloudFront distribution ID is required. Use -d/--distribution-id or set CLOUDFRONT_DISTRIBUTION_ID"
    show_usage
    exit 1
fi

# Validate tools
print_status "Checking required tools..."

if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js first."
    exit 1
fi

if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install npm first."
    exit 1
fi

if ! command -v git &> /dev/null; then
    print_error "git is not installed. Please install git first."
    exit 1
fi

if ! command -v aws &> /dev/null; then
    print_error "AWS CLI is not installed. Please install AWS CLI first."
    exit 1
fi

print_success "All required tools are available"

# Validate AWS credentials
print_status "Validating AWS credentials..."
if ! aws sts get-caller-identity --profile "$AWS_PROFILE" &> /dev/null; then
    print_error "AWS credentials not configured for profile: $AWS_PROFILE"
    print_error "Please run: aws configure --profile $AWS_PROFILE"
    exit 1
fi

print_success "AWS credentials validated for profile: $AWS_PROFILE"

# Create temporary directory
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

print_status "Using temporary directory: $TEMP_DIR"

# Clone repository
print_status "Cloning repository..."
cd "$TEMP_DIR"
git clone "$REPO_URL" repo
cd "repo/$FRONTEND_PATH"

print_success "Repository cloned successfully"

# Check if package.json exists
if [[ ! -f "package.json" ]]; then
    print_error "package.json not found in $FRONTEND_PATH"
    print_error "Please verify the frontend path is correct"
    exit 1
fi

# Install dependencies
print_status "Installing dependencies..."
npm ci --silent

print_success "Dependencies installed successfully"

# Clean build directory if requested
if [[ "$CLEAN_BUILD" == true ]] && [[ -d "$BUILD_DIR" ]]; then
    print_status "Cleaning existing build directory..."
    rm -rf "$BUILD_DIR"
fi

# Configure environment
print_status "Configuring environment variables..."
export REACT_APP_API_URL="$BACKEND_URL"

# Create .env.production file
cat > .env.production << EOF
# Generated by deployment script
REACT_APP_API_URL=$BACKEND_URL
GENERATE_SOURCEMAP=false
EOF

print_success "Environment configured with API URL: $BACKEND_URL"

# Build application
print_status "Building React application..."
npm run build

if [[ ! -d "$BUILD_DIR" ]]; then
    print_error "Build failed - $BUILD_DIR directory not found"
    exit 1
fi

print_success "React application built successfully"

# Upload to S3
print_status "Uploading to S3 bucket: $S3_BUCKET"
aws s3 sync "$BUILD_DIR" "s3://$S3_BUCKET" \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    --delete \
    --cache-control "public, max-age=31536000" \
    --exclude "*.html" \
    --exclude "service-worker.js" \
    --exclude "manifest.json"

# Upload HTML files with no-cache
aws s3 sync "$BUILD_DIR" "s3://$S3_BUCKET" \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    --cache-control "no-cache, no-store, must-revalidate" \
    --include "*.html" \
    --include "service-worker.js" \
    --include "manifest.json"

print_success "Files uploaded to S3 successfully"

# Invalidate CloudFront cache
if [[ "$SKIP_INVALIDATION" == false ]]; then
    print_status "Invalidating CloudFront cache..."
    INVALIDATION_ID=$(aws cloudfront create-invalidation \
        --profile "$AWS_PROFILE" \
        --distribution-id "$DISTRIBUTION_ID" \
        --paths "/*" \
        --query 'Invalidation.Id' \
        --output text)
    
    print_success "CloudFront invalidation created: $INVALIDATION_ID"
    print_status "Cache invalidation may take 5-15 minutes to complete"
else
    print_warning "Skipping CloudFront cache invalidation"
fi

# Summary
print_success "Deployment completed successfully!"
echo ""
echo "📋 Deployment Summary:"
echo "  • Repository: $REPO_URL"
echo "  • Frontend Path: $FRONTEND_PATH"
echo "  • Backend URL: $BACKEND_URL"
echo "  • S3 Bucket: $S3_BUCKET"
echo "  • CloudFront Distribution: $DISTRIBUTION_ID"
echo "  • AWS Profile: $AWS_PROFILE"
echo "  • AWS Region: $AWS_REGION"
echo ""
echo "🌐 Your frontend is now deployed and accessible via CloudFront!"

# Get CloudFront domain name
CLOUDFRONT_DOMAIN=$(aws cloudfront get-distribution \
    --profile "$AWS_PROFILE" \
    --id "$DISTRIBUTION_ID" \
    --query 'Distribution.DomainName' \
    --output text 2>/dev/null || echo "Unable to retrieve")

if [[ "$CLOUDFRONT_DOMAIN" != "Unable to retrieve" ]]; then
    echo "  • CloudFront URL: https://$CLOUDFRONT_DOMAIN"
fi

echo ""
print_status "Deployment script completed successfully!"
