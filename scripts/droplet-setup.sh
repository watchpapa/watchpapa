#!/bin/bash
# Run this ONCE on a fresh Ubuntu 24.04 DigitalOcean Droplet as root.
# Usage: bash droplet-setup.sh

set -e

APP_USER="watchpapa"
APP_DIR="/var/www/watchpapa"
NODE_VERSION="22"

echo "==> Updating system..."
apt-get update -y && apt-get upgrade -y

echo "==> Installing Node.js $NODE_VERSION..."
curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
apt-get install -y nodejs

echo "==> Installing nginx, certbot, git, ufw..."
apt-get install -y nginx certbot python3-certbot-nginx git ufw

echo "==> Creating app user..."
id -u $APP_USER &>/dev/null || useradd -m -s /bin/bash $APP_USER

echo "==> Creating app directory..."
mkdir -p $APP_DIR
chown $APP_USER:$APP_USER $APP_DIR

echo "==> Setting up firewall..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo "==> Adding deploy SSH key slot..."
# The GitHub Actions deploy key public key goes in /home/watchpapa/.ssh/authorized_keys
mkdir -p /home/$APP_USER/.ssh
chmod 700 /home/$APP_USER/.ssh
touch /home/$APP_USER/.ssh/authorized_keys
chmod 600 /home/$APP_USER/.ssh/authorized_keys
chown -R $APP_USER:$APP_USER /home/$APP_USER/.ssh

echo ""
echo "==> NEXT STEPS:"
echo "  1. Paste your deploy public key into: /home/$APP_USER/.ssh/authorized_keys"
echo "  2. Edit /var/www/watchpapa/.env with your secrets (see .env.example)"
echo "  3. Run: systemctl enable watchpapa && systemctl start watchpapa"
echo "  4. Run: certbot --nginx -d yourdomain.com"
