# WebSocket Production Setup Guide

## Problem
WebSocket connections fail in production at `teamtaskflow.atalou.info` because Apache is not properly configured to handle WebSocket upgrades.

## Root Cause
The production server uses Apache as a reverse proxy, but it's missing the WebSocket proxy configuration. When the client tries to connect to `wss://teamtaskflow.atalou.info/ws`, Apache returns a regular HTTP response instead of upgrading the connection to WebSocket.

## Solution: Apache Configuration

### 1. Enable Required Modules
```bash
sudo a2enmod proxy
sudo a2enmod proxy_http
sudo a2enmod proxy_wstunnel
sudo a2enmod rewrite
```

### 2. Update Apache Virtual Host Configuration
Add this to your Apache virtual host configuration (typically in `/etc/apache2/sites-available/teamtaskflow.atalou.info.conf`):

```apache
<VirtualHost *:443>
    ServerName teamtaskflow.atalou.info
    
    # SSL configuration (existing)
    SSLEngine on
    SSLCertificateFile /path/to/your/cert.pem
    SSLCertificateKeyFile /path/to/your/private.key
    
    # WebSocket proxy configuration
    ProxyPreserveHost On
    ProxyRequests Off
    
    # WebSocket upgrade handling
    RewriteEngine On
    RewriteCond %{HTTP:Upgrade} websocket [NC]
    RewriteCond %{HTTP:Connection} upgrade [NC]
    RewriteRule ^/ws$ ws://localhost:5000/ws [P,L]
    
    # Regular HTTP proxy for API and static files
    ProxyPass /api/ http://localhost:5000/api/
    ProxyPassReverse /api/ http://localhost:5000/api/
    
    ProxyPass /ws ws://localhost:5000/ws
    ProxyPassReverse /ws ws://localhost:5000/ws
    
    # Fallback for all other requests
    ProxyPass / http://localhost:5000/
    ProxyPassReverse / http://localhost:5000/
    
    # Headers for WebSocket support
    ProxyPassMatch ^/ws$ ws://localhost:5000/ws upgrade=websocket
    ProxyPassReverseMatch ^/ws$ ws://localhost:5000/ws upgrade=websocket
</VirtualHost>
```

### 3. Test Configuration
```bash
# Test Apache configuration
sudo apache2ctl configtest

# Restart Apache
sudo systemctl restart apache2

# Test WebSocket connection
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" -H "Sec-WebSocket-Key: x3JJHMbDL1EzLkh9GBhXDw==" -H "Sec-WebSocket-Version: 13" https://teamtaskflow.atalou.info/ws
```

## Alternative: Nginx Configuration
If using Nginx instead of Apache:

```nginx
server {
    listen 443 ssl;
    server_name teamtaskflow.atalou.info;
    
    # SSL configuration (existing)
    ssl_certificate /path/to/your/cert.pem;
    ssl_certificate_key /path/to/your/private.key;
    
    # WebSocket proxy
    location /ws {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
    
    # Regular HTTP proxy
    location / {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Debugging Commands

### Check if WebSocket modules are enabled (Apache)
```bash
apache2ctl -M | grep proxy
```

### Test WebSocket connection
```bash
# Test with curl
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" -H "Sec-WebSocket-Key: x3JJHMbDL1EzLkh9GBhXDw==" -H "Sec-WebSocket-Version: 13" https://teamtaskflow.atalou.info/ws

# Test with websocat (if available)
websocat wss://teamtaskflow.atalou.info/ws
```

### Monitor logs
```bash
# Apache logs
sudo tail -f /var/log/apache2/error.log
sudo tail -f /var/log/apache2/access.log

# Application logs
sudo journalctl -u your-app-service -f
```

## Fallback System
The application now includes a fallback system that will automatically switch to HTTP polling if WebSocket connections fail. This ensures chat functionality continues to work even if the WebSocket proxy is not properly configured.