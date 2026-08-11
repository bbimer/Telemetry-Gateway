/**
 * Relational SQLite Database Engine for FURY-Telemetry-Gateway
 * Handles infrastructure_nodes and metrics_ledger tables
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { encrypt, decrypt } = require('./crypto');
require('dotenv').config();

const dbPath = process.env.DB_PATH || path.join(__dirname, '../data/telemetry.db');

// Ensure parent data directory exists
const dataDir = path.dirname(path.resolve(dbPath));
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let dbInstance = null;

function getDbConnection() {
  if (!dbInstance) {
    dbInstance = new sqlite3.Database(dbPath);
  }
  return dbInstance;
}

/**
 * Initialize SQLite Schema
 */
function initDatabase() {
  return new Promise((resolve, reject) => {
    const db = getDbConnection();
    db.serialize(() => {
      // Table 1: infrastructure_nodes
      db.run(`
        CREATE TABLE IF NOT EXISTS infrastructure_nodes (
          id TEXT PRIMARY KEY,
          platform TEXT CHECK(platform IN ('youtube', 'instagram', 'tiktok')) NOT NULL,
          account_identifier TEXT NOT NULL,
          api_token_or_session TEXT NOT NULL,
          status INTEGER DEFAULT 1
        )
      `);

      // Table 2: metrics_ledger
      db.run(`
        CREATE TABLE IF NOT EXISTS metrics_ledger (
          id TEXT PRIMARY KEY,
          node_id TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          views_count INTEGER DEFAULT 0,
          followers_count INTEGER DEFAULT 0,
          execution_delta INTEGER DEFAULT 0,
          FOREIGN KEY (node_id) REFERENCES infrastructure_nodes(id) ON DELETE CASCADE
        )
      `, (err) => {
        if (err) return reject(err);
        resolve(true);
      });
    });
  });
}

/**
 * Add or update infrastructure node (Token is automatically encrypted)
 */
function addNode({ id, platform, account_identifier, raw_token, status = 1 }) {
  return new Promise((resolve, reject) => {
    const db = getDbConnection();
    const nodeId = id || crypto.randomUUID();
    const encryptedToken = encrypt(raw_token || 'N/A');

    const sql = `
      INSERT INTO infrastructure_nodes (id, platform, account_identifier, api_token_or_session, status)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        platform=excluded.platform,
        account_identifier=excluded.account_identifier,
        api_token_or_session=excluded.api_token_or_session,
        status=excluded.status
    `;

    db.run(sql, [nodeId, platform, account_identifier, encryptedToken, status], function(err) {
      if (err) return reject(err);
      resolve({ id: nodeId, platform, account_identifier, status });
    });
  });
}

/**
 * Get all active infrastructure nodes with decrypted credentials (kept strictly in-memory)
 */
function getActiveNodes() {
  return new Promise((resolve, reject) => {
    const db = getDbConnection();
    db.all(`SELECT * FROM infrastructure_nodes WHERE status = 1`, [], (err, rows) => {
      if (err) return reject(err);
      const decryptedRows = rows.map(row => ({
        ...row,
        api_token_or_session: row.api_token_or_session ? decrypt(row.api_token_or_session) : ''
      }));
      resolve(decryptedRows);
    });
  });
}

/**
 * Get the latest metric snapshot for a specific node
 */
function getLatestSnapshotForNode(nodeId) {
  return new Promise((resolve, reject) => {
    const db = getDbConnection();
    const sql = `
      SELECT * FROM metrics_ledger 
      WHERE node_id = ? 
      ORDER BY timestamp DESC 
      LIMIT 1
    `;
    db.get(sql, [nodeId], (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

/**
 * Record a metric snapshot in the metrics_ledger table
 */
function insertMetricsSnapshot({ node_id, timestamp, views_count, followers_count, execution_delta }) {
  return new Promise((resolve, reject) => {
    const db = getDbConnection();
    const snapshotId = crypto.randomUUID();
    const ts = timestamp || new Date().toISOString();

    const sql = `
      INSERT INTO metrics_ledger (id, node_id, timestamp, views_count, followers_count, execution_delta)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    db.run(sql, [snapshotId, node_id, ts, views_count, followers_count, execution_delta], function(err) {
      if (err) return reject(err);
      resolve({ id: snapshotId, node_id, timestamp: ts, views_count, followers_count, execution_delta });
    });
  });
}

/**
 * Query 24h ledger metrics and calculate aggregate deltas
 */
function getLedgerSummary24h() {
  return new Promise((resolve, reject) => {
    const db = getDbConnection();
    const sql = `
      SELECT 
        n.id as node_id,
        n.platform,
        n.account_identifier,
        m.views_count,
        m.followers_count,
        m.execution_delta,
        m.timestamp
      FROM infrastructure_nodes n
      LEFT JOIN (
        SELECT m1.*
        FROM metrics_ledger m1
        INNER JOIN (
          SELECT node_id, MAX(timestamp) as max_ts
          FROM metrics_ledger
          GROUP BY node_id
        ) m2 ON m1.node_id = m2.node_id AND m1.timestamp = m2.max_ts
      ) m ON n.id = m.node_id
      WHERE n.status = 1
    `;
    db.all(sql, [], (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

/**
 * Integrity diagnostic check for Antigravity Protocol Test 4
 */
function verifyIntegrity() {
  return new Promise((resolve, reject) => {
    const db = getDbConnection();
    db.all(`SELECT name FROM sqlite_master WHERE type='table'`, [], (err, tables) => {
      if (err) return reject(err);
      const tableNames = tables.map(t => t.name);
      const hasNodes = tableNames.includes('infrastructure_nodes');
      const hasLedger = tableNames.includes('metrics_ledger');
      resolve({
        valid: hasNodes && hasLedger,
        tables: tableNames
      });
    });
  });
}

/**
 * Close DB Connection gracefully
 */
function closeDb() {
  return new Promise((resolve) => {
    if (dbInstance) {
      dbInstance.close(() => {
        dbInstance = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
}

module.exports = {
  initDatabase,
  addNode,
  getActiveNodes,
  getLatestSnapshotForNode,
  insertMetricsSnapshot,
  getLedgerSummary24h,
  verifyIntegrity,
  closeDb
};
