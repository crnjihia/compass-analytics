import { describe, it, expect } from 'vitest';
import { encryptCredential, decryptCredential, hashMsisdn } from '../crypto';

describe('Security & Cryptography Utilities', () => {
  it('encrypts and decrypts credentials using AES-256-GCM', () => {
    const secret = 'bfb279f9aa9bdbaca158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c91';
    const encrypted = encryptCredential(secret);

    expect(encrypted).not.toBe(secret);
    expect(typeof encrypted).toBe('string');

    const decrypted = decryptCredential(encrypted);
    expect(decrypted).toBe(secret);
  });

  it('hashes MSISDN deterministically per tenant salt', () => {
    const phone = '254712345678';
    const hash1 = hashMsisdn(phone, 'org_a_salt');
    const hash2 = hashMsisdn(phone, 'org_a_salt');
    const hashOtherOrg = hashMsisdn(phone, 'org_b_salt');

    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hashOtherOrg);
    expect(hash1).toHaveLength(64); // SHA-256 hex string length
  });
});
