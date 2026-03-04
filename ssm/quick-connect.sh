#!/bin/bash

# Quick Session Manager Connections
# Simple script for common connection patterns

AWS_PROFILE="iitc-profile"

# Get the first running ASG instance
get_asg_instance() {
    aws ec2 describe-instances \
        --profile "$AWS_PROFILE" \
        --filters "Name=tag:Name,Values=ASG-WebServer" "Name=instance-state-name,Values=running" \
        --query "Reservations[0].Instances[0].InstanceId" \
        --output text 2>/dev/null
}

# Connect to app (port forwarding)
connect_app() {
    local instance_id=$(get_asg_instance)
    if [[ "$instance_id" == "None" || -z "$instance_id" ]]; then
        echo "❌ No running ASG instance found"
        exit 1
    fi
    
    echo "🚀 Connecting to app on instance: $instance_id"
    echo "📱 App will be available at: http://localhost:8000"
    echo "⏹️  Press Ctrl+C to stop"
    
    aws ssm start-session \
        --target "$instance_id" \
        --document-name AWS-StartPortForwardingSession \
        --parameters '{"portNumber":["5001"],"localPortNumber":["8000"]}' \
        --profile "$AWS_PROFILE"
}

# Connect to terminal
connect_terminal() {
    local instance_id=$(get_asg_instance)
    if [[ "$instance_id" == "None" || -z "$instance_id" ]]; then
        echo "❌ No running ASG instance found"
        exit 1
    fi
    
    echo "💻 Connecting to terminal on instance: $instance_id"
    
    aws ssm start-session \
        --target "$instance_id" \
        --profile "$AWS_PROFILE"
}

# Connect to database through instance
connect_db() {
    local instance_id=$(get_asg_instance)
    if [[ "$instance_id" == "None" || -z "$instance_id" ]]; then
        echo "❌ No running ASG instance found"
        exit 1
    fi
    
    echo "🗄️  Connecting to database through instance: $instance_id"
    echo "📊 Database will be available at: localhost:3306"
    echo "⏹️  Press Ctrl+C to stop"
    
    aws ssm start-session \
        --target "$instance_id" \
        --document-name AWS-StartPortForwardingSession \
        --parameters '{"portNumber":["3306"],"localPortNumber":["3306"]}' \
        --profile "$AWS_PROFILE"
}

# Show menu
show_menu() {
    echo "🔗 Quick Session Manager Connections"
    echo ""
    echo "1) 📱 Connect to App (localhost:8000)"
    echo "2) 💻 Connect to Terminal"
    echo "3) 🗄️  Connect to Database (localhost:3306)"
    echo "4) ❌ Exit"
    echo ""
    read -p "Choose an option (1-4): " choice
    
    case $choice in
        1) connect_app ;;
        2) connect_terminal ;;
        3) connect_db ;;
        4) echo "👋 Goodbye!"; exit 0 ;;
        *) echo "❌ Invalid option"; show_menu ;;
    esac
}

# Main logic
case "${1:-menu}" in
    "app") connect_app ;;
    "terminal") connect_terminal ;;
    "db") connect_db ;;
    "menu"|*) show_menu ;;
esac
