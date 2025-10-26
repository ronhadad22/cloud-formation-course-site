# OpenVPN Server on AWS

Complete solution for deploying and managing an OpenVPN Access Server on AWS EC2 for secure client VPN connections.

## 🏗️ Architecture

- **EC2 Instance** running OpenVPN Access Server
- **Elastic IP** for consistent server address
- **Security Groups** with proper VPN and management ports
- **IAM Roles** for Systems Manager access
- **VPC** with public subnet for server placement

## 📋 Prerequisites

- AWS CLI installed and configured
- AWS Session Manager plugin (optional, for SSH-less access)
- EC2 Key Pair for SSH access
- Appropriate AWS permissions

### Required AWS Permissions

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "cloudformation:*",
                "ec2:*",
                "iam:*",
                "ssm:*"
            ],
            "Resource": "*"
        }
    ]
}
```

## 🚀 Quick Start

### 1. Deploy OpenVPN Server

```bash
# Basic deployment
./deploy-openvpn.sh deploy

# Custom deployment
./deploy-openvpn.sh deploy \
  --key-pair my-keypair \
  --instance-type t3.small \
  --allowed-cidr 203.0.113.0/24
```

### 2. Get Server Information

```bash
./deploy-openvpn.sh info
```

### 3. Add VPN Users

```bash
# Add user with auto-generated password
./manage-clients.sh add-user john

# Add user with custom password
./manage-clients.sh add-user jane mypassword123
```

### 4. Download Client Configuration

```bash
./manage-clients.sh download-config john
```

## 📁 File Structure

```
openvpn/
├── README.md                    # This documentation
├── openvpn-server.yaml         # CloudFormation template
├── deploy-openvpn.sh           # Deployment and management script
└── manage-clients.sh           # User management script
```

## 🔧 Scripts Overview

### `deploy-openvpn.sh` - Server Management

Main script for deploying and managing the OpenVPN server infrastructure.

#### Commands

| Command | Description | Example |
|---------|-------------|---------|
| `deploy` | Deploy OpenVPN server | `./deploy-openvpn.sh deploy` |
| `delete` | Delete server stack | `./deploy-openvpn.sh delete` |
| `status` | Show stack status | `./deploy-openvpn.sh status` |
| `info` | Show server information | `./deploy-openvpn.sh info` |
| `connect` | SSH to server | `./deploy-openvpn.sh connect` |
| `logs` | Show server logs | `./deploy-openvpn.sh logs` |

#### Options

| Option | Description | Default |
|--------|-------------|---------|
| `--stack-name` | CloudFormation stack name | `openvpn-server` |
| `--key-pair` | EC2 Key Pair name | `course-site` |
| `--instance-type` | EC2 instance type | `t3.micro` |
| `--vpn-port` | OpenVPN UDP port | `1194` |
| `--allowed-cidr` | Allowed connection CIDR | `0.0.0.0/0` |
| `--client-subnet` | VPN client subnet | `10.8.0.0/24` |
| `--profile` | AWS profile | `iitc-profile` |

### `manage-clients.sh` - User Management

Script for managing OpenVPN users and client configurations.

#### Commands

| Command | Description | Example |
|---------|-------------|---------|
| `add-user` | Add new VPN user | `./manage-clients.sh add-user john` |
| `delete-user` | Delete VPN user | `./manage-clients.sh delete-user john` |
| `list-users` | List all users | `./manage-clients.sh list-users` |
| `reset-password` | Reset user password | `./manage-clients.sh reset-password john` |
| `download-config` | Get config download info | `./manage-clients.sh download-config john` |
| `status` | Show server status | `./manage-clients.sh status` |
| `connections` | Show connected clients | `./manage-clients.sh connections` |

## 🔐 Security Configuration

### Default Settings

- **Admin Username**: `openvpn`
- **Admin Password**: `OpenVPN123!` ⚠️ **CHANGE IMMEDIATELY!**
- **VPN Port**: `1194/UDP`
- **Admin Web UI**: `943/TCP`
- **Client Subnet**: `10.8.0.0/24`

### Security Best Practices

1. **Change Default Password**
   ```bash
   # Access admin panel and change password
   https://YOUR_SERVER_IP:943/admin
   ```

2. **Restrict Access CIDR**
   ```bash
   # Deploy with restricted access
   ./deploy-openvpn.sh deploy --allowed-cidr 203.0.113.0/24
   ```

3. **Use Strong Passwords**
   ```bash
   # Generate secure password
   openssl rand -base64 16
   ```

4. **Regular User Audits**
   ```bash
   # List and review users regularly
   ./manage-clients.sh list-users
   ```

## 🌐 Client Setup

### Web-based Configuration Download

1. **Access Client Portal**
   ```
   https://YOUR_SERVER_IP:943/
   ```

2. **Login with User Credentials**
   - Username: (created via manage-clients.sh)
   - Password: (provided during user creation)

3. **Download Configuration**
   - Click "Yourself (user-locked profile)"
   - Download the `.ovpn` file

### Client Applications

- **Windows**: OpenVPN GUI
- **macOS**: Tunnelblick or OpenVPN Connect
- **Linux**: OpenVPN client
- **iOS**: OpenVPN Connect
- **Android**: OpenVPN Connect

### Example Client Connection (Linux)

```bash
# Install OpenVPN client
sudo apt-get install openvpn

# Connect using downloaded config
sudo openvpn --config client.ovpn
```

## 📊 Monitoring and Maintenance

### Check Server Status

```bash
# Server health
./deploy-openvpn.sh info

# Service status
./manage-clients.sh status

# Connected clients
./manage-clients.sh connections
```

### View Logs

```bash
# Server deployment logs
./deploy-openvpn.sh logs

# SSH to server for detailed logs
./deploy-openvpn.sh connect
sudo tail -f /var/log/openvpnas.log
```

### User Management

```bash
# List all users
./manage-clients.sh list-users

# Add new user
./manage-clients.sh add-user newuser

# Reset password
./manage-clients.sh reset-password username

# Remove user
./manage-clients.sh delete-user username
```

## 💰 Cost Optimization

### Instance Types

| Type | vCPU | RAM | Network | Cost/Month* |
|------|------|-----|---------|-------------|
| t3.micro | 2 | 1 GB | Low-Moderate | ~$8.50 |
| t3.small | 2 | 2 GB | Low-Moderate | ~$17.00 |
| t3.medium | 2 | 4 GB | Low-Moderate | ~$34.00 |

*Approximate costs for eu-west-1 region

### Cost Reduction Tips

1. **Use t3.micro** for small teams (< 10 users)
2. **Schedule shutdown** during off-hours if applicable
3. **Monitor data transfer** costs
4. **Use Reserved Instances** for long-term deployments

## 🔧 Troubleshooting

### Common Issues

#### 1. Connection Timeout

```bash
# Check security group rules
./deploy-openvpn.sh info

# Verify server is running
./manage-clients.sh status
```

#### 2. Certificate Errors

```bash
# SSH to server and check certificates
./deploy-openvpn.sh connect
sudo /usr/local/openvpn_as/scripts/sacli ConfigQuery
```

#### 3. User Cannot Connect

```bash
# Verify user exists
./manage-clients.sh list-users

# Reset user password
./manage-clients.sh reset-password username

# Check server logs
./deploy-openvpn.sh logs
```

#### 4. Web UI Not Accessible

```bash
# Check if port 943 is open in security group
aws ec2 describe-security-groups --group-ids sg-xxxxxxxxx

# Verify service is running
./manage-clients.sh status
```

### Log Locations

- **Setup logs**: `/var/log/openvpn-setup.log`
- **OpenVPN logs**: `/var/log/openvpnas.log`
- **System logs**: `/var/log/messages`

## 🔄 Updates and Maintenance

### Update OpenVPN Access Server

```bash
# SSH to server
./deploy-openvpn.sh connect

# Check for updates
sudo /usr/local/openvpn_as/bin/ovpn-init --upgrade

# Restart service
sudo systemctl restart openvpnas
```

### Backup Configuration

```bash
# SSH to server
./deploy-openvpn.sh connect

# Backup configuration
sudo /usr/local/openvpn_as/scripts/sacli ConfigBackup > /tmp/openvpn-backup.txt

# Download backup (from local machine)
scp -i ~/.ssh/your-key.pem ec2-user@SERVER_IP:/tmp/openvpn-backup.txt ./
```

## 🚨 Emergency Procedures

### Reset Admin Password

```bash
# SSH to server
./deploy-openvpn.sh connect

# Reset admin password
sudo passwd openvpn

# Or via OpenVPN tools
echo "openvpn:NewPassword123!" | sudo chpasswd
```

### Restart Services

```bash
# SSH to server
./deploy-openvpn.sh connect

# Restart OpenVPN service
sudo systemctl restart openvpnas

# Check status
sudo systemctl status openvpnas
```

### Complete Server Reset

```bash
# Delete and redeploy
./deploy-openvpn.sh delete
./deploy-openvpn.sh deploy
```

## 📞 Support

### Getting Help

1. **Check logs** first using provided scripts
2. **Review troubleshooting** section above
3. **Check AWS CloudFormation** console for stack events
4. **Verify security groups** and network configuration

### Useful Commands

```bash
# Complete server info
./deploy-openvpn.sh info

# All users
./manage-clients.sh list-users

# Server health check
./manage-clients.sh status

# Current connections
./manage-clients.sh connections
```

## 📝 License

This project is licensed under the MIT License.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Test your changes thoroughly
4. Submit a pull request

---

**⚠️ Security Notice**: Always change default passwords and restrict access appropriately for production use.
