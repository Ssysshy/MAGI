import crypto from 'node:crypto';
import { env } from '../config/env.js';

const algorithm = 'aes-256-gcm';
// 环境变量可能不是 32 字节，统一哈希成 AES-256 可用密钥。
const key = crypto.createHash('sha256').update(env.API_KEY_ENCRYPTION_SECRET).digest();

export const encryptText = (value: string): string => {
  // 每次加密都生成随机 IV，避免相同 API Key 产生相同密文。
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // 存储格式固定为 iv:authTag:ciphertext，便于解密时做结构校验。
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
};

export const decryptText = (value: string): string => {
  const [ivHex, authTagHex, encryptedHex] = value.split(':');

  // 缺少任一段都说明密文损坏或格式不匹配，直接拒绝解密。
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
