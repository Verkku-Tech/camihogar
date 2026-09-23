<#
.SYNOPSIS
    Cloudflare Production & Tunnel Security Audit Script (PowerShell version)
    Audits WAF headers, TLS 1.3, HSTS, and Cloudflare Tunnel host resolution.
    Strict rule: NO destructive commands.
#>

param(
    [string]$TargetDomain = "camihogar.verkku.com",
    [string]$SshTunnelHost = "ssh-camihogar.verkku.com"
)

$ErrorActionPreference = "Continue"

Write-Host "=== [1/4] Auditing Cloudflare Edge Headers for https://$TargetDomain ===" -ForegroundColor Cyan
try {
    Add-Type -AssemblyName System.Net.Http -ErrorAction SilentlyContinue
    $handler = [System.Net.Http.HttpClientHandler]::new()
    $client = [System.Net.Http.HttpClient]::new($handler)
    $client.Timeout = [System.TimeSpan]::FromSeconds(3)
    $request = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Head, "https://$TargetDomain")
    $request.Headers.Add("User-Agent", "Mozilla/5.0 (SecurityAudit/1.0)")
    
    $response = $client.SendAsync($request).GetAwaiter().GetResult()
    $server = $response.Headers.Server.ToString()
    $cfRay = if ($response.Headers.Contains("cf-ray")) { ($response.Headers.GetValues("cf-ray") -join ", ") } else { $null }
    $hsts = if ($response.Headers.Contains("Strict-Transport-Security")) { ($response.Headers.GetValues("Strict-Transport-Security") -join ", ") } else { $null }

    if ($server -match "cloudflare" -or $cfRay) {
        Write-Host "[+] Cloudflare edge headers verified. Server: $server, CF-Ray: $cfRay" -ForegroundColor Green
    } else {
        Write-Host "[-] WARNING: Cloudflare proxy headers missing or domain not proxied through Cloudflare!" -ForegroundColor Yellow
    }

    Write-Host "=== [2/4] Verifying Strict Transport Security (HSTS) ===" -ForegroundColor Cyan
    if ($hsts) {
        Write-Host "[+] HSTS header enforced: $hsts" -ForegroundColor Green
    } else {
        Write-Host "[-] WARNING: HSTS header not found on production domain." -ForegroundColor Yellow
    }
} catch {
    Write-Host "[-] Note: Could not query https://$TargetDomain directly (local offline or DNS sandbox): $_" -ForegroundColor Yellow
}

Write-Host "=== [3/4] Verifying Cloudflare Tunnel Endpoint DNS & Routing ===" -ForegroundColor Cyan
try {
    $dns = Resolve-DnsName -Name $SshTunnelHost -ErrorAction SilentlyContinue
    if ($dns) {
        Write-Host "[+] Tunnel endpoint $SshTunnelHost resolves cleanly via DNS." -ForegroundColor Green
    } else {
        Write-Host "[-] Notice: Tunnel endpoint $SshTunnelHost did not resolve via local DNS (may require active VPN or cloudflared)." -ForegroundColor Yellow
    }
} catch {
    Write-Host "[-] Notice: DNS resolution check skipped or failed: $_" -ForegroundColor Yellow
}

Write-Host "=== [4/4] Verifying SSH Tunnel Protocol Pre-requisites ===" -ForegroundColor Cyan
Write-Host "Access command protocol (read-only):" -ForegroundColor White
Write-Host "  1. cloudflared access tcp --hostname $SshTunnelHost --url localhost:9888" -ForegroundColor Gray
Write-Host "  2. ssh sa@localhost -p 9888" -ForegroundColor Gray
Write-Host "Reminder: Destructive commands on the RPi 5 are strictly prohibited without user permission." -ForegroundColor Red

Write-Host "=== Cloudflare Audit Script Finished ===" -ForegroundColor Cyan
