#!/bin/bash

# AWS Session Manager Connection Script
# Usage: ./ssm-connect.sh [command] [options]

set -e

# Configuration
AWS_PROFILE="iitc-profile"
STACK_NAME="your-stack-name"  # Update this with your actual stack name

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

# Function to get running instances
get_instances() {
    print_info "Fetching running EC2 instances..."
    aws ssm describe-instance-information \
        --profile "$AWS_PROFILE" \
        --query "InstanceInformationList[?PingStatus=='Online'].[InstanceId,ComputerName,PlatformName]" \
        --output table
}

# Function to get instance by tag
get_instance_by_tag() {
    local tag_name="$1"
    local tag_value="$2"
    
    aws ec2 describe-instances \
        --profile "$AWS_PROFILE" \
        --filters "Name=tag:$tag_name,Values=$tag_value" "Name=instance-state-name,Values=running" \
        --query "Reservations[0].Instances[0].InstanceId" \
        --output text 2>/dev/null || echo "None"
}

# Function to start terminal session
start_terminal() {
    local instance_id="$1"
    
    if [[ "$instance_id" == "None" || -z "$instance_id" ]]; then
        print_error "No running instance found"
        exit 1
    fi
    
    print_info "Starting terminal session with instance: $instance_id"
    aws ssm start-session \
        --target "$instance_id" \
        --profile "$AWS_PROFILE"
}

# Function to start port forwarding
start_port_forward() {
    local instance_id="$1"
    local remote_port="$2"
    local local_port="$3"
    
    if [[ "$instance_id" == "None" || -z "$instance_id" ]]; then
        print_error "No running instance found"
        exit 1
    fi
    
    print_info "Starting port forwarding: localhost:$local_port -> $instance_id:$remote_port"
    print_warning "Press Ctrl+C to stop the session"
    
    aws ssm start-session \
        --target "$instance_id" \
        --document-name AWS-StartPortForwardingSession \
        --parameters "{\"portNumber\":[\"$remote_port\"],\"localPortNumber\":[\"$local_port\"]}" \
        --profile "$AWS_PROFILE"
}

# Function to show help
show_help() {
    echo "AWS Session Manager Connection Script"
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  list                          List all online instances"
    echo "  terminal [INSTANCE_ID]        Start terminal session"
    echo "  app [INSTANCE_ID]            Forward app port (5001 -> 8000)"
    echo "  db [INSTANCE_ID]             Forward database port (3306 -> 3306)"
    echo "  port [INSTANCE_ID] [REMOTE] [LOCAL]  Custom port forwarding"
    echo "  auto-app                     Auto-connect to app server"
    echo "  auto-terminal               Auto-connect to terminal"
    echo ""
    echo "Options:"
    echo "  -h, --help                   Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 list"
    echo "  $0 terminal i-1234567890abcdef0"
    echo "  $0 app i-1234567890abcdef0"
    echo "  $0 port i-1234567890abcdef0 22 2222"
    echo "  $0 auto-app"
    echo ""
}

# Main script logic
case "${1:-help}" in
    "list")
        get_instances
        ;;
    
    "terminal")
        if [[ -n "$2" ]]; then
            start_terminal "$2"
        else
            print_error "Please provide instance ID"
            echo "Usage: $0 terminal INSTANCE_ID"
            exit 1
        fi
        ;;
    
    "app")
        if [[ -n "$2" ]]; then
            print_success "App will be available at: http://localhost:8000"
            start_port_forward "$2" "5001" "8000"
        else
            print_error "Please provide instance ID"
            echo "Usage: $0 app INSTANCE_ID"
            exit 1
        fi
        ;;
    
    "db")
        if [[ -n "$2" ]]; then
            print_success "Database will be available at: localhost:3306"
            start_port_forward "$2" "3306" "3306"
        else
            print_error "Please provide instance ID"
            echo "Usage: $0 db INSTANCE_ID"
            exit 1
        fi
        ;;
    
    "port")
        if [[ -n "$2" && -n "$3" && -n "$4" ]]; then
            start_port_forward "$2" "$3" "$4"
        else
            print_error "Please provide instance ID, remote port, and local port"
            echo "Usage: $0 port INSTANCE_ID REMOTE_PORT LOCAL_PORT"
            exit 1
        fi
        ;;
    
    "auto-app")
        print_info "Looking for ASG web server instance..."
        instance_id=$(get_instance_by_tag "Name" "ASG-WebServer")
        if [[ "$instance_id" != "None" ]]; then
            print_success "Found instance: $instance_id"
            print_success "App will be available at: http://localhost:8000"
            start_port_forward "$instance_id" "5001" "8000"
        else
            print_error "No ASG-WebServer instance found"
            exit 1
        fi
        ;;
    
    "auto-terminal")
        print_info "Looking for ASG web server instance..."
        instance_id=$(get_instance_by_tag "Name" "ASG-WebServer")
        if [[ "$instance_id" != "None" ]]; then
            print_success "Found instance: $instance_id"
            start_terminal "$instance_id"
        else
            print_error "No ASG-WebServer instance found"
            exit 1
        fi
        ;;
    
    "help"|"-h"|"--help")
        show_help
        ;;
    
    *)
        print_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac
