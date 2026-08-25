import crypto from 'crypto';

const keySource = process.env.APP_ENCRYPTION_KEY || '';
const production = process.env.NODE_ENV === 'production';

function getKey(): Buffer {
  if (!keySource && production) throw new Error('APP_ENCRYPTION_KEY é obrigatória em produção.');
  return crypto.createHash('sha256').update(keySource || 'mecanica-local-development-key').digest();
}

export function encryptSecret(value: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `v1:${iv.toString('base64url')}:${cipher.getAuthTag().toString('base64url')}:${ciphertext.toString('base64url')}`;
}

export function decryptSecret(value: string): string {
  const [version, ivEncoded, tagEncoded, ciphertextEncoded] = String(value || '').split(':');
  if (version !== 'v1' || !ivEncoded || !tagEncoded || !ciphertextEncoded) throw new Error('Segredo criptografado inválido.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivEncoded, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagEncoded, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextEncoded, 'base64url')), decipher.final()]).toString('utf8');
}
