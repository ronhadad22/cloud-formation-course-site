#!/bin/bash
set -e

# ============================================================
# Keycloak + Terraform Lab — Full Deployment Script
# Phase 1: CloudFormation (infra)
# Phase 2: Wait for Keycloak
# Phase 3: Terraform (Keycloak config)
# Phase 4: Configure & start the HR Portal app
# ============================================================

STACK_NAME="keycloak-tf-lab"
REGION="${AWS_DEFAULT_REGION:-us-east-1}"
TEMPLATE_FILE="$(dirname "$0")/../cloudformation/01-infrastructure.yaml"
TF_DIR="$(dirname "$0")/../terraform"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${BLUE}[INFO]${NC} $1"; }
ok()   { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()  { echo -e "${RED}[ERROR]${NC} $1"; }

# ============================================================
# Pre-flight checks
# ============================================================
log "Running pre-flight checks..."

if ! command -v aws &>/dev/null; then err "AWS CLI not found"; exit 1; fi
if ! command -v terraform &>/dev/null; then err "Terraform not found"; exit 1; fi
if ! command -v jq &>/dev/null; then err "jq not found"; exit 1; fi

aws sts get-caller-identity &>/dev/null || { err "AWS credentials not configured"; exit 1; }
ok "Pre-flight checks passed"

# ============================================================
# Phase 1: Deploy CloudFormation Stack
# ============================================================
echo ""
log "=========================================="
log "Phase 1: Deploying CloudFormation stack..."
log "=========================================="

# Check if key pair parameter is needed
if [ -z "$KEY_PAIR_NAME" ]; then
  echo ""
  echo "Available EC2 Key Pairs:"
  aws ec2 describe-key-pairs --query 'KeyPairs[].KeyName' --output table --region "$REGION"
  echo ""
  read -p "Enter your EC2 Key Pair name: " KEY_PAIR_NAME
fi

if [ -z "$KEY_PAIR_NAME" ]; then
  err "KEY_PAIR_NAME is required"
  exit 1
fi

log "Deploying stack '$STACK_NAME' with key pair '$KEY_PAIR_NAME'..."

aws cloudformation deploy \
  --stack-name "$STACK_NAME" \
  --template-file "$TEMPLATE_FILE" \
  --parameter-overrides \
    KeyPairName="$KEY_PAIR_NAME" \
  --capabilities CAPABILITY_NAMED_IAM \
  --region "$REGION" \
  --no-fail-on-empty-changeset

ok "CloudFormation stack deployed"

# Get stack outputs
log "Retrieving stack outputs..."
OUTPUTS=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" --query 'Stacks[0].Outputs' --output json)

KEYCLOAK_URL=$(echo "$OUTPUTS" | jq -r '.[] | select(.OutputKey=="KeycloakInternalURL") | .OutputValue')
APP_URL=$(echo "$OUTPUTS" | jq -r '.[] | select(.OutputKey=="AppURL") | .OutputValue')
KC_PASSWORD=$(echo "$OUTPUTS" | jq -r '.[] | select(.OutputKey=="KeycloakAdminPassword") | .OutputValue')
APP_SERVER_IP=$(echo "$OUTPUTS" | jq -r '.[] | select(.OutputKey=="AppServerIP") | .OutputValue')

echo ""
ok "Keycloak URL:  $KEYCLOAK_URL"
ok "App URL:       $APP_URL"
ok "App Server IP: $APP_SERVER_IP"

# ============================================================
# Phase 2: Wait for Keycloak to be ready
# ============================================================
echo ""
log "=========================================="
log "Phase 2: Waiting for Keycloak to be ready..."
log "=========================================="

MAX_WAIT=300
ELAPSED=0
INTERVAL=10

while [ $ELAPSED -lt $MAX_WAIT ]; do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "$KEYCLOAK_URL/realms/master" 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" = "200" ]; then
    ok "Keycloak is ready! (HTTP $HTTP_CODE)"
    break
  fi
  warn "Keycloak not ready yet (HTTP $HTTP_CODE). Waiting ${INTERVAL}s... ($ELAPSED/${MAX_WAIT}s)"
  sleep $INTERVAL
  ELAPSED=$((ELAPSED + INTERVAL))
done

if [ $ELAPSED -ge $MAX_WAIT ]; then
  err "Keycloak did not become ready within ${MAX_WAIT}s"
  err "Check: ssh -i <key>.pem ec2-user@<keycloak-ip> 'cat /var/log/keycloak-setup.log'"
  exit 1
fi

# ============================================================
# Phase 3: Terraform — Configure Keycloak
# ============================================================
echo ""
log "=========================================="
log "Phase 3: Configuring Keycloak with Terraform..."
log "=========================================="

cd "$TF_DIR"

# Create terraform.tfvars
cat > terraform.tfvars <<EOF
keycloak_url            = "$KEYCLOAK_URL"
keycloak_admin_user     = "admin"
keycloak_admin_password = "$KC_PASSWORD"
app_url                 = "$APP_URL"
EOF

log "Running terraform init..."
terraform init -input=false

log "Running terraform apply..."
terraform apply -auto-approve -input=false

# Get the client secret
CLIENT_SECRET=$(terraform output -raw client_secret)
ok "Keycloak configured successfully"
ok "Client secret: $CLIENT_SECRET"

# ============================================================
# Phase 4: Deploy .env to App Server & start the app
# ============================================================
echo ""
log "=========================================="
log "Phase 4: Configuring and starting HR Portal..."
log "=========================================="

# Find the SSH key
if [ -z "$SSH_KEY_PATH" ]; then
  SSH_KEY_PATH="$HOME/.ssh/${KEY_PAIR_NAME}.pem"
  if [ ! -f "$SSH_KEY_PATH" ]; then
    SSH_KEY_PATH="$HOME/${KEY_PAIR_NAME}.pem"
  fi
  if [ ! -f "$SSH_KEY_PATH" ]; then
    warn "SSH key not found at default locations."
    read -p "Enter path to SSH private key for '$KEY_PAIR_NAME': " SSH_KEY_PATH
  fi
fi

if [ ! -f "$SSH_KEY_PATH" ]; then
  err "SSH key not found: $SSH_KEY_PATH"
  err "You can manually configure the app server:"
  echo ""
  echo "  ssh -i <key>.pem ec2-user@$APP_SERVER_IP"
  echo "  cat > /home/ec2-user/app/.env <<'EOF'"
  terraform output -raw app_env_config
  echo "EOF"
  echo "  cd /home/ec2-user/app && node server.js &"
  exit 1
fi

log "Deploying .env to app server ($APP_SERVER_IP)..."

# Wait for app server SSH to be ready
for i in $(seq 1 30); do
  if ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 -i "$SSH_KEY_PATH" ec2-user@"$APP_SERVER_IP" "echo ready" &>/dev/null; then
    break
  fi
  warn "SSH not ready yet, retrying... ($i/30)"
  sleep 10
done

# Wait for npm install to finish on the app server
log "Waiting for app server setup to complete..."
for i in $(seq 1 30); do
  if ssh -o StrictHostKeyChecking=no -i "$SSH_KEY_PATH" ec2-user@"$APP_SERVER_IP" "test -f /home/ec2-user/setup-complete.txt" &>/dev/null; then
    ok "App server setup complete"
    break
  fi
  warn "App server still setting up... ($i/30)"
  sleep 10
done

# Create .env file on app server
ENV_CONTENT=$(terraform output -raw app_env_config)
ssh -o StrictHostKeyChecking=no -i "$SSH_KEY_PATH" ec2-user@"$APP_SERVER_IP" "cat > /home/ec2-user/app/.env <<'ENVEOF'
${ENV_CONTENT}
ENVEOF"

ok ".env deployed to app server"

# Start the app
ssh -o StrictHostKeyChecking=no -i "$SSH_KEY_PATH" ec2-user@"$APP_SERVER_IP" "cd /home/ec2-user/app && nohup node server.js > /home/ec2-user/app/app.log 2>&1 &"
ok "HR Portal app started"

# ============================================================
# Summary
# ============================================================
echo ""
echo "=============================================="
echo -e "${GREEN}  DEPLOYMENT COMPLETE${NC}"
echo "=============================================="
echo ""
echo -e "  Keycloak Admin:  ${BLUE}${KEYCLOAK_URL}/admin${NC}"
echo -e "  HR Portal:       ${BLUE}${APP_URL}${NC}"
echo ""
echo "  Test Users:"
echo "    alice / alice123  — employee"
echo "    bob   / bob123    — employee, manager"
echo "    carol / carol123  — employee, manager, admin"
echo ""
echo "  Realm: demo-realm"
echo ""
echo "=============================================="
