#!/bin/bash

# Manual OpenVPN Setup Script
# Run this on the EC2 instance if the automatic setup fails

set -x

echo "=== Manual OpenVPN Access Server Installation ==="

# Install minimal required packages without updating
sudo dnf install -y wget

# Download OpenVPN Access Server
cd /tmp
echo "Downloading OpenVPN Access Server..."
wget -O openvpn-as.rpm https://as-repository.openvpn.net/as/openvpn-as-2.12.1-Amazon_Linux.x86_64.rpm

# Install OpenVPN Access Server
echo "Installing OpenVPN Access Server..."
sudo rpm -i openvpn-as.rpm

# Set admin password
echo "Setting admin password..."
echo "openvpn:OpenVPN123!" | sudo chpasswd

# Get the server's public IP
PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)
echo "Server public IP: $PUBLIC_IP"

# Initialize OpenVPN with public IP
echo "Initializing OpenVPN Access Server..."
sudo /usr/local/openvpn_as/bin/ovpn-init --batch \
  --host=$PUBLIC_IP \
  --local_auth \
  --force

# Enable IP forwarding
echo "Enabling IP forwarding..."
echo 'net.ipv4.ip_forward = 1' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# Configure basic routing
echo "Configuring routing..."
sudo /usr/local/openvpn_as/scripts/sacli --key "vpn.client.routing.reroute_gw" --value "true" ConfigPut
sudo /usr/local/openvpn_as/scripts/sacli --key "vpn.server.routing.private_network.0" --value "10.0.0.0/16" ConfigPut
sudo /usr/local/openvpn_as/scripts/sacli --key "vpn.server.routing.private_access" --value "nat" ConfigPut

# Start services
echo "Starting OpenVPN Access Server..."
sudo systemctl enable openvpnas
sudo systemctl start openvpnas

# Wait and check status
sleep 10
sudo systemctl status openvpnas

echo "=== Setup Complete ==="
echo "Admin Web UI: https://$PUBLIC_IP:943/admin"
echo "Client Web UI: https://$PUBLIC_IP:943/"
echo "Username: openvpn"
echo "Password: OpenVPN123!"

# Check if ports are listening
echo "=== Port Status ==="
sudo netstat -tlnp | grep 943
sudo netstat -ulnp | grep 1194
