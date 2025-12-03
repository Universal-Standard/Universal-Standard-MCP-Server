const crypto = require('crypto');
const logger = require('./logger');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

let encryptionKeyCache = null;

function getEncryptionKey() {
  if (encryptionKeyCache) {
    return encryptionKeyCache;
  }
  
  const key = process.env.ENCRYPTION_KEY;
  
  if (!key || key.length < 32) {
    const generatedKey = crypto.randomBytes(32);
    logger.warn('ENCRYPTION_KEY not set or too short. Using session-only random key. Set ENCRYPTION_KEY env var for persistent encryption.');
    encryptionKeyCache = generatedKey;
    return generatedKey;
  }
  
  if (key.length === 64 && /^[0-9a-fA-F]+$/.test(key)) {
    encryptionKeyCache = Buffer.from(key, 'hex');
    return encryptionKeyCache;
  }
  
  encryptionKeyCache = crypto.createHash('sha256').update(key).digest();
  return encryptionKeyCache;
}

function validateEncryptionSetup() {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length < 32) {
    return {
      valid: false,
      warning: 'ENCRYPTION_KEY should be at least 32 characters for production use'
    };
  }
  return { valid: true };
}

function encrypt(plaintext) {
  if (!plaintext) return null;
  
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (error) {
    logger.error('Encryption failed', { error: error.message });
    throw new Error('Failed to encrypt data');
  }
}

function decrypt(encryptedData) {
  if (!encryptedData) return null;
  
  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      return encryptedData;
    }
    
    const [ivHex, authTagHex, encrypted] = parts;
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    logger.warn('Decryption failed, returning original value');
    return encryptedData;
  }
}

function hashApiKey(apiKey) {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

function generateApiKey() {
  const prefix = 'spurs_';
  const randomPart = crypto.randomBytes(24).toString('base64url');
  return `${prefix}${randomPart}`;
}

function getKeyPrefix(apiKey) {
  return apiKey.substring(0, 12);
}

function secureCompare(a, b) {
  if (!a || !b) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

module.exports = {
  encrypt,
  decrypt,
  hashApiKey,
  generateApiKey,
  getKeyPrefix,
  secureCompare,
  validateEncryptionSetup
};
