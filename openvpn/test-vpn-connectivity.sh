#!/bin/bash

# VPN Connectivity Test Script
# Tests connectivity to private instances through OpenVPN

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

# Function to get stack outputs
get_stack_output() {
    local output_key="$1"
    aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --profile "$AWS_PROFILE" \
        --region "$REGION" \
        --query "Stacks[0].Outputs[?OutputKey=='$output_key'].OutputValue" \
        --output text 2>/dev/null
}

# Function to test ping connectivity
test_ping() {
    local ip="$1"
    local name="$2"
    
    print_info "Testing ping to $name ($ip)..."
    
    if ping -c 3 -W 3 "$ip" > /dev/null 2>&1; then
        print_success "Ping to $name successful"
        return 0
    else
        print_error "Ping to $name failed"
        return 1
    fi
}

# Function to test HTTP connectivity
test_http() {
    local ip="$1"
    local name="$2"
    
    print_info "Testing HTTP to $name ($ip)..."
    
    if curl -s --connect-timeout 5 "http://$ip" > /dev/null; then
        print_success "HTTP to $name successful"
        return 0
    else
        print_error "HTTP to $name failed"
        return 1
    fi
}

# Function to test SSH connectivity
test_ssh() {
    local ip="$1"
    local name="$2"
    local key_pair="$3"
    
    print_info "Testing SSH to $name ($ip)..."
    
    if ssh -i ~/.ssh/${key_pair}.pem -o ConnectTimeout=5 -o StrictHostKeyChecking=no ec2-user@"$ip" "echo 'SSH test successful'" > /dev/null 2>&1; then
        print_success "SSH to $name successful"
        return 0
    else
        print_error "SSH to $name failed (check key pair: $key_pair)"
        return 1
    fi
}

# Function to download test file
test_download() {
    local ip="$1"
    local name="$2"
    
    print_info "Testing file download from $name ($ip)..."
    
    local content=$(curl -s --connect-timeout 5 "http://$ip/test.txt" 2>/dev/null)
    if [[ -n "$content" ]]; then
        print_success "File download successful: $content"
        return 0
    else
        print_error "File download from $name failed"
        return 1
    fi
}

# Function to run comprehensive connectivity test
run_connectivity_test() {
    print_header "VPN Connectivity Test"
    
    # Get instance IPs from CloudFormation outputs
    local instance1_ip=$(get_stack_output "PrivateTestInstance1IP")
    local instance2_ip=$(get_stack_output "PrivateTestInstance2IP")
    local key_pair=$(get_stack_output "SSHCommand" | grep -o '\-i ~/.ssh/[^.]*' | cut -d'/' -f3)
    
    if [[ -z "$instance1_ip" || "$instance1_ip" == "None" ]]; then
        print_error "Could not get Private Test Instance 1 IP. Is the stack deployed?"
        exit 1
    fi
    
    if [[ -z "$instance2_ip" || "$instance2_ip" == "None" ]]; then
        print_error "Could not get Private Test Instance 2 IP. Is the stack deployed?"
        exit 1
    fi
    
    print_info "Private Test Instance 1 IP: $instance1_ip"
    print_info "Private Test Instance 2 IP: $instance2_ip"
    echo ""
    
    local total_tests=0
    local passed_tests=0
    
    # Test Instance 1
    print_header "Testing Private Instance 1 ($instance1_ip)"
    
    # Ping test
    total_tests=$((total_tests + 1))
    if test_ping "$instance1_ip" "Private Instance 1"; then
        passed_tests=$((passed_tests + 1))
    fi
    
    # HTTP test
    total_tests=$((total_tests + 1))
    if test_http "$instance1_ip" "Private Instance 1"; then
        passed_tests=$((passed_tests + 1))
    fi
    
    # File download test
    total_tests=$((total_tests + 1))
    if test_download "$instance1_ip" "Private Instance 1"; then
        passed_tests=$((passed_tests + 1))
    fi
    
    # SSH test (if key pair available)
    if [[ -n "$key_pair" && -f ~/.ssh/${key_pair}.pem ]]; then
        total_tests=$((total_tests + 1))
        if test_ssh "$instance1_ip" "Private Instance 1" "$key_pair"; then
            passed_tests=$((passed_tests + 1))
        fi
    else
        print_warning "SSH test skipped (key pair not found: $key_pair)"
    fi
    
    echo ""
    
    # Test Instance 2
    print_header "Testing Private Instance 2 ($instance2_ip)"
    
    # Ping test
    total_tests=$((total_tests + 1))
    if test_ping "$instance2_ip" "Private Instance 2"; then
        passed_tests=$((passed_tests + 1))
    fi
    
    # HTTP test
    total_tests=$((total_tests + 1))
    if test_http "$instance2_ip" "Private Instance 2"; then
        passed_tests=$((passed_tests + 1))
    fi
    
    # File download test
    total_tests=$((total_tests + 1))
    if test_download "$instance2_ip" "Private Instance 2"; then
        passed_tests=$((passed_tests + 1))
    fi
    
    # SSH test (if key pair available)
    if [[ -n "$key_pair" && -f ~/.ssh/${key_pair}.pem ]]; then
        total_tests=$((total_tests + 1))
        if test_ssh "$instance2_ip" "Private Instance 2" "$key_pair"; then
            passed_tests=$((passed_tests + 1))
        fi
    else
        print_warning "SSH test skipped (key pair not found: $key_pair)"
    fi
    
    echo ""
    
    # Summary
    print_header "Test Summary"
    echo -e "Total tests: ${BLUE}$total_tests${NC}"
    echo -e "Passed: ${GREEN}$passed_tests${NC}"
    echo -e "Failed: ${RED}$((total_tests - passed_tests))${NC}"
    
    if [[ $passed_tests -eq $total_tests ]]; then
        print_success "All tests passed! VPN connectivity is working perfectly."
    elif [[ $passed_tests -gt 0 ]]; then
        print_warning "Some tests passed. VPN connectivity is partially working."
    else
        print_error "All tests failed. VPN connectivity is not working."
        echo ""
        print_info "Troubleshooting tips:"
        echo "1. Make sure you're connected to the VPN"
        echo "2. Check if the OpenVPN client is routing traffic properly"
        echo "3. Verify the VPN client subnet (10.8.0.0/24) can reach private subnets"
        echo "4. Check security group rules allow traffic from VPN clients"
    fi
}

# Function to show instance information
show_instance_info() {
    print_header "Private Test Instances Information"
    
    local instance1_ip=$(get_stack_output "PrivateTestInstance1IP")
    local instance2_ip=$(get_stack_output "PrivateTestInstance2IP")
    local instance1_id=$(get_stack_output "PrivateTestInstance1Id")
    local instance2_id=$(get_stack_output "PrivateTestInstance2Id")
    
    echo -e "${GREEN}Private Test Instance 1:${NC}"
    echo -e "  IP Address: ${BLUE}$instance1_ip${NC}"
    echo -e "  Instance ID: ${BLUE}$instance1_id${NC}"
    echo -e "  Web URL: ${BLUE}http://$instance1_ip${NC}"
    echo -e "  Test File: ${BLUE}http://$instance1_ip/test.txt${NC}"
    echo ""
    
    echo -e "${GREEN}Private Test Instance 2:${NC}"
    echo -e "  IP Address: ${BLUE}$instance2_ip${NC}"
    echo -e "  Instance ID: ${BLUE}$instance2_id${NC}"
    echo -e "  Web URL: ${BLUE}http://$instance2_ip${NC}"
    echo -e "  Test File: ${BLUE}http://$instance2_ip/test.txt${NC}"
    echo ""
    
    echo -e "${YELLOW}Manual Test Commands:${NC}"
    echo -e "  Ping: ${BLUE}ping $instance1_ip${NC} or ${BLUE}ping $instance2_ip${NC}"
    echo -e "  HTTP: ${BLUE}curl http://$instance1_ip${NC} or ${BLUE}curl http://$instance2_ip${NC}"
    echo -e "  Browser: Open ${BLUE}http://$instance1_ip${NC} or ${BLUE}http://$instance2_ip${NC}"
}

# Function to show help
show_help() {
    echo "VPN Connectivity Test Script"
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  test                         Run comprehensive connectivity test"
    echo "  info                         Show private instance information"
    echo "  ping IP                      Test ping to specific IP"
    echo "  http IP                      Test HTTP to specific IP"
    echo ""
    echo "Options:"
    echo "  --stack-name NAME           Custom stack name (default: openvpn-server)"
    echo "  --profile PROFILE           AWS profile (default: iitc-profile)"
    echo "  -h, --help                  Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 test                     # Run all connectivity tests"
    echo "  $0 info                     # Show instance information"
    echo "  $0 ping 10.0.10.100         # Test ping to specific IP"
    echo "  $0 http 10.0.10.100         # Test HTTP to specific IP"
    echo ""
    echo "Prerequisites:"
    echo "  - OpenVPN client must be connected"
    echo "  - VPN should be routing traffic to 10.0.0.0/16"
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
        test)
            COMMAND="test"
            shift
            ;;
        info)
            COMMAND="info"
            shift
            ;;
        ping)
            COMMAND="ping"
            TARGET_IP="$2"
            shift 2
            ;;
        http)
            COMMAND="http"
            TARGET_IP="$2"
            shift 2
            ;;
        *)
            print_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Main script logic
case "${COMMAND:-test}" in
    "test")
        run_connectivity_test
        ;;
    "info")
        show_instance_info
        ;;
    "ping")
        if [[ -n "$TARGET_IP" ]]; then
            test_ping "$TARGET_IP" "Target"
        else
            print_error "IP address required for ping test"
            exit 1
        fi
        ;;
    "http")
        if [[ -n "$TARGET_IP" ]]; then
            test_http "$TARGET_IP" "Target"
        else
            print_error "IP address required for HTTP test"
            exit 1
        fi
        ;;
    *)
        show_help
        ;;
esac
