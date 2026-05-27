#!/bin/bash
set -euo pipefail

# ================================================================
# VPS Setup Script for Practice Log
# Run this on your VPS (root@91.98.169.109) after SSHing in.
# ================================================================

echo "=== Practice Log VPS Setup ==="

# --- 1. Install Docker ---
if ! command -v docker &>/dev/null; then
  echo "Installing Docker..."
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
    tee /etc/apt/sources.list.d/docker.list > /dev/null
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
  systemctl enable docker
  systemctl start docker
  echo "Docker installed."
else
  echo "Docker already installed."
fi

# --- 2. Install Caddy ---
if ! command -v caddy &>/dev/null; then
  echo "Installing Caddy..."
  apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq
  apt-get install -y -qq caddy
  systemctl enable caddy
  echo "Caddy installed."
else
  echo "Caddy already installed."
fi

# --- 3. Create deployment directory ---
mkdir -p /opt/practice-log
echo "/opt/practice-log directory ready."

# --- 4. Create Caddyfile ---
cat > /etc/caddy/Caddyfile <<'CADDYEOF'
steinwaygrandkh.com {
    reverse_proxy localhost:3000
}
CADDYEOF

echo "Caddyfile created at /etc/caddy/Caddyfile"

# --- 5. Create .env file for the app ---
# ⚠️  You need to set these values manually after the first run:
#   NEXT_PUBLIC_SUPABASE_URL
#   NEXT_PUBLIC_SUPABASE_ANON_KEY
#   SUPABASE_SERVICE_ROLE_KEY
echo "Creating env template at /opt/practice-log/.env..."
cat > /opt/practice-log/.env <<'ENVEOF'
NEXT_PUBLIC_SUPABASE_URL=https://avhbaejsitprtsuhricz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2aGJhZWpzaXRwcnRzdWhyaWN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3NzYzMzQsImV4cCI6MjA5NTM1MjMzNH0.kfYXDB1J0kKz7SG9eBk_X9Aof0oqv-r6DkwmDZOAEHI
SUPABASE_SERVICE_ROLE_KEY=
ENVEOF

echo ""
echo "=== Setup Complete! ==="
echo ""
echo "Next steps:"
echo "  1. Edit /opt/practice-log/.env and add your SUPABASE_SERVICE_ROLE_KEY"
echo "     (Get it from https://supabase.com/dashboard/project/avhbaejsitprtsuhricz/settings/api)"
echo ""
echo "  2. Copy the deploy files to /opt/practice-log:"
echo "     rsync -avz --delete . root@91.98.169.109:/opt/practice-log/"
echo ""
echo "  3. Start the app:"
echo "     cd /opt/practice-log && docker compose up -d"
echo ""
echo "  4. Reload Caddy:"
echo "     caddy reload --config /etc/caddy/Caddyfile"
echo ""
echo "  5. Run the database migration:"
echo "     curl http://localhost:3000/api/run-migration"
echo "     (Or run supabase-fix-email.sql in the Supabase Dashboard SQL Editor)"
echo ""
echo "  6. Point your DNS: steinwaygrandkh.com A record -> 91.98.169.109"
echo "     (At Namecheap, add an A record for @ and optionally www)"
echo ""
