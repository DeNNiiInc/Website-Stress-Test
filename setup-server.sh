#!/bin/bash

# setup-server.sh - Initial Setup Script

# 1. Install Global Dependencies
echo "Installing PM2..."
npm install -g pm2

# 2. Clone Repository
# Expects: REPO_URL, APP_DIR, GITHUB_TOKEN inside the script or env
# We'll use arguments passed to this script: $1=REPO_URL $2=APP_DIR $3=GITHUB_TOKEN

REPO_URL="$1"
APP_DIR="$2"
GITHUB_TOKEN="$3"

# Construct URL with token for auth
# Extract host and path from REPO_URL (assuming https://github.com/user/repo.git)
# We need to insert token: https://TOKEN@github.com/user/repo.git
# Simple replacement:
AUTH_REPO_URL="${REPO_URL/https:\/\//https:\/\/$GITHUB_TOKEN@}"

echo "Preparing application directory: $APP_DIR"
mkdir -p "$APP_DIR"

if [ -d "$APP_DIR/.git" ]; then
    echo "Repo already exists. Pulling latest..."
    cd "$APP_DIR"
    git pull
else
    echo "Cloning repository..."
    git clone "$AUTH_REPO_URL" "$APP_DIR"
    cd "$APP_DIR"
fi

# 3. Install App Dependencies
echo "Installing application dependencies..."
npm install

# 4. Start Application with PM2
APP_NAME="website-stress-test"
echo "Starting application with PM2 ($APP_NAME)..."
pm2 start proxy-server.js --name "$APP_NAME" --watch --ignore-watch="node_modules"
pm2 save
pm2 startup | tail -n 1 | bash # Setup startup script

# 5. Setup Cron Job for Auto-Sync
echo "Setting up Cron Job for auto-sync..."
SCRIPT_PATH="$APP_DIR/auto-sync.sh"
chmod +x "$SCRIPT_PATH"

# Add to crontab if not exists
(crontab -l 2>/dev/null; echo "*/5 * * * * $SCRIPT_PATH >> /var/log/app-sync.log 2>&1") | crontab -

echo "✅ Setup Complete! Application is running."
pm2 status
