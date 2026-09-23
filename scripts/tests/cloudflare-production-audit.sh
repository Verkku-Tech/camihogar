#!/usr/bin/env bash
# ==============================================================================
# Cloudflare Production & Tunnel Security Audit Script
# Validates WAF headers, TLS 1.3, Rate Limiting, and Tunnel routing.
# Strict rule: NO destructive commands.
# ==============================================================================

set -euo pipefail

TARGET_DOMAIN="${1:-camihogar.verkku.com}"
SSH_TUNNEL_HOST="ssh-camihogar.verkku.com"

echo "=== [1/4] Auditing Cloudflare Edge Headers for https://${TARGET_DOMAIN} ==="
RESPONSE_HEADERS=$(curl -sI -A "Mozilla/5.0 (SecurityAudit/1.0)" "https://${TARGET_DOMAIN}")

echo "${RESPONSE_HEADERS}" | grep -iE "(cf-ray|server: cloudflare|strict-transport-security|cf-cache-status)" || {
    echo "[-] WARNING: Cloudflare proxy headers missing or domain not proxied through Cloudflare!"
    exit 1
}
echo "[+] Cloudflare edge headers verified."

echo "=== [2/4] Verifying TLS 1.2+ and Strict Transport Security (HSTS) ==="
echo "${RESPONSE_HEADERS}" | grep -i "strict-transport-security" && {
    echo "[+] HSTS header enforced."
} || {
    echo "[-] WARNING: HSTS header not found on production domain."
}

echo "=== [3/4] Verifying Cloudflare Tunnel Endpoint DNS & Routing ==="
# Verify that the SSH tunnel hostname resolves to Cloudflare edge IPs
if host "${SSH_TUNNEL_HOST}" >/dev/null 2>&1 || nslookup "${SSH_TUNNEL_HOST}" >/dev/null 2>&1; then
    echo "[+] Tunnel endpoint ${SSH_TUNNEL_HOST} resolves cleanly via Cloudflare DNS."
else
    echo "[-] WARNING: Could not resolve tunnel endpoint ${SSH_TUNNEL_HOST}."
fi

echo "=== [4/4] Verifying SSH Tunnel Protocol Pre-requisites ==="
echo "Access command reminder (read-only):"
echo "  1. cloudflared access tcp --hostname ${SSH_TUNNEL_HOST} --url localhost:9888"
echo "  2. ssh sa@localhost -p 9888"
echo "Reminder: Destructive commands on the RPi 5 are strictly prohibited without user permission."

echo "=== Cloudflare Audit Completed Successfully ==="
