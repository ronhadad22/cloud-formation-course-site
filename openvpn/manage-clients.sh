#!/bin/bash

# OpenVPN Client Management Script
# Manages OpenVPN users and client configurations

set -e

# Configuration
AWS_PROFILE="iitc-profile"
STACK_NAME="openvpn-server"
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

# Function to get server instance ID
get_instance_id() {
    aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --profile "$AWS_PROFILE" \
        --region "$REGION" \
        --query "Stacks[0].Outputs[?OutputKey=='InstanceId'].OutputValue" \
        --output text 2>/dev/null
}

# Function to get server IP
get_server_ip() {
    aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --profile "$AWS_PROFILE" \
        --region "$REGION" \
        --query "Stacks[0].Outputs[?OutputKey=='ServerPublicIP'].OutputValue" \
        --output text 2>/dev/null
}

# Function to execute command on server
execute_remote_command() {
    local command="$1"
    local instance_id=$(get_instance_id)
    
    if [[ -z "$instance_id" || "$instance_id" == "None" ]]; then
        print_error "Could not find OpenVPN server instance"
        exit 1
    fi
    
    aws ssm send-command \
        --instance-ids "$instance_id" \
        --document-name "AWS-RunShellScript" \
        --parameters "commands=[\"$command\"]" \
        --profile "$AWS_PROFILE" \
        --region "$REGION" \
        --query "Command.CommandId" \
        --output text
}

# Function to get command result
get_command_result() {
    local command_id="$1"
    local instance_id=$(get_instance_id)
    
    # Wait a moment for command to execute
    sleep 3
    
    aws ssm get-command-invocation \
        --command-id "$command_id" \
        --instance-id "$instance_id" \
        --profile "$AWS_PROFILE" \
        --region "$REGION" \
        --query "StandardOutputContent" \
        --output text 2>/dev/null || echo "Command execution failed"
}

# Function to add a new user
add_user() {
    local username="$1"
    local password="$2"
    
    if [[ -z "$username" ]]; then
        print_error "Username is required"
        exit 1
    fi
    
    if [[ -z "$password" ]]; then
        # Generate random password if not provided
        password=$(openssl rand -base64 12)
        print_info "Generated password: $password"
    fi
    
    print_header "Adding OpenVPN User: $username"
    
    local command="sudo /usr/local/openvpn_as/scripts/sacli --user '$username' --new_pass '$password' SetLocalPassword"
    local command_id=$(execute_remote_command "$command")
    
    print_info "Command ID: $command_id"
    print_info "Waiting for user creation..."
    
    local result=$(get_command_result "$command_id")
    
    if [[ "$result" == *"error"* ]] || [[ "$result" == *"failed"* ]]; then
        print_error "Failed to create user: $result"
        exit 1
    fi
    
    print_success "User '$username' created successfully"
    print_info "Username: $username"
    print_info "Password: $password"
    print_warning "Save these credentials securely!"
}

# Function to delete a user
delete_user() {
    local username="$1"
    
    if [[ -z "$username" ]]; then
        print_error "Username is required"
        exit 1
    fi
    
    print_header "Deleting OpenVPN User: $username"
    
    print_warning "This will permanently delete user '$username'"
    read -p "Continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "User deletion cancelled"
        exit 0
    fi
    
    local command="sudo /usr/local/openvpn_as/scripts/sacli --user '$username' UserPropDelAll"
    local command_id=$(execute_remote_command "$command")
    
    print_info "Waiting for user deletion..."
    local result=$(get_command_result "$command_id")
    
    print_success "User '$username' deleted successfully"
}

# Function to list users
list_users() {
    print_header "OpenVPN Users"
    
    local command="sudo /usr/local/openvpn_as/scripts/sacli UserPropGet"
    local command_id=$(execute_remote_command "$command")
    
    print_info "Fetching user list..."
    local result=$(get_command_result "$command_id")
    
    echo "$result" | grep -E "^[a-zA-Z0-9_-]+\." | cut -d'.' -f1 | sort -u | while read user; do
        if [[ -n "$user" ]]; then
            echo -e "${GREEN}User:${NC} $user"
        fi
    done
}

# Function to reset user password
reset_password() {
    local username="$1"
    local password="$2"
    
    if [[ -z "$username" ]]; then
        print_error "Username is required"
        exit 1
    fi
    
    if [[ -z "$password" ]]; then
        # Generate random password if not provided
        password=$(openssl rand -base64 12)
        print_info "Generated new password: $password"
    fi
    
    print_header "Resetting Password for: $username"
    
    local command="sudo /usr/local/openvpn_as/scripts/sacli --user '$username' --new_pass '$password' SetLocalPassword"
    local command_id=$(execute_remote_command "$command")
    
    print_info "Waiting for password reset..."
    local result=$(get_command_result "$command_id")
    
    print_success "Password reset for user '$username'"
    print_info "New password: $password"
    print_warning "Save this password securely!"
}

# Function to download client config
download_config() {
    local username="$1"
    
    if [[ -z "$username" ]]; then
        print_error "Username is required"
        exit 1
    fi
    
    print_header "Downloading Client Configuration"
    
    local server_ip=$(get_server_ip)
    if [[ -z "$server_ip" || "$server_ip" == "None" ]]; then
        print_error "Could not find server IP"
        exit 1
    fi
    
    print_info "Server IP: $server_ip"
    print_info "Download URL: https://$server_ip:943/?src=connect"
    print_info "Login with username: $username"
    print_warning "Download the .ovpn file from the web interface"
    
    # Try to open the URL in browser (macOS)
    if command -v open &> /dev/null; then
        print_info "Opening client download page in browser..."
        open "https://$server_ip:943/?src=connect"
    fi
}

# Function to show server status
show_status() {
    print_header "OpenVPN Server Status"
    
    local command="sudo systemctl status openvpnas --no-pager"
    local command_id=$(execute_remote_command "$command")
    
    print_info "Fetching server status..."
    local result=$(get_command_result "$command_id")
    
    echo "$result"
}

# Function to show connected clients
show_connections() {
    print_header "Connected Clients"
    
    local command="sudo /usr/local/openvpn_as/scripts/sacli VPNStatus"
    local command_id=$(execute_remote_command "$command")
    
    print_info "Fetching connection status..."
    local result=$(get_command_result "$command_id")
    
    echo "$result"
}

# Function to show help
show_help() {
    echo "OpenVPN Client Management Script"
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  add-user USERNAME [PASSWORD]     Add new VPN user"
    echo "  delete-user USERNAME             Delete VPN user"
    echo "  list-users                       List all VPN users"
    echo "  reset-password USERNAME [PASS]   Reset user password"
    echo "  download-config USERNAME         Get client config download info"
    echo "  status                           Show server status"
    echo "  connections                      Show connected clients"
    echo ""
    echo "Options:"
    echo "  --stack-name NAME               Custom stack name (default: openvpn-server)"
    echo "  --profile PROFILE               AWS profile (default: iitc-profile)"
    echo "  -h, --help                      Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 add-user john"
    echo "  $0 add-user jane mypassword123"
    echo "  $0 list-users"
    echo "  $0 reset-password john"
    echo "  $0 download-config john"
    echo "  $0 delete-user jane"
    echo ""
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --stack-name)
            STACK_NAME="$2"
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
        add-user)
            COMMAND="add-user"
            USERNAME="$2"
            PASSWORD="$3"
            shift 3
            ;;
        delete-user)
            COMMAND="delete-user"
            USERNAME="$2"
            shift 2
            ;;
        reset-password)
            COMMAND="reset-password"
            USERNAME="$2"
            PASSWORD="$3"
            shift 3
            ;;
        download-config)
            COMMAND="download-config"
            USERNAME="$2"
            shift 2
            ;;
        list-users|status|connections)
            COMMAND="$1"
            shift
            ;;
        *)
            print_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Main script logic
case "${COMMAND:-help}" in
    "add-user")
        add_user "$USERNAME" "$PASSWORD"
        ;;
    "delete-user")
        delete_user "$USERNAME"
        ;;
    "list-users")
        list_users
        ;;
    "reset-password")
        reset_password "$USERNAME" "$PASSWORD"
        ;;
    "download-config")
        download_config "$USERNAME"
        ;;
    "status")
        show_status
        ;;
    "connections")
        show_connections
        ;;
    "help"|*)
        show_help
        ;;
esac
