/**
 * OpSec Encryption Module for FURY-Telemetry-Gateway
 * Standard: AES-256-GCM
 * Note: Zero-logging policy. Plaintext tokens & decryption keys are NEVER logged.
 */

const crypto = require('crypto');
require('dotenv').config();

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard GCM IV length

function getSecretKey() {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) {
    throw new Error('[OpSec Error] ENCRYPTION_SECRET is not configured in environment variables.');
  }

  // Derive exact 32-byte key from ENCRYPTION_SECRET (hex or string)
  if (secret.length === 64 && /^[0-9a-fA-F]+$/.test(secret)) {
    return Buffer.from(secret, 'hex');
  }
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypt plaintext string to format: iv:authTag:encryptedHex
 * @param {string} text 
 * @returns {string} encrypted cipher string
 */
function encrypt(text) {
  if (!text) return '';
  const key = getSecretKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt cipher string back to plaintext
 * @param {string} cipherText 
 * @returns {string} decrypted string
 */
function decrypt(cipherText) {
  if (!cipherText) return '';
  const parts = cipherText.split(':');
  if (parts.length !== 3) {
    throw new Error('[OpSec Error] Invalid encrypted text payload format.');
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const key = getSecretKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

module.exports = {
  encrypt,
  decrypt
};
