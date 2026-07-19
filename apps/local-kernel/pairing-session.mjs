import { createHash, randomInt, timingSafeEqual } from 'node:crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export class PairingError extends Error {
  constructor(code, status) {
    super(code);
    this.name = 'PairingError';
    this.code = code;
    this.status = status;
  }
}

export class PairingSession {
  constructor(apiToken, options = {}) {
    this.apiToken = apiToken;
    this.code = options.code ?? generateCode();
    this.codeHash = digest(normalizeCode(this.code));
    this.expiresAt = options.expiresAt ?? Date.now() + 5 * 60_000;
    this.now = options.now ?? Date.now;
    this.maximumAttempts = options.maximumAttempts ?? 5;
    this.attempts = 0;
    this.used = false;
  }

  consume(value) {
    if (this.used) throw new PairingError('PAIRING_ALREADY_USED', 410);
    if (this.now() >= this.expiresAt) throw new PairingError('PAIRING_EXPIRED', 410);
    if (this.attempts >= this.maximumAttempts) throw new PairingError('PAIRING_LOCKED', 429);
    this.attempts += 1;
    const suppliedHash = digest(normalizeCode(value));
    if (!timingSafeEqual(suppliedHash, this.codeHash)) {
      if (this.attempts >= this.maximumAttempts) throw new PairingError('PAIRING_LOCKED', 429);
      throw new PairingError('PAIRING_INVALID', 401);
    }
    this.used = true;
    return { apiToken: this.apiToken };
  }

  details() {
    return { code: this.code, expiresAt: new Date(this.expiresAt).toISOString() };
  }
}

function generateCode() {
  return Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
}

function normalizeCode(value) {
  return typeof value === 'string' ? value.toUpperCase().replace(/[\s-]/g, '') : '';
}

function digest(value) {
  return createHash('sha256').update(value).digest();
}
