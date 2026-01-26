# Deployment Guide for DVPI Web

This guide explains how to deploy the DVPI Web application to a remote server.

## Prerequisites

- Node.js (v14 or higher) installed on the server
- npm or yarn
- PM2 (recommended for process management) - `npm install -g pm2`
- A reverse proxy like Nginx (recommended for production)

## Step 1: Build the Application

On your local machine or on the server:

```bash
# Install all dependencies
npm run install-all

# Build the React frontend for production
npm run build
```

This creates an optimized production build in `client/build/`.

## Step 2: Transfer Files to Server

Transfer the entire `DVPIweb` directory to your server. You can use:

- **SCP**: `scp -r DVPIweb user@server:/path/to/destination`
- **SFTP/FTP**: Use an FTP client like FileZilla to upload the directory
- **Git**: Clone/pull from a repository on the server

### Where to Put the Application?

**The location doesn't matter**, but common choices are:

- `/var/www/dvpi-web` - Traditional web app location
- `/opt/dvpi-web` - For installed applications
- `/home/username/dvpi-web` - User's home directory
- `/srv/dvpi-web` - Service data directory

**Important**: Whatever path you choose, make sure to:
1. Use the same path in all configuration files (Nginx, PM2, systemd)
2. The user running the app has read/write permissions
3. The path is accessible and makes sense for your setup

## Step 3: Install Dependencies on Server

SSH into your server and navigate to the application directory:

```bash
cd /path/to/DVPIweb

# Install production dependencies (backend)
npm install --production

# Install frontend dependencies and build (if not already built)
cd client
npm install
npm run build
cd ..
```

## Step 4: Set Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
nano .env
```

Update the values as needed:

```env
NODE_ENV=production
PORT=3001
DVPI_USERNAME=sa-feltreg
DVPI_PASSWORD=your-password-here
```

## Step 5: Create Required Directories

```bash
mkdir -p logs uploads
```

## Step 6: Start the Application

### Option A: Using PM2 (Recommended)

PM2 keeps your application running and restarts it if it crashes:

```bash
# Install PM2 globally (if not already installed)
npm install -g pm2

# Start the application
pm2 start ecosystem.config.js

# Save PM2 configuration to start on system reboot
pm2 save
pm2 startup
```

Useful PM2 commands:
- `pm2 list` - View running processes
- `pm2 logs dvpi-web` - View logs
- `pm2 restart dvpi-web` - Restart the app
- `pm2 stop dvpi-web` - Stop the app
- `pm2 delete dvpi-web` - Remove from PM2

### Option B: Using systemd (Alternative)

Create a systemd service file `/etc/systemd/system/dvpi-web.service`:

```ini
[Unit]
Description=DVPI Web Application
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/path/to/DVPIweb
Environment=NODE_ENV=production
Environment=PORT=3001
ExecStart=/usr/bin/node server/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl daemon-reload
sudo systemctl enable dvpi-web
sudo systemctl start dvpi-web
sudo systemctl status dvpi-web
```

### Option C: Direct Node (Not Recommended for Production)

```bash
NODE_ENV=production PORT=3001 node server/index.js
```

## Step 7: Set Up Reverse Proxy (Nginx)

Create an Nginx configuration file `/etc/nginx/sites-available/dvpi-web`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Redirect HTTP to HTTPS (optional but recommended)
    # return 301 https://$server_name$request_uri;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Increase timeouts for file uploads
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
        
        # Increase body size for large CSV files
        client_max_body_size 50M;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/dvpi-web /etc/nginx/sites-enabled/
sudo nginx -t  # Test configuration
sudo systemctl reload nginx
```

### HTTPS with Let's Encrypt (Recommended)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## Step 8: Firewall Configuration

If using a firewall, allow HTTP/HTTPS traffic:

```bash
# UFW example
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

## Troubleshooting

### Check if the application is running:
```bash
pm2 list
# or
sudo systemctl status dvpi-web
```

### View logs:
```bash
pm2 logs dvpi-web
# or
sudo journalctl -u dvpi-web -f
```

### Check if the port is in use:
```bash
netstat -tulpn | grep 3001
# or
lsof -i :3001
```

### Test the API directly:
```bash
curl http://localhost:3001/api/health
```

## Updating the Application

1. Pull/transfer the latest code
2. Install new dependencies: `npm install --production`
3. Rebuild frontend if needed: `cd client && npm run build && cd ..`
4. Restart: `pm2 restart dvpi-web` or `sudo systemctl restart dvpi-web`

## File Permissions

Ensure the application has write permissions for:
- `uploads/` directory (for temporary file uploads)
- `logs/` directory (if using PM2 logs)

```bash
chmod -R 755 uploads logs
```

## Security Considerations

1. **Environment Variables**: Never commit `.env` file to version control
2. **File Uploads**: The `uploads/` directory should be cleaned regularly (files are deleted after processing, but ensure the directory exists)
3. **HTTPS**: Always use HTTPS in production
4. **Firewall**: Only expose necessary ports
5. **User Permissions**: Run the application as a non-root user

## Monitoring

Consider setting up monitoring:
- PM2 monitoring: `pm2 monit`
- Log rotation for PM2: `pm2 install pm2-logrotate`
- Application monitoring tools (e.g., New Relic, DataDog)
