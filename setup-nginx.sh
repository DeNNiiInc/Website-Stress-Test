#!/bin/bash
# setup-nginx.sh

APP_NAME="website-stress-test"

# Install Nginx if not present
if ! command -v nginx &> /dev/null; then
    echo "Installing Nginx..."
    apt-get update
    apt-get install -y nginx
fi

# Create Config
cat > /etc/nginx/sites-available/$APP_NAME <<EOL
server {
    listen 80;
    server_name _;

    root /var/www/$APP_NAME;
    index index.html;

    # Serve static files
    location / {
        try_files \$uri \$uri/ =404;
    }

    # Proxy API requests
    location /proxy {
        proxy_pass http://localhost:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        
        # Rewrite /proxy to / for the backend if needed?
        # proxy-server.js treats everything as a request.
        # If I proxy_pass http://localhost:3000/ then /proxy becomes /
        # If I proxy_pass http://localhost:3000 then /proxy/foo becomes /proxy/foo.
        # proxy-server.js doesn't check path, so stripping /proxy is safer.
        # Using trailing slash in proxy_pass implies stripping the location match.
    }
}
EOL

# Enable Site
ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Reload Nginx
nginx -t && systemctl reload nginx
echo "✅ Nginx Configured!"
