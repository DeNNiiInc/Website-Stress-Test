# 🚀 Proxmox Deployment Template (TurnKey Node.js)

**Use this guide to deploy ANY Node.js application to a TurnKey Linux LXC Container.**

---

## 📋 Prerequisites

1.  **Project**: A Node.js application (Express, Next.js, etc.) in a Git repository.
2.  **Server**: A Proxmox TurnKey Node.js Container.
3.  **Access**: Root SSH password for the container.
4.  **Domain (Optional)**: If using Cloudflare Tunnel.

---

## 🛠️ Step 1: Prepare Your Project

Ensure your project is ready for production:

1.  **Port Configuration**: Ensure your app listens on a configurable port or a fixed internal port (e.g., `4001`).
    ```javascript
    // server.js
    const PORT = process.env.PORT || 4001;
    app.listen(PORT, ...);
    ```

2.  **Git Ignore**: Ensure `node_modules` and config files with secrets are ignored.
    ```gitignore
    node_modules/
    .env
    config.json
    ```

---

## 🖥️ Step 2: One-Time Server Setup

SSH into your new container:
```bash
ssh root@<YOUR_SERVER_IP>
```

Run these commands to prepare the environment:

### 1. Install Essentials
```bash
apt-get update && apt-get install -y git
```

### 2. Prepare Directory
```bash
# Standard web directory
mkdir -p /var/www/<APP_NAME>
cd /var/www/<APP_NAME>

# Clone your repo (Use Basic Auth with Token if private)
# Format: https://<USER>:<TOKEN>@github.com/<ORG>/<REPO>.git
git clone <YOUR_REPO_URL> .

# Install dependencies
npm install
```

### 3. Setup Permissions
```bash
# Give ownership to www-data (Nginx user)
chown -R www-data:www-data /var/www/<APP_NAME>
```

---

## ⚙️ Step 3: Application Configuration

### 1. Systemd Service
Create a service file to keep your app running.

Create `/etc/systemd/system/<APP_NAME>.service`:
```ini
[Unit]
Description=<APP_NAME> Service
After=network.target

[Service]
Type=simple
User=root
# OR use 'www-data' if app doesn't need root ports
# User=www-data
WorkingDirectory=/var/www/<APP_NAME>
ExecStart=/usr/local/bin/node server.js
Restart=always
Environment=NODE_ENV=production
Environment=PORT=4001

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
systemctl daemon-reload
systemctl enable <APP_NAME>
systemctl start <APP_NAME>
```

### 2. Nginx Reverse Proxy
Configure Nginx to forward port 80 to your app (Port 4001).

Create `/etc/nginx/sites-available/<APP_NAME>`:
```nginx
server {
    listen 80;
    server_name _;

    root /var/www/<APP_NAME>;
    index index.html;

    # Serve static files (Optional)
    location / {
        try_files $uri $uri/ =404;
    }

    # Proxy API/Dynamic requests
    location /api {
        proxy_pass http://localhost:4001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable site:
```bash
# Remove defaults
rm -f /etc/nginx/sites-enabled/default
rm -f /etc/nginx/sites-enabled/nodejs

# Link new site
ln -s /etc/nginx/sites-available/<APP_NAME> /etc/nginx/sites-enabled/

# Reload
nginx -t && systemctl reload nginx
```

---

## ☁️ Step 4: Cloudflare Tunnel (Secure Access)

Expose your app securely without opening router ports.

### 1. Install Cloudflared
```bash
# Add Key
mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-public-v2.gpg | tee /usr/share/keyrings/cloudflare-public-v2.gpg >/dev/null

# Add Repo
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-public-v2.gpg] https://pkg.cloudflare.com/cloudflared any main' | tee /etc/apt/sources.list.d/cloudflared.list

# Install
apt-get update && apt-get install -y cloudflared
```

### 2. Create Tunnel
```bash
cloudflared tunnel login
cloudflared tunnel create <TUNNEL_NAME>
# Follow on-screen instructions to map domain -> http://localhost:4001
```

---

## 🔄 Step 5: Automated Updates (PowerShell)

Create a script `deploy-remote.ps1` in your project root to automate updates.

**Pre-requisite**: Create `deploy-config.json` (Add to .gitignore!):
```json
{
  "host": "<SERVER_IP>",
  "username": "root",
  "password": "<SSH_PASSWORD>",
  "remotePath": "/var/www/<APP_NAME>"
}
```

**Script `deploy-remote.ps1`**:
```powershell
# Reads config and updates remote server
$Config = Get-Content "deploy-config.json" | ConvertFrom-Json
$User = $Config.username; $HostName = $Config.host; $Pass = $Config.password
$RemotePath = $Config.remotePath

# Commands to run remotely
$Cmds = "
    cd $RemotePath
    echo '⬇️ Pulling code...'
    git pull
    echo '📦 Installing deps...'
    npm install
    echo '🚀 Restarting service...'
    systemctl restart <APP_NAME>
    systemctl status <APP_NAME> --no-pager
"

echo y | plink -ssh -t -pw $Pass "$User@$HostName" $Cmds
```

**Usage**: Just run `./deploy-remote.ps1` to deploy!
