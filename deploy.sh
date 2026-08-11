#!/bin/bash
# ----------------------------------------------------
# FURY-Telemetry-Gateway Fail-Fast Deployment Script
# Gatekeeper: Antigravity Pre-Flight Diagnostic
# ----------------------------------------------------

set -e

echo "🚀 Initiating FURY-Telemetry-Gateway Deployment Pipeline..."

# STEP 1: Antigravity Pre-Flight Diagnostic
echo "[>] Executing Antigravity Pre-Flight Diagnostic Gatekeeper..."
if node src/antigravity_preflight.js; then
    echo "✅ Antigravity Pre-Flight Passed! [SYSTEM_LIVE_COMMITTED]"
else
    echo "❌ [HALTED] Antigravity Pre-Flight Diagnostic Failed!"
    echo "[-] ABORTING DEPLOYMENT. No daemon or file updates executed."
    exit 1
fi

# STEP 2: Production Setup
echo "[>] Installing production dependencies..."
npm install --production

# STEP 3: Daemon Reload under PM2
if command -v pm2 &> /dev/null; then
    echo "[>] Reloading fury-telemetry-gateway under PM2..."
    pm2 reload fury-telemetry-gateway 2>/dev/null || pm2 start src/index.js --name "fury-telemetry-gateway"
    pm2 save
else
    echo "[!] PM2 is not installed globally. Starting standalone daemon..."
    npm start &
fi

echo "===================================================="
echo "✅ FURY-Telemetry-Gateway Deployed Successfully!"
echo "===================================================="
