# EC2 Deployment Guide

## Quick Deploy to EC2

### 1. Clone Repository on EC2

```bash
# SSH to your EC2 instance
ssh -i your-key.pem ec2-user@your-ec2-ip

# Install git if not present
sudo yum install -y git

# Clone your repository
git clone https://github.com/your-username/your-repo.git
cd your-repo/cognito
```

### 2. Install Node.js

```bash
# Install Node.js 18.x
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# Verify installation
node --version
npm --version
```

### 3. Setup Backend

```bash
cd backend

# Install dependencies
npm install

# Create .env file
cat > .env << EOF
AWS_REGION=us-east-1
COGNITO_USER_POOL_ID=us-east-1_ZWzVtGG7c
COGNITO_CLIENT_ID=13thtsksprs588ud2sqelcfkp6
PORT=3001
EOF

# For ALB with Hosted UI, use server-alb.js
# For React app with JWT, use server.js

# Test run
node server-alb.js
```

### 4. Setup as System Service

```bash
# Create systemd service
sudo tee /etc/systemd/system/cognito-backend.service > /dev/null << EOF
[Unit]
Description=Cognito Backend API
After=network.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/home/ec2-user/your-repo/cognito/backend
ExecStart=/usr/bin/node server-alb.js
Restart=on-failure
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=cognito-backend

[Install]
WantedBy=multi-user.target
EOF

# Start service
sudo systemctl daemon-reload
sudo systemctl enable cognito-backend
sudo systemctl start cognito-backend

# Check status
sudo systemctl status cognito-backend

# View logs
sudo journalctl -u cognito-backend -f
```

### 5. Configure Security Group

```bash
# Get the BackendSecurityGroup ID from CloudFormation
aws cloudformation describe-stacks \
  --stack-name cognito-alb-stack \
  --query 'Stacks[0].Outputs[?OutputKey==`BackendSecurityGroupId`].OutputValue' \
  --output text

# Attach to EC2 instance
aws ec2 modify-instance-attribute \
  --instance-id i-xxxxx \
  --groups sg-xxxxx
```

### 6. Register with ALB Target Group

```bash
# Get Target Group ARN
TG_ARN=$(aws cloudformation describe-stacks \
  --stack-name cognito-alb-stack \
  --query 'Stacks[0].Outputs[?OutputKey==`TargetGroupArn`].OutputValue' \
  --output text)

# Register instance
aws elbv2 register-targets \
  --target-group-arn $TG_ARN \
  --targets Id=i-xxxxx
```

### 7. Test

```bash
# Get ALB DNS
ALB_DNS=$(aws cloudformation describe-stacks \
  --stack-name cognito-alb-stack \
  --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerDNS`].OutputValue' \
  --output text)

# Test health endpoint
curl http://$ALB_DNS/api/health

# Test protected endpoint (will redirect to Cognito login)
curl -L http://$ALB_DNS/api/protected
```

## Git Commands (Run on Your Local Machine)

```bash
cd /Users/rwnhdd/Downloads/cloudformation/cognito

# Initialize git if not already
git init

# Add files
git add .

# Commit
git commit -m "Initial commit: Cognito auth app with ALB support"

# Add remote (create repo on GitHub first)
git remote add origin https://github.com/your-username/your-repo.git

# Push
git push -u origin main
```

## Troubleshooting

### Backend not starting
```bash
# Check logs
sudo journalctl -u cognito-backend -n 50

# Check if port is in use
sudo netstat -tlnp | grep 3001

# Check environment variables
cat /home/ec2-user/your-repo/cognito/backend/.env
```

### ALB health check failing
```bash
# Test locally on EC2
curl http://localhost:3001/api/health

# Check security group allows ALB
aws ec2 describe-security-groups --group-ids sg-xxxxx
```

### Can't reach ALB
```bash
# Check target health
aws elbv2 describe-target-health \
  --target-group-arn $TG_ARN

# Should show "healthy" status
```
