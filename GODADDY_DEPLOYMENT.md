# Deploying to GoDaddy Hosting

## Important: GoDaddy Hosting Limitations

**Most GoDaddy shared hosting plans do NOT support Node.js applications.** You typically need:

1. **GoDaddy cPanel Hosting (Shared)**: Does NOT support Node.js - only PHP, Python (limited), static files
2. **GoDaddy VPS/Dedicated Server**: Supports Node.js if you have root access
3. **GoDaddy Managed WordPress**: Does NOT support Node.js

## Check Your Hosting Type

1. Log into your GoDaddy account
2. Check what type of hosting you have:
   - **Shared Hosting/cPanel**: Usually doesn't support Node.js
   - **VPS (Virtual Private Server)**: May support Node.js
   - **Dedicated Server**: Supports Node.js

## FTP Connection Issues

### Error: "EAI_NONAME - Neither nodename nor servname provided"

This means the hostname `ftp.vd.cr` cannot be resolved. Try:

1. **Use the correct FTP hostname** from GoDaddy:
   - Log into GoDaddy → My Products → Web Hosting
   - Look for "FTP Hostname" or "FTP Server"
   - Common formats: `ftp.yourdomain.com` or `ftp.yourdomain.cr`
   - Or use the IP address if provided

2. **Check FTP credentials**:
   - Username: Usually your cPanel username or full email
   - Password: Your FTP password (may differ from cPanel password)
   - Port: Usually 21 (or 22 for SFTP)

3. **Try SFTP instead of FTP**:
   - In FileZilla: File → Site Manager → Protocol: SFTP
   - Port: 22

4. **Test DNS resolution**:
   ```bash
   # On Windows (Command Prompt)
   nslookup ftp.vd.cr
   
   # Or ping
   ping ftp.vd.cr
   ```

## Options for Node.js on GoDaddy

### Option 1: GoDaddy VPS with Node.js Support

If you have a VPS:

1. **SSH into your server** (not FTP):
   ```bash
   ssh username@your-server-ip
   ```

2. **Install Node.js** (if not already installed):
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

3. **Follow the standard deployment guide** (DEPLOYMENT.md)

### Option 2: Use a Different Hosting Provider

For Node.js applications, consider:

- **DigitalOcean**: $6/month droplet
- **Linode**: $5/month
- **AWS EC2**: Pay-as-you-go
- **Heroku**: Free tier available
- **Railway**: Free tier available
- **Render**: Free tier available

### Option 3: Convert to Static Site (Limited Functionality)

If you only have shared hosting, you could:

1. **Deploy backend separately** (on a Node.js-capable service)
2. **Build React frontend** and upload static files to GoDaddy
3. **Configure CORS** to allow GoDaddy frontend to call your backend API

This requires:
- Backend on a Node.js-capable server (Railway, Render, etc.)
- Frontend built and uploaded to GoDaddy via FTP
- CORS configuration in backend

## Getting FTP Credentials from GoDaddy

1. Log into GoDaddy account
2. Go to **My Products** → **Web Hosting** → **Manage**
3. Look for **FTP** or **File Manager** section
4. Find:
   - **FTP Hostname** (e.g., `ftp.yourdomain.com`)
   - **FTP Username** (usually your cPanel username)
   - **FTP Password** (reset if needed)

## Alternative: Use GoDaddy File Manager

Instead of FTP, you can:

1. Log into GoDaddy cPanel
2. Use **File Manager** (web-based file browser)
3. Upload files directly through the browser

**Note**: This still won't help if your hosting doesn't support Node.js.

## Recommended Solution

**For a Node.js application like DVPI Web, you need:**

1. **A VPS or server with Node.js support**, OR
2. **A different hosting provider** that supports Node.js

If you're on GoDaddy shared hosting, you'll need to either:
- Upgrade to a VPS plan
- Move to a Node.js-capable hosting provider
- Use a hybrid approach (backend elsewhere, static frontend on GoDaddy)

## Quick Test: Check if Node.js is Available

If you have SSH access, try:

```bash
which node
node --version
npm --version
```

If these commands fail, Node.js is not installed and you'll need to install it or use a different hosting solution.
