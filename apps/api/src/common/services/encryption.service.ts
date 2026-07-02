import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

/**
 * Reusable encryption service for sensitive fields using AES-256-GCM.
 * Derives the encryption key from the ENCRYPTION_KEY environment variable.
 */
@Injectable()
export class EncryptionService {
  private readonly key: Buffer;

  constructor() {
    const envKey = process.env['ENCRYPTION_KEY'] ?? 'default-dev-key-change-in-production!!';
    this.key = scryptSync(envKey, 'wardkeep-salt', 32);
  }

  /**
   * Encrypts a plaintext string using AES-256-GCM.
   * @param plaintext - The string to encrypt
   * @returns Base64-encoded ciphertext (iv + authTag + encrypted data)
   */
  encrypt(plaintext: string): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]).toString('base64');
  }

  /**
   * Decrypts a base64-encoded ciphertext previously encrypted with this service.
   * @param ciphertext - The base64-encoded encrypted string
   * @returns The original plaintext string
   */
  decrypt(ciphertext: string): string {
    const buffer = Buffer.from(ciphertext, 'base64');
    const iv = buffer.subarray(0, 16);
    const authTag = buffer.subarray(16, 32);
    const encrypted = buffer.subarray(32);
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf-8');
  }
}
