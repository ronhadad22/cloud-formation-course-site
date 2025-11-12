# Frontend Deployment - Simple Guide

## What You Need
- AWS account with CLI configured
- Node.js installed

## Step 1: Request Your Domains & SSL Certificate
**Email your lecturer FIRST to get domains and SSL certificate:**
```
Subject: Need subdomains and SSL certificate

Hi,
I need two subdomains for my project:
- Frontend: [your-name]-fe.iitc-course.com
- Backend: [your-name]-be.iitc-course.com

Please also provide the SSL certificate ARN for these domains.

Thanks!
```

## Step 2: Deploy Infrastructure

1. Go to AWS CloudFormation Console
2. Create Stack → Upload `simple-frontend-s3-cloudfront.yaml`
3. Fill parameters:
   - **Stack Name**: `your-name-frontend`
   - **DomainName**: `iitc-course.com`
   - **SubdomainName**: `your-name-fe`
   - **SSLCertificateArn**: `[SSL_CERT_ARN_FROM_LECTURER]`
   - **BackendAPIURL**: `https://your-name-be.iitc-course.com`
   - **Environment**: `production`
4. Click Create Stack and wait

## Step 3: Deploy Your App

Run these commands one by one:

```bash
# 1. Clone repo
git clone https://github.com/ronhadad22/3tierapp-course-site.git
cd 3tierapp-course-site/course-site

# 2. Install
npm install

# 3. Build (use your backend domain)
REACT_APP_API_URL=https://your-name-be.iitc-course.com npm run build

# 4. Get bucket name
aws cloudformation describe-stacks --stack-name your-name-frontend --query "Stacks[0].Outputs[?OutputKey=='WebsiteBucketName'].OutputValue" --output text

# 5. Upload (replace YOUR_BUCKET_NAME from step 4)
aws s3 sync ./build s3://YOUR_BUCKET_NAME --delete

# 6. Get distribution ID
aws cloudformation describe-stacks --stack-name your-name-frontend --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue" --output text

# 7. Clear cache (replace YOUR_DISTRIBUTION_ID from step 6)
aws cloudfront create-invalidation --distribution-id YOUR_DISTRIBUTION_ID --paths "/*"
```

## Step 4: Get Your Website URL

```bash
aws cloudformation describe-stacks --stack-name your-name-frontend --query "Stacks[0].Outputs[?OutputKey=='WebsiteURL'].OutputValue" --output text
```

## Step 5: Request DNS Setup
**Email your lecturer with CloudFront URL from Step 4:**
```
Subject: Please setup DNS

Hi,
My frontend is deployed. Please point [your-name]-fe.iitc-course.com to:
[CLOUDFRONT_URL_FROM_STEP_4]

Thanks!
```

## Done!
Your site will be live at `https://your-name-fe.iitc-course.com` after lecturer sets up DNS.

---
**Problems?** Contact your lecturer.
