#!/bin/bash

# OpenVPN Server Deployment Script
# Deploys OpenVPN Access Server on AWS EC2

set -e

# Configuration
AWS_PROFILE="iitc-profile"
STACK_NAME="openvpn-server"
TEMPLATE_FILE="openvpn-server.yaml"
REGION="eu-west-1"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN} $1${NC}"
    echo -e "${CYAN}========================================${NC}"
}

# Function to show help
show_help() {
    echo "OpenVPN Server Deployment Script"
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  deploy                       Deploy OpenVPN server"
    echo "  delete                       Delete OpenVPN server stack"
    echo "  status                       Show stack status"
    echo "  info                         Show server information"
    echo "  logs                         Show server logs"
    echo "  connect                      Connect to server via SSH"
    echo "  update-security             Update security group rules"
    echo ""
    echo "Options:"
    echo "  --stack-name NAME           Custom stack name (default: openvpn-server)"
    echo "  --key-pair NAME             EC2 Key Pair name (default: course-site)"
    echo "  --instance-type TYPE        Instance type (default: t3.micro)"
    echo "  --vpn-port PORT             VPN port (default: 1194)"
    echo "  --allowed-cidr CIDR         Allowed CIDR for connections (default: 0.0.0.0/0)"
    echo "  --client-subnet CIDR        VPN client subnet (default: 10.8.0.0/24)"
    echo "  --profile PROFILE           AWS profile (default: iitc-profile)"
    echo "  -h, --help                  Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 deploy"
    echo "  $0 deploy --key-pair my-key --instance-type t3.small"
    echo "  $0 status"
    echo "  $0 info"
    echo "  $0 delete"
    echo ""
}

# Function to check prerequisites
check_prerequisites() {
    print_info "Checking prerequisites..."
    
    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI is not installed"
        exit 1
    fi
    
    # Check if template file exists
    if [[ ! -f "$TEMPLATE_FILE" ]]; then
        print_error "CloudFormation template not found: $TEMPLATE_FILE"
        exit 1
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity --profile "$AWS_PROFILE" &> /dev/null; then
        print_error "AWS credentials not configured for profile: $AWS_PROFILE"
        exit 1
    fi
    
    print_success "Prerequisites check passed"
}

# Function to deploy OpenVPN server
deploy_server() {
    local key_pair="${KEY_PAIR:-course-site}"
    local instance_type="${INSTANCE_TYPE:-t3.micro}"
    local vpn_port="${VPN_PORT:-1194}"
    local allowed_cidr="${ALLOWED_CIDR:-0.0.0.0/0}"
    local client_subnet="${CLIENT_SUBNET:-10.8.0.0/24}"
    
    print_header "Deploying OpenVPN Server"
    
    check_prerequisites
    
    print_info "Stack Name: $STACK_NAME"
    print_info "Key Pair: $key_pair"
    print_info "Instance Type: $instance_type"
    print_info "VPN Port: $vpn_port"
    print_info "Allowed CIDR: $allowed_cidr"
    print_info "Client Subnet: $client_subnet"
    
    print_warning "This will create AWS resources that may incur charges!"
    read -p "Continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Deployment cancelled"
        exit 0
    fi
    
    print_info "Deploying CloudFormation stack..."
    
    aws cloudformation deploy \
        --template-file "$TEMPLATE_FILE" \
        --stack-name "$STACK_NAME" \
        --parameter-overrides \
            KeyPairName="$key_pair" \
            InstanceType="$instance_type" \
            VPNPort="$vpn_port" \
            AllowedCIDR="$allowed_cidr" \
            ClientSubnet="$client_subnet" \
            ServerName="$STACK_NAME" \
        --capabilities CAPABILITY_IAM \
        --profile "$AWS_PROFILE" \
        --region "$REGION"
    
    if [[ $? -eq 0 ]]; then
        print_success "OpenVPN server deployed successfully!"
        echo ""
        show_server_info
        echo ""
        print_warning "IMPORTANT: Change the default admin password immediately!"
        print_info "Connect to admin panel and change password from 'OpenVPN123!'"
    else
        print_error "Deployment failed!"
        exit 1
    fi
}

# Function to delete server
delete_server() {
    print_header "Deleting OpenVPN Server"
    
    print_warning "This will permanently delete the OpenVPN server and all data!"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Deletion cancelled"
        exit 0
    fi
    
    print_info "Deleting CloudFormation stack..."
    
    aws cloudformation delete-stack \
        --stack-name "$STACK_NAME" \
        --profile "$AWS_PROFILE" \
        --region "$REGION"
    
    print_info "Stack deletion initiated. Use 'status' command to monitor progress."
}

# Function to show stack status
show_status() {
    print_header "Stack Status"
    
    aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --profile "$AWS_PROFILE" \
        --region "$REGION" \
        --query "Stacks[0].[StackName,StackStatus,CreationTime]" \
        --output table 2>/dev/null || {
        print_error "Stack not found: $STACK_NAME"
        exit 1
    }
}

# Function to show server information
show_server_info() {
    print_header "OpenVPN Server Information"
    
    local outputs=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --profile "$AWS_PROFILE" \
        --region "$REGION" \
        --query "Stacks[0].Outputs" \
        --output json 2>/dev/null)
    
    if [[ $? -ne 0 ]]; then
        print_error "Stack not found or not deployed: $STACK_NAME"
        exit 1
    fi
    
    local server_ip=$(echo "$outputs" | jq -r '.[] | select(.OutputKey=="ServerPublicIP") | .OutputValue')
    local admin_url=$(echo "$outputs" | jq -r '.[] | select(.OutputKey=="AdminWebUI") | .OutputValue')
    local client_url=$(echo "$outputs" | jq -r '.[] | select(.OutputKey=="ClientWebUI") | .OutputValue')
    local ssh_command=$(echo "$outputs" | jq -r '.[] | select(.OutputKey=="SSHCommand") | .OutputValue')
    local instance_id=$(echo "$outputs" | jq -r '.[] | select(.OutputKey=="InstanceId") | .OutputValue')
    
    echo -e "${GREEN}Server IP:${NC} $server_ip"
    echo -e "${GREEN}Instance ID:${NC} $instance_id"
    echo -e "${GREEN}Admin Web UI:${NC} $admin_url"
    echo -e "${GREEN}Client Web UI:${NC} $client_url"
    echo -e "${GREEN}SSH Command:${NC} $ssh_command"
    echo ""
    echo -e "${YELLOW}Default Credentials:${NC}"
    echo -e "  Username: ${GREEN}openvpn${NC}"
    echo -e "  Password: ${RED}OpenVPN123!${NC} ${YELLOW}(CHANGE THIS!)${NC}"
}

# Function to show server logs
show_logs() {
    print_header "OpenVPN Server Logs"
    
    local instance_id=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --profile "$AWS_PROFILE" \
        --region "$REGION" \
        --query "Stacks[0].Outputs[?OutputKey=='InstanceId'].OutputValue" \
        --output text 2>/dev/null)
    
    if [[ -z "$instance_id" || "$instance_id" == "None" ]]; then
        print_error "Could not find instance ID"
        exit 1
    fi
    
    print_info "Fetching logs from instance: $instance_id"
    
    aws ssm send-command \
        --instance-ids "$instance_id" \
        --document-name "AWS-RunShellScript" \
        --parameters 'commands=["tail -50 /var/log/openvpn-setup.log", "echo \"--- OpenVPN Service Status ---\"", "systemctl status openvpnas"]' \
        --profile "$AWS_PROFILE" \
        --region "$REGION" \
        --query "Command.CommandId" \
        --output text
}

# Function to connect via SSH
connect_ssh() {
    print_header "Connecting to OpenVPN Server"
    
    local server_ip=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --profile "$AWS_PROFILE" \
        --region "$REGION" \
        --query "Stacks[0].Outputs[?OutputKey=='ServerPublicIP'].OutputValue" \
        --output text 2>/dev/null)
    
    if [[ -z "$server_ip" || "$server_ip" == "None" ]]; then
        print_error "Could not find server IP"
        exit 1
    fi
    
    local key_pair="${KEY_PAIR:-course-site}"
    
    print_info "Connecting to: $server_ip"
    print_info "Using key: ~/.ssh/${key_pair}.pem"
    
    ssh -i ~/.ssh/${key_pair}.pem ec2-user@${server_ip}
}

# Function to update security group
update_security() {
    print_header "Update Security Group"
    
    local sg_id=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --profile "$AWS_PROFILE" \
        --region "$REGION" \
        --query "Stacks[0].Outputs[?OutputKey=='SecurityGroupId'].OutputValue" \
        --output text 2>/dev/null)
    
    if [[ -z "$sg_id" || "$sg_id" == "None" ]]; then
        print_error "Could not find security group ID"
        exit 1
    fi
    
    print_info "Security Group ID: $sg_id"
    print_info "Current rules:"
    
    aws ec2 describe-security-groups \
        --group-ids "$sg_id" \
        --profile "$AWS_PROFILE" \
        --region "$REGION" \
        --query "SecurityGroups[0].IpPermissions" \
        --output table
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --stack-name)
            STACK_NAME="$2"
            shift 2
            ;;
        --key-pair)
            KEY_PAIR="$2"
            shift 2
            ;;
        --instance-type)
            INSTANCE_TYPE="$2"
            shift 2
            ;;
        --vpn-port)
            VPN_PORT="$2"
            shift 2
            ;;
        --allowed-cidr)
            ALLOWED_CIDR="$2"
            shift 2
            ;;
        --client-subnet)
            CLIENT_SUBNET="$2"
            shift 2
            ;;
        --profile)
            AWS_PROFILE="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            COMMAND="$1"
            shift
            ;;
    esac
done

# Main script logic
case "${COMMAND:-help}" in
    "deploy")
        deploy_server
        ;;
    "delete")
        delete_server
        ;;
    "status")
        show_status
        ;;
    "info")
        show_server_info
        ;;
    "logs")
        show_logs
        ;;
    "connect")
        connect_ssh
        ;;
    "update-security")
        update_security
        ;;
    "help"|*)
        show_help
        ;;
esac
