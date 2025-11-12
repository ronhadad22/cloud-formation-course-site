# AWS Session Manager Connection Scripts

This repository contains CloudFormation templates and helper scripts for connecting to EC2 instances using AWS Session Manager.

## 📋 Prerequisites

- AWS CLI installed and configured
- AWS Session Manager plugin installed
- Appropriate AWS permissions for SSM and EC2

### Install Session Manager Plugin

```bash
# macOS
curl "https://s3.amazonaws.com/session-manager-downloads/plugin/latest/mac/sessionmanager-bundle.zip" -o "sessionmanager-bundle.zip"
unzip sessionmanager-bundle.zip
sudo ./sessionmanager-bundle/install -i /usr/local/sessionmanagerplugin -b /usr/local/bin/session-manager-plugin

# Verify installation
session-manager-plugin
```

## 🏗️ Infrastructure

### CloudFormation Template: `asg-alb-scaling.yaml`

Creates a complete 3-tier architecture with:

- **VPC** with public/private subnets across 2 AZs
- **Application Load Balancer** (ALB) with HTTPS
- **Auto Scaling Group** with EC2 instances in private subnets
- **RDS MySQL** database
- **Session Manager** enabled via IAM roles

**Key Features:**
- EC2 instances have `AmazonSSMManagedInstanceCore` policy
- Instances run Node.js application on port 5001
- Private subnets for security
- Target tracking scaling policies

### Deploy the Stack

```bash
aws cloudformation deploy \
  --template-file asg-alb-scaling.yaml \
  --stack-name my-app-stack \
  --parameter-overrides \
    KeyPairName=your-key-pair \
    DBSecretArn=your-db-secret-arn \
    SSLCertificateArns=your-cert-arn \
  --capabilities CAPABILITY_IAM \
  --profile your-profile
```

## 🔧 Connection Scripts

### 1. `ssm-connect.sh` - Full-Featured Script

Comprehensive script with multiple connection options.

#### Usage

```bash
# List all online instances
./ssm-connect.sh list

# Auto-connect to ASG web server
./ssm-connect.sh auto-app      # Port forward to app
./ssm-connect.sh auto-terminal # Terminal session

# Connect with specific instance ID
./ssm-connect.sh terminal i-1234567890abcdef0
./ssm-connect.sh app i-1234567890abcdef0
./ssm-connect.sh db i-1234567890abcdef0

# Custom port forwarding
./ssm-connect.sh port i-1234567890abcdef0 [remote-port] [local-port]

# Help
./ssm-connect.sh help
```

#### Commands

| Command | Description | Example |
|---------|-------------|---------|
| `list` | Show all online instances | `./ssm-connect.sh list` |
| `terminal` | Start terminal session | `./ssm-connect.sh terminal i-123...` |
| `app` | Forward app port (5001→8000) | `./ssm-connect.sh app i-123...` |
| `db` | Forward DB port (3306→3306) | `./ssm-connect.sh db i-123...` |
| `port` | Custom port forwarding | `./ssm-connect.sh port i-123... 22 2222` |
| `auto-app` | Auto-find and connect to app | `./ssm-connect.sh auto-app` |
| `auto-terminal` | Auto-find and connect to terminal | `./ssm-connect.sh auto-terminal` |

### 2. `quick-connect.sh` - Simple Interactive Menu

Easy-to-use script with interactive menu.

#### Usage

```bash
# Interactive menu
./quick-connect.sh

# Direct commands
./quick-connect.sh app      # Connect to app
./quick-connect.sh terminal # Connect to terminal
./quick-connect.sh db       # Connect to database
```

#### Menu Options

```
🔗 Quick Session Manager Connections

1) 📱 Connect to App (localhost:8000)
2) 💻 Connect to Terminal
3) 🗄️  Connect to Database (localhost:3306)
4) ❌ Exit
```

## 🚀 Common Use Cases

### Access Your Application

```bash
# Start port forwarding to your Node.js app
./quick-connect.sh app

# App will be available at: http://localhost:8000
```

### Debug Application Issues

```bash
# Connect to terminal
./quick-connect.sh terminal

# Once connected, check application status
sudo systemctl status course-site.service
sudo journalctl -u course-site.service -f
```

### Access Database

```bash
# Forward database port
./quick-connect.sh db

# Connect with MySQL client
mysql -h localhost -P 3306 -u username -p
```

### Custom Port Forwarding

```bash
# Forward SSH port for file transfers
./ssm-connect.sh port i-1234567890abcdef0 22 2222

# Then use SCP
scp -P 2222 file.txt ec2-user@localhost:/home/ec2-user/
```

## 🔍 Troubleshooting

### Instance Not Found

```bash
# Check if instances are running
./ssm-connect.sh list

# Verify instance has SSM agent
aws ssm describe-instance-information --profile your-profile
```

### Connection Issues

1. **Check IAM permissions** - Instance needs `AmazonSSMManagedInstanceCore`
2. **Verify instance is online** - Use `./ssm-connect.sh list`
3. **Check security groups** - No inbound rules needed for Session Manager
4. **Verify region** - Make sure AWS CLI is using correct region

### Port Already in Use

```bash
# Kill process using port 8000
lsof -ti:8000 | xargs kill -9

# Or use different local port
./ssm-connect.sh port i-123... 5001 8001
```

## 📁 File Structure

```
cloudformation/
├── README.md                    # This file
├── asg-alb-scaling.yaml        # CloudFormation template
├── ssm-connect.sh              # Full-featured connection script
└── quick-connect.sh            # Simple interactive script
```

## ⚙️ Configuration

### Update AWS Profile

Edit the scripts to change the AWS profile:

```bash
# In ssm-connect.sh and quick-connect.sh
AWS_PROFILE="your-profile-name"
```

### Update Stack Name

```bash
# In ssm-connect.sh
STACK_NAME="your-stack-name"
```

## 🔐 Security Benefits

- **No SSH keys required** - Session Manager handles authentication
- **No open SSH ports** - No inbound security group rules needed
- **Audit trail** - All sessions logged in CloudTrail
- **IAM-based access** - Fine-grained permissions
- **Encrypted connections** - TLS encryption by default

## 📊 Monitoring

### Check Session History

```bash
# List recent sessions
aws ssm describe-sessions --state-filter "Active,History" --profile your-profile

# Get session details
aws ssm get-connection-status --target i-1234567890abcdef0 --profile your-profile
```

### Application Logs

```bash
# Connect to terminal first
./quick-connect.sh terminal

# Check application logs
sudo journalctl -u course-site.service -f --lines 100
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test the scripts
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License.

## 🆘 Support

For issues or questions:
1. Check the troubleshooting section
2. Verify AWS permissions and configuration
3. Check CloudFormation stack status
4. Review Session Manager plugin installation
