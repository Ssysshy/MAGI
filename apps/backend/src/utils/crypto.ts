import crypto from 'node:crypto';
import { env } from '../config/env.js';

const algorithm = 'aes-256-gcm';
const key = crypto.createHash('sha256').update(env.API_KEY_ENCRYPTION_SECRET).digest();

export const encryptText = (value: string): string => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
};

export const decryptText = (value: string): string => {
  const [ivHex, authTagHex, encryptedHex] = value.split(':');

  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new Error('INVALID_ENCRYPTED_VALUE');
  }

  const decipher = crypto.createDecipheriv(algorithm, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, 'hex')),
    decipher.final(),
  ]).toString('utf8');
};
