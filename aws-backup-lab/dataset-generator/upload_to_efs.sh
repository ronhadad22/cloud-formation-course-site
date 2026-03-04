#!/bin/bash
# Upload generated hospital data to EFS via EC2 instance
# Usage: ./upload_to_efs.sh <EC2_PUBLIC_IP> <KEY_PATH>

set -e

EC2_IP=${1:?"Usage: ./upload_to_efs.sh <EC2_PUBLIC_IP> <SSH_KEY_PATH>"}
KEY_PATH=${2:?"Usage: ./upload_to_efs.sh <EC2_PUBLIC_IP> <SSH_KEY_PATH>"}

if [ ! -d "hospital-data" ]; then
    echo "❌ hospital-data/ directory not found. Run generate_data.py first."
    exit 1
fi

echo "📤 Uploading hospital data to EFS via EC2 ($EC2_IP)..."

# Create target directory and upload data to EC2
ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no ec2-user@${EC2_IP} "mkdir -p /tmp/hospital-data"
scp -i "$KEY_PATH" -r hospital-data/* ec2-user@${EC2_IP}:/tmp/hospital-data/

# Move to EFS mount
ssh -i "$KEY_PATH" ec2-user@${EC2_IP} << 'EOF'
sudo mkdir -p /mnt/efs/hospital-data
sudo cp -r /tmp/hospital-data/* /mnt/efs/hospital-data/
sudo chown -R ec2-user:ec2-user /mnt/efs/hospital-data/
rm -rf /tmp/hospital-data

echo ""
echo "📁 EFS Contents:"
find /mnt/efs/hospital-data -type f | wc -l
echo "files uploaded"
echo ""
du -sh /mnt/efs/hospital-data/*
EOF

echo ""
echo "✅ Data uploaded to EFS successfully!"
