/**
 * Development CLI Seeder for Telemetry-Gateway
 * Command: npm run db:seed:mock
 * Note: Enforces NODE_ENV=development check. Will refuse to seed production ledgers.
 */

require('dotenv').config();
const { initDatabase, addNode, insertMetricsSnapshot, closeDb } = require('./database');

async function seedDevelopmentData() {
  const env = process.env.NODE_ENV || 'development';
  if (env.toLowerCase() === 'production') {
    console.error('[!] ABORT: Mock seeding is strictly prohibited in PRODUCTION (NODE_ENV=production). Ledger integrity preserved.');
    process.exit(1);
  }

  console.log('[+] Initializing database schema for development seeding...');
  await initDatabase();

  const mockNodes = [
    {
      id: 'node-yt-01',
      platform: 'youtube',
      account_identifier: 'UC_SYSTEM_NODE_01',
      raw_token: 'mock_yt_auth_token_secret_123',
      initialViews: 1450000,
      initialFollowers: 89000
    },
    {
      id: 'node-ig-01',
      platform: 'instagram',
      account_identifier: 'official_node_ig',
      raw_token: 'mock_ig_graph_token_secret_456',
      initialViews: 620000,
      initialFollowers: 45200
    },
    {
      id: 'node-tt-01',
      platform: 'tiktok',
      account_identifier: '@nullspread_tech',
      raw_token: 'mock_tt_session_secret_789',
      initialViews: 3200000,
      initialFollowers: 128500
    }
  ];

  console.log('[+] Seeding mock infrastructure nodes & baseline snapshots...');

  for (const node of mockNodes) {
    await addNode({
      id: node.id,
      platform: node.platform,
      account_identifier: node.account_identifier,
      raw_token: node.raw_token,
      status: 1
    });

    const baselineTs = new Date(Date.now() - 24 * 3600 * 1000).toISOString(); // 24 hours ago
    await insertMetricsSnapshot({
      node_id: node.id,
      timestamp: baselineTs,
      views_count: node.initialViews,
      followers_count: node.initialFollowers,
      execution_delta: 0
    });

    console.log(`  [✓] Seeded ${node.platform.toUpperCase()} node: ${node.account_identifier}`);
  }

  console.log('[+] Development mock seeding complete.');
  await closeDb();
}

seedDevelopmentData().catch(err => {
  console.error('[-] Seeding error:', err);
  process.exit(1);
});
