import crypto from 'node:crypto';

const deriveKey = (secret) => (
  crypto.createHash('sha256').update(secret).digest()
);

const toBase64Url = (buffer) => buffer.toString('base64url');
const fromBase64Url = (value) => Buffer.from(value, 'base64url');

export const encryptText = (plainText, secret) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(secret), iv);

  const encrypted = Buffer.concat([
    cipher.update(String(plainText ?? ''), 'utf8'),
    cipher.final()
  ]);

  const authTag = cipher.getAuthTag();

  return [
    toBase64Url(iv),
    toBase64Url(encrypted),
    toBase64Url(authTag)
  ].join('.');
};

export const decryptText = (cipherText, secret) => {
  try {
    const [ivValue, encryptedValue, authTagValue] = String(cipherText ?? '').split('.');

    if (!ivValue || !encryptedValue || !authTagValue) return '';

    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      deriveKey(secret),
      fromBase64Url(ivValue)
    );

    decipher.setAuthTag(fromBase64Url(authTagValue));

    const decrypted = Buffer.concat([
      decipher.update(fromBase64Url(encryptedValue)),
      decipher.final()
    ]);

    return decrypted.toString('utf8');
  } catch {
    return '';
  }
};