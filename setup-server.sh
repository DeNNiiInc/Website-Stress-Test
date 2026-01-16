# setup-server.sh - Initial Setup Script

# 1. System Tuning for High Concurrency
echo "Tuning system limits..."
# Increase max open files for high connection counts
if ! grep -q "soft nofile 65535" /etc/security/limits.conf; then
    echo "* soft nofile 65535" >> /etc/security/limits.conf
    echo "* hard nofile 65535" >> /etc/security/limits.conf
fi
# Apply limits to current session (for the rest of this script)
ulimit -n 65535

# 2. Install Global Dependencies
echo "Installing PM2..."
npm install -g pm2

# 3. Clone Repository
# ... (rest of cloning logic)
REPO_URL="$1"
APP_DIR="$2"
GITHUB_TOKEN="$3"

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

# 4. Install App Dependencies
echo "Installing application dependencies..."
npm install

# 5. Start Application with PM2
APP_NAME="website-stress-test"
echo "Starting application with PM2 ($APP_NAME)..."
# Using Node built-in clustering, but PM2 monitors the master
pm2 stop "$APP_NAME" || true
pm2 start proxy-server.js --name "$APP_NAME" --max-memory-restart 1G
pm2 save
pm2 startup | tail -n 1 | bash # Setup startup script

# 6. Setup Cron Job for Auto-Sync
echo "Setting up Cron Job for auto-sync..."
SCRIPT_PATH="$APP_DIR/auto-sync.sh"
chmod +x "$SCRIPT_PATH"

# Add to crontab if not exists
(crontab -l 2>/dev/null; echo "*/5 * * * * $SCRIPT_PATH >> /var/log/app-sync.log 2>&1") | crontab -

echo "✅ Setup Complete! Application is running with system optimizations."
pm2 status
