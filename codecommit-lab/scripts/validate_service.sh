#!/bin/bash
set -e

echo "Validating service..."

# Wait for container to be healthy
sleep 10

# Check if container is running
if ! docker ps | grep -q cicd-app; then
  echo "ERROR: Container is not running"
  exit 1
fi

# Check health endpoint
RESPONSE=$(curl -sf http://localhost/api/health || echo "FAILED")

if [ "$RESPONSE" = "FAILED" ]; then
  echo "ERROR: Health check failed"
  exit 1
fi

echo "Service validation successful"
echo "Response: $RESPONSE"
