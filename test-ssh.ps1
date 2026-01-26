# SSH Connection Test Script for GoDaddy
# This script helps test SSH access and check for Node.js

Write-Host "=== SSH Connection Test ===" -ForegroundColor Cyan
Write-Host ""

# Get connection details from user
$hostname = Read-Host "Enter your SSH hostname or IP (e.g., your-domain.cr or IP address)"
$username = Read-Host "Enter your SSH username"

Write-Host ""
Write-Host "Testing SSH connection..." -ForegroundColor Yellow
Write-Host "Command: ssh $username@$hostname 'echo SSH connection successful && node --version 2>/dev/null || echo Node.js not found'" -ForegroundColor Gray
Write-Host ""

# Test SSH connection and check for Node.js
$testCommand = "ssh $username@$hostname 'echo SSH_CONNECTION_OK && which node && node --version && npm --version || echo NODE_NOT_FOUND'"

try {
    $result = Invoke-Expression $testCommand 2>&1
    
    if ($result -match "SSH_CONNECTION_OK") {
        Write-Host "✓ SSH connection successful!" -ForegroundColor Green
        Write-Host ""
        
        if ($result -match "NODE_NOT_FOUND") {
            Write-Host "⚠ Node.js is NOT installed on the server" -ForegroundColor Yellow
            Write-Host "You'll need to install Node.js to run the DVPI Web application" -ForegroundColor Yellow
        } else {
            Write-Host "✓ Node.js is installed!" -ForegroundColor Green
            $result | Where-Object { $_ -match "v\d+" -or $_ -match "^\d+\.\d+" } | ForEach-Object {
                Write-Host "  $_" -ForegroundColor Green
            }
        }
    } else {
        Write-Host "✗ SSH connection failed or returned unexpected result" -ForegroundColor Red
        Write-Host "Result: $result" -ForegroundColor Gray
    }
} catch {
    Write-Host "✗ SSH connection failed!" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Possible issues:" -ForegroundColor Yellow
    Write-Host "1. SSH is not enabled on your GoDaddy hosting" -ForegroundColor Gray
    Write-Host "2. Incorrect hostname or username" -ForegroundColor Gray
    Write-Host "3. Firewall blocking SSH (port 22)" -ForegroundColor Gray
    Write-Host "4. SSH key not properly configured" -ForegroundColor Gray
}

Write-Host ""
Write-Host "=== Manual Test ===" -ForegroundColor Cyan
Write-Host "You can also test manually by running:" -ForegroundColor Gray
Write-Host "  ssh $username@$hostname" -ForegroundColor White
Write-Host ""
Write-Host "Once connected, test Node.js with:" -ForegroundColor Gray
Write-Host "  node --version" -ForegroundColor White
Write-Host "  npm --version" -ForegroundColor White
