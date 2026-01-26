#!/bin/bash
# SSH Connection Test Script for GoDaddy
# This script helps test SSH access and check for Node.js

echo "=== SSH Connection Test ==="
echo ""

# Get connection details from user
read -p "Enter your SSH hostname or IP (e.g., your-domain.cr or IP address): " hostname
read -p "Enter your SSH username: " username

echo ""
echo "Testing SSH connection..."
echo ""

# Test SSH connection and check for Node.js
ssh "$username@$hostname" << 'EOF'
    echo "✓ SSH connection successful!"
    echo ""
    
    if command -v node &> /dev/null; then
        echo "✓ Node.js is installed!"
        echo "  Node version: $(node --version)"
        echo "  NPM version: $(npm --version)"
    else
        echo "⚠ Node.js is NOT installed on the server"
        echo "You'll need to install Node.js to run the DVPI Web application"
    fi
    
    echo ""
    echo "System information:"
    uname -a
EOF

if [ $? -eq 0 ]; then
    echo ""
    echo "✓ SSH test completed successfully!"
else
    echo ""
    echo "✗ SSH connection failed!"
    echo ""
    echo "Possible issues:"
    echo "1. SSH is not enabled on your GoDaddy hosting"
    echo "2. Incorrect hostname or username"
    echo "3. Firewall blocking SSH (port 22)"
    echo "4. SSH key not properly configured"
fi
