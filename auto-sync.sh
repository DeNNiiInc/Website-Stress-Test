#!/bin/bash

# auto-sync.sh - Run by Cron every 5 minutes

APP_DIR="/var/www/website-stress-test"
APP_NAME="website-stress-test"

cd "$APP_DIR" || exit

echo "[$(date)] Checking for updates..."

# Fetch latest changes
git remote update

# Check if we are behind
UPSTREAM=${1:-'@{u}'}
LOCAL=$(git rev-parse @)
REMOTE=$(git rev-parse "$UPSTREAM")
BASE=$(git merge-base @ "$UPSTREAM")

if [ "$LOCAL" = "$REMOTE" ]; then
    echo "Up-to-date."
elif [ "$LOCAL" = "$BASE" ]; then
    echo "Update available using git pull."
    git pull
    echo "Installing dependencies..."
    npm install
    echo "Restarting PM2 process..."
    pm2 restart "$APP_NAME"
    echo "✅ Updated and restarted."
elif [ "$REMOTE" = "$BASE" ]; then
    echo "Need to push"
else
    echo "Diverged"
fi
