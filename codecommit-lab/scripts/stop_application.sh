#!/bin/bash
set -e

echo "Stopping application..."
cd /home/ec2-user/app

# Stop and remove existing containers
docker compose down || true

echo "Application stopped"
