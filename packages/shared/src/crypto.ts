import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Encrypt plaintext using AES-256-GCM with an env-supplied 32-byte key.
 * Output format: base64(iv + authTag + ciphertext)
 */
export function encryptCredential(plaintext: string, hexKey?: string): string {
  const rawKey = hexKey || process.env.AES_256_GCM_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const key = Buffer.from(rawKey, 'hex');
  if (key.length !== 32) {
    throw new Error(`AES-256-GCM key must be 32 bytes (64 hex characters), got ${key.length} bytes`);
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString('base64');
}

/**
 * Decrypt base64-encoded AES-256-GCM ciphertext.
 */
export function decryptCredential(encryptedBase64: string, hexKey?: string): string {
  const rawKey = hexKey || process.env.AES_256_GCM_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const key = Buffer.from(rawKey, 'hex');
  if (key.length !== 32) {
    throw new Error(`AES-256-GCM key must be 32 bytes (64 hex characters), got ${key.length} bytes`);
  }

  const combined = Buffer.from(encryptedBase64, 'base64');
  if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('Ciphertext too short');
  }

  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

/**
 * Hash MSISDN using HMAC-SHA256 with per-org salt or system salt secret.
 * Raw MSISDN numbers are NEVER stored directly in analytics tables.
 */
export function hashMsisdn(msisdn: string, salt: string): string {
  return crypto.createHmac('sha256', salt).update(msisdn.trim()).digest('hex');
}
