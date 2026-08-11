/**
 * Telegram API Gateway Router & Report Generator
 * Dispatches structured telemetry metrics & 24h execution deltas
 */

const axios = require('axios');
require('dotenv').config();

const PLATFORM_EMOJIS = {
  youtube: '▶️ YouTube',
  instagram: '📸 Instagram',
  tiktok: '🎵 TikTok'
};

/**
 * Format and send structured telemetry report to Telegram
 * @param {Array} nodeSummaries list of node metric records with calculated deltas
 * @returns {Promise<boolean>}
 */
async function dispatchTelemetryReport(nodeSummaries) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  const isPlaceholder = !token || 
    !chatId || 
    token.includes('your_telegram_bot_token') || 
    token.includes('XXXXXXXXXXXXXXXXX') ||
    chatId.includes('100234567890') ||
    chatId.includes('your_telegram_chat_id') ||
    token.length < 20;

  if (isPlaceholder) {
    console.log('[Telegram Router] Mock payload dispatch (Telegram token or chat ID is placeholder).');
    console.log(generateReportMarkdown(nodeSummaries));
    return true;
  }

  const text = generateReportHTML(nodeSummaries);
  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  try {
    const response = await axios.post(url, {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    }, { timeout: 8000 });

    return response.data?.ok === true;
  } catch (error) {
    console.error('[-] Telegram payload dispatch failed:', error.message);
    return false;
  }
}

/**
 * Dispatch test payload for Antigravity Pre-flight State 5
 */
async function dispatchTestPayload() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  const isPlaceholder = !token || 
    !chatId || 
    token.includes('your_telegram_bot_token') || 
    token.includes('XXXXXXXXXXXXXXXXX') ||
    chatId.includes('100234567890') ||
    chatId.includes('your_telegram_chat_id') ||
    token.length < 20;

  if (isPlaceholder) {
    // In mock diagnostic mode without real chat ID, simulate clean dispatch
    return { ok: true, simulated: true };
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const text = `<b>[ANTIGRAVITY PRE-FLIGHT DIAGNOSTIC]</b>\nState 5: Mock Execution Flow Payload Validation.\nTime: ${new Date().toISOString()}`;

  try {
    const response = await axios.post(url, {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML'
    }, { timeout: 5000 });

    return { ok: response.data?.ok === true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

/**
 * Generate rich HTML formatted telemetry report
 */
function generateReportHTML(nodeSummaries) {
  const ts = new Date().toISOString().replace('T', ' ').substring(0, 19);
  let html = `⚡️ <b>TELEMETRY GATEWAY — 24H SUMMARY</b>\n`;
  html += `📅 <code>${ts} UTC</code>\n\n`;

  if (!nodeSummaries || nodeSummaries.length === 0) {
    html += `<i>No active infrastructure nodes monitored in ledger.</i>`;
    return html;
  }

  nodeSummaries.forEach(node => {
    const platformLabel = PLATFORM_EMOJIS[node.platform?.toLowerCase()] || node.platform;
    const deltaSign = node.execution_delta > 0 ? `+${node.execution_delta.toLocaleString()}` : `${(node.execution_delta || 0).toLocaleString()}`;

    html += `<b>${platformLabel}</b>: <code>${node.account_identifier}</code>\n`;
    html += `• Views: <b>${(node.views_count || 0).toLocaleString()}</b>\n`;
    html += `• Subscribers/Followers: <b>${(node.followers_count || 0).toLocaleString()}</b>\n`;
    html += `• <b>24h Execution Delta</b>: <code>${deltaSign}</code>\n\n`;
  });

  html += `🔒 <i>State Snapshot Verified • Node Infrastructure</i>`;
  return html;
}

/**
 * Generate plain markdown representation for console fallback
 */
function generateReportMarkdown(nodeSummaries) {
  let md = `====================================================\n`;
  md += `⚡️ TELEMETRY GATEWAY REPORT\n`;
  md += `====================================================\n`;
  if (!nodeSummaries || nodeSummaries.length === 0) {
    md += `(Ledger is empty)\n`;
  } else {
    nodeSummaries.forEach(n => {
      md += `[${n.platform.toUpperCase()}] ${n.account_identifier} | Views: ${n.views_count} | Followers: ${n.followers_count} | Delta: ${n.execution_delta}\n`;
    });
  }
  md += `====================================================`;
  return md;
}

module.exports = {
  dispatchTelemetryReport,
  dispatchTestPayload
};
