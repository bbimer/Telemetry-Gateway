/**
 * FURY-Telemetry-Gateway Microservice Entry Point
 */

const http = require('http');
const { initDatabase, getLedgerSummary24h, verifyIntegrity } = require('./database');
const { runTelemetryCycle } = require('./scheduler');
require('dotenv').config();

const PORT = process.env.PORT || 4000;

async function bootstrap() {
  console.log('====================================================');
  console.log('⚡️ STARTING TELEMETRY-GATEWAY MICROSERVICE');
  console.log('====================================================');

  // Initialize SQLite database schema
  await initDatabase();
  console.log('[+] SQLite Ledger Engine initialized.');

  // HTTP Health & Status Endpoint
  const server = http.createServer(async (req, res) => {
    if (req.url === '/health' || req.url === '/') {
      try {
        const integrity = await verifyIntegrity();
        const summaries = await getLedgerSummary24h();

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          service: 'Telemetry-Gateway',
          status: 'ONLINE',
          timestamp: new Date().toISOString(),
          database: integrity,
          activeNodesMonitored: summaries.length
        }, null, 2));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    } else if (req.url === '/trigger-telemetry' && req.method === 'POST') {
      runTelemetryCycle()
        .then(() => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'TELEMETRY_CYCLE_EXECUTED' }));
        })
        .catch(err => {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        });
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    }
  });

  server.listen(PORT, () => {
    console.log(`[+] Telemetry Gateway active on port ${PORT}`);
    console.log(`[+] Worker scheduler operational (08:00 & 20:00 UTC)`);
    console.log('====================================================\n');
  });
}

bootstrap().catch(err => {
  console.error('[-] Bootstrap error:', err);
  process.exit(1);
});
