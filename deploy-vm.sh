#!/bin/bash

# Daikin Warranty Automation - VM Deployment Script
# For Google Cloud VM deployment

echo "🚀 Starting Daikin Warranty Automation VM deployment..."

# Update system
sudo apt-get update -y
sudo apt-get upgrade -y

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install required system dependencies for Playwright/Chrome
sudo apt-get install -y \
    libnss3-dev \
    libatk-bridge2.0-dev \
    libdrm2 \
    libxkbcommon0 \
    libgtk-3-dev \
    libgbm-dev \
    libasound2-dev

# Create app directory
sudo mkdir -p /app
sudo chown $(whoami):$(whoami) /app
cd /app

# Clone or copy your project files here
# (You would copy your project files to /app)

# Create downloads directory
mkdir -p /app/downloads
mkdir -p /app/logs

# Install Node.js dependencies
npm install

# Install Playwright browsers
npx playwright install chromium
npx playwright install-deps chromium

# Set environment variables for VM
export NODE_ENV=vm
export DOWNLOAD_PATH=/app/downloads
export SERVE_DOWNLOADS_VIA_API=true
export WEBHOOK_PORT=3000

# Create systemd service file
sudo tee /etc/systemd/system/daikin-automation.service > /dev/null <<EOF
[Unit]
Description=Daikin Warranty Automation Service
After=network.target

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=/app
Environment=NODE_ENV=vm
Environment=DOWNLOAD_PATH=/app/downloads
Environment=SERVE_DOWNLOADS_VIA_API=true
Environment=WEBHOOK_PORT=3000
ExecStart=/usr/bin/node src/webhookServer.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable and start the service
sudo systemctl daemon-reload
sudo systemctl enable daikin-automation
sudo systemctl start daikin-automation

# Configure firewall
sudo ufw allow 3000/tcp

# Display service status
echo "🎯 Deployment complete!"
echo "📊 Service status:"
sudo systemctl status daikin-automation --no-pager -l

echo ""
echo "🌐 Service endpoints:"
echo "Health check: http://[VM-IP]:3000/health"
echo "Webhook: http://[VM-IP]:3000/webhook/warranty-registration"
echo "Downloads: http://[VM-IP]:3000/downloads"
echo ""
echo "📋 Useful commands:"
echo "View logs: sudo journalctl -u daikin-automation -f"
echo "Restart service: sudo systemctl restart daikin-automation"
echo "Stop service: sudo systemctl stop daikin-automation" 