#!/bin/bash
set -e

echo "Preparing for installation..."

# Create deployment directory if it doesn't exist
mkdir -p /home/ec2-user/deployment

# Clean up old deployment files
rm -rf /home/ec2-user/deployment/*

echo "Ready for installation"
