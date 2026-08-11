/**
 * Worker / Scheduler (Dispatcher) Module
 * Triggers telemetry collection cycles twice daily (08:00, 20:00 UTC)
 * Can be run in single execution mode with CLI flag: --once
 */

const cron = require('node-cron');
const { 
  initDatabase, 
  getActiveNodes, 
  getLatestSnapshotForNode, 
  insertMetricsSnapshot, 
  getLedgerSummary24h,
  closeDb 
} = require('./database');
const { fetchNodeMetrics } = require('./aggregator');
const { dispatchTelemetryReport } = require('./telegramRouter');
require('dotenv').config();

async function runTelemetryCycle() {
  console.log(`\n[+] [${new Date().toISOString()}] Initiating Telemetry Execution Cycle...`);
  
  await initDatabase();
  const activeNodes = await getActiveNodes();

  if (activeNodes.length === 0) {
    console.log('[!] No active infrastructure nodes found in database ledger.');
    console.log('[!] Production ledger is sterile. Add active nodes to table infrastructure_nodes to start collection.');
    return;
  }

  console.log(`[+] Processing ${activeNodes.length} active node(s)...`);

  for (const node of activeNodes) {
    try {
      const prevSnapshot = await getLatestSnapshotForNode(node.id);
      const currentMetrics = await fetchNodeMetrics(node);

      let delta = 0;
      if (prevSnapshot && prevSnapshot.views_count !== undefined) {
        delta = currentMetrics.views_count - prevSnapshot.views_count;
        if (delta < 0) delta = 0; // Guard against metric resets
      }

      await insertMetricsSnapshot({
        node_id: node.id,
        timestamp: new Date().toISOString(),
        views_count: currentMetrics.views_count,
        followers_count: currentMetrics.followers_count,
        execution_delta: delta
      });

      console.log(`  [✓] Node ${node.account_identifier} (${node.platform}): Views = ${currentMetrics.views_count}, Delta = +${delta}`);
    } catch (err) {
      console.error(`  [-] Error processing node ${node.account_identifier}:`, err.message);
    }
  }

  console.log('[+] Calculating 24h execution deltas & dispatching report...');
  const summaries = await getLedgerSummary24h();
  await dispatchTelemetryReport(summaries);
  console.log('[+] Telemetry execution cycle finished successfully.');
}

// Check CLI arguments for --once
const isSingleRun = process.argv.includes('--once');

if (isSingleRun) {
  runTelemetryCycle()
    .then(async () => {
      await closeDb();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('[-] Single telemetry run failed:', err);
      await closeDb();
      process.exit(1);
    });
} else {
  console.log('[+] Starting Telemetry Worker Scheduler (Cron: 08:00 & 20:00 UTC)...');
  // Run once on worker startup
  runTelemetryCycle();

  // Schedule twice daily (08:00 and 20:00)
  cron.schedule('0 8,20 * * *', () => {
    runTelemetryCycle().catch(err => console.error('[-] Scheduled telemetry cycle error:', err));
  });
}

module.exports = {
  runTelemetryCycle
};
