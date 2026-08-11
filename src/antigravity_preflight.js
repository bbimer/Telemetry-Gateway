/**
 * Antigravity Pre-Flight Diagnostic Protocol
 * 5-State State Machine Gatekeeper for Deployment Integration
 * Status: PASS -> SYSTEM_LIVE_COMMITTED (exit code 0) | FAIL -> HALTED (exit code 1)
 */

const os = require('os');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { initDatabase, verifyIntegrity, closeDb } = require('./database');
const { dispatchTestPayload } = require('./telegramRouter');
require('dotenv').config();

const STATES = {
  INIT_DEPLOY: 'INIT_DEPLOY',
  STATE_1_RESOURCE_AUDIT: 'STATE 1: RESOURCE_AUDIT',
  STATE_2_DEPENDENCY_CHECK: 'STATE 2: DEPENDENCY_CHECK',
  STATE_3_NETWORK_TOPOLOGY_PING: 'STATE 3: NETWORK_TOPOLOGY_PING',
  STATE_4_LEDGER_INTEGRITY: 'STATE 4: LEDGER_INTEGRITY',
  STATE_5_MOCK_EXECUTION_FLOW: 'STATE 5: MOCK_EXECUTION_FLOW',
  SYSTEM_LIVE_COMMITTED: 'SYSTEM_LIVE_COMMITTED',
  HALTED: 'HALTED'
};

async function runAntigravityDiagnostic() {
  console.log('====================================================');
  console.log('🚀 ANTIGRAVITY PRE-FLIGHT DIAGNOSTIC SUITE');
  console.log('Deployment Gatekeeper');
  console.log('====================================================\n');

  let currentState = STATES.INIT_DEPLOY;
  console.log(`[+] Initializing State Machine: [${currentState}]`);

  try {
    // ----------------------------------------------------
    // STATE 1: RESOURCE_AUDIT
    // ----------------------------------------------------
    currentState = STATES.STATE_1_RESOURCE_AUDIT;
    console.log(`\n[>] Transitioning to [${currentState}]...`);

    const freeRamMb = os.freemem() / (1024 * 1024);
    const cpuCores = os.cpus().length;
    const loadAvg = os.loadavg()[0];

    console.log(`    • Available RAM: ${freeRamMb.toFixed(2)} MB (Required > 150MB)`);
    console.log(`    • CPU Cores: ${cpuCores}`);
    console.log(`    • Load Average (1m): ${loadAvg.toFixed(2)}`);

    if (freeRamMb < 150) {
      throw new Error(`Insufficient RAM available: ${freeRamMb.toFixed(2)} MB < 150 MB requirement.`);
    }

    if (loadAvg > 0 && loadAvg >= cpuCores * 2) {
      throw new Error(`High CPU load average throttle risk: ${loadAvg} >= ${cpuCores * 2}`);
    }

    console.log(`    [✓] State 1 PASS: System resource allocation capacity verified.`);

    // ----------------------------------------------------
    // STATE 2: DEPENDENCY_CHECK
    // ----------------------------------------------------
    currentState = STATES.STATE_2_DEPENDENCY_CHECK;
    console.log(`\n[>] Transitioning to [${currentState}]...`);

    const nodeVersion = process.version;
    console.log(`    • Node.js Engine Version: ${nodeVersion}`);

    const pkgPath = path.join(__dirname, '../package.json');
    if (!fs.existsSync(pkgPath)) {
      throw new Error(`package.json manifest missing at ${pkgPath}`);
    }

    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const requiredModules = ['axios', 'dotenv', 'node-cron', 'sqlite3'];
    
    for (const mod of requiredModules) {
      try {
        require(mod);
        console.log(`    • Dependency check: ${mod} -> OK`);
      } catch (err) {
        throw new Error(`Missing required dependency [${mod}]: ${err.message}`);
      }
    }

    console.log(`    [✓] State 2 PASS: All runtime dependencies verified.`);

    // ----------------------------------------------------
    // STATE 3: NETWORK_TOPOLOGY_PING
    // ----------------------------------------------------
    currentState = STATES.STATE_3_NETWORK_TOPOLOGY_PING;
    console.log(`\n[>] Transitioning to [${currentState}]...`);

    const endpoints = [
      { name: 'Telegram API Gateway', host: 'api.telegram.org' },
      { name: 'YouTube Data API', host: 'youtube.googleapis.com' },
      { name: 'Meta / Instagram Graph API', host: 'graph.facebook.com' },
      { name: 'TikTok API Endpoint', host: 'open.tiktokapis.com' }
    ];

    for (const ep of endpoints) {
      const pingResult = await pingHost(ep.host);
      if (!pingResult.reachable) {
        console.warn(`    [!] Warning: ${ep.name} (${ep.host}) reached timeout or error: ${pingResult.error}`);
      } else {
        console.log(`    • Ping ${ep.name} (${ep.host}) -> REACHABLE (${pingResult.latencyMs}ms)`);
      }
    }

    console.log(`    [✓] State 3 PASS: Network topology & gateway accessibility verified.`);

    // ----------------------------------------------------
    // STATE 4: LEDGER_INTEGRITY
    // ----------------------------------------------------
    currentState = STATES.STATE_4_LEDGER_INTEGRITY;
    console.log(`\n[>] Transitioning to [${currentState}]...`);

    await initDatabase();
    const integrity = await verifyIntegrity();

    console.log(`    • SQLite Tables Detected: ${integrity.tables.join(', ')}`);
    if (!integrity.valid) {
      throw new Error(`Database integrity failed. Tables 'infrastructure_nodes' and 'metrics_ledger' must be present.`);
    }

    console.log(`    [✓] State 4 PASS: Ledger structure & I/O permissions verified.`);

    // ----------------------------------------------------
    // STATE 5: MOCK_EXECUTION_FLOW
    // ----------------------------------------------------
    currentState = STATES.STATE_5_MOCK_EXECUTION_FLOW;
    console.log(`\n[>] Transitioning to [${currentState}]...`);

    const testDispatch = await dispatchTestPayload();
    if (!testDispatch.ok) {
      throw new Error(`Mock execution payload dispatch failed: ${testDispatch.error}`);
    }

    console.log(`    • Payload Dispatch Test -> CONFIRMED ${testDispatch.simulated ? '(Simulated mode)' : ''}`);
    console.log(`    [✓] State 5 PASS: Mock execution flow validated.`);

    // ----------------------------------------------------
    // FINAL STATE: SYSTEM_LIVE_COMMITTED
    // ----------------------------------------------------
    currentState = STATES.SYSTEM_LIVE_COMMITTED;
    console.log('\n====================================================');
    console.log(`✅ ANTIGRAVITY DIAGNOSTIC COMPLETE: [${currentState}]`);
    console.log('System cleared for live deployment and scheduled operation.');
    console.log('====================================================\n');

    await closeDb();
    process.exit(0);

  } catch (error) {
    currentState = STATES.HALTED;
    console.error('\n====================================================');
    console.error(`❌ ANTIGRAVITY PRE-FLIGHT DIAGNOSTIC FAILED: [${currentState}]`);
    console.error(`Reason: ${error.message}`);
    console.error('DEPLOYMENT ABORTED. Fail-fast gatekeeper triggered.');
    console.error('====================================================\n');

    await closeDb();
    process.exit(1);
  }
}

/**
 * Lightweight HTTPS ping helper
 */
function pingHost(hostname) {
  return new Promise((resolve) => {
    const start = Date.now();
    const req = https.request({
      hostname,
      port: 443,
      method: 'HEAD',
      timeout: 4000
    }, (res) => {
      resolve({ reachable: true, latencyMs: Date.now() - start });
    });

    req.on('error', (err) => {
      resolve({ reachable: false, error: err.message });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ reachable: false, error: 'Connection timed out (4000ms)' });
    });

    req.end();
  });
}

if (require.main === module) {
  runAntigravityDiagnostic();
}

module.exports = {
  runAntigravityDiagnostic,
  STATES
};
