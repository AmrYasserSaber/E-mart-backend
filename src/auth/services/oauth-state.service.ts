import { Injectable, BadRequestException } from '@nestjs/common';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { env } from '../../config/env';

export interface OAuthStatePayload {
  readonly nonce: string;
  readonly iat: number;
  readonly returnUrl: string | null;
}

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

function toBase64Url(value: string): string {
  return Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromBase64Url(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (padded.length % 4)) % 4;
  const withPad = padded + '='.repeat(padLength);
  return Buffer.from(withPad, 'base64').toString('utf8');
}

function signState(serializedPayload: string): string {
  return createHmac('sha256', env.OAUTH_STATE_SECRET)
    .update(serializedPayload, 'utf8')
    .digest('hex');
}

function isSafeRelativeReturnUrl(returnUrl: string): boolean {
  const trimmed = returnUrl.trim();
  if (!trimmed.startsWith('/')) return false;
  if (trimmed.startsWith('//')) return false;
  if (trimmed.includes('\\')) return false;
  return true;
}

@Injectable()
export class OAuthStateService {
  executeCreateState(returnUrlRaw: string | undefined): string {
    const returnUrl = returnUrlRaw ? returnUrlRaw.trim() : '';
    const safeReturnUrl =
      returnUrl && isSafeRelativeReturnUrl(returnUrl) ? returnUrl : null;
    const payload: OAuthStatePayload = {
      nonce: randomBytes(16).toString('base64url'),
      iat: Date.now(),
      returnUrl: safeReturnUrl,
    };
    const serializedPayload = JSON.stringify(payload);
    const payloadB64 = toBase64Url(serializedPayload);
    const sig = signState(payloadB64);
    return `${payloadB64}.${sig}`;
  }

  executeVerifyState(state: string | undefined): OAuthStatePayload {
    if (!state) {
      throw new BadRequestException('Missing OAuth state.');
    }
    const parts = state.split('.');
    if (parts.length !== 2) {
      throw new BadRequestException('Invalid OAuth state.');
    }
    const [payloadB64, sig] = parts;
    const expectedSig = signState(payloadB64);
    const bufA = Buffer.from(sig, 'hex');
    const bufB = Buffer.from(expectedSig, 'hex');
    if (bufA.length !== bufB.length || !timingSafeEqual(bufA, bufB)) {
      throw new BadRequestException('Invalid OAuth state.');
    }
    const raw = fromBase64Url(payloadB64);
    let payload: OAuthStatePayload;
    try {
      payload = JSON.parse(raw) as OAuthStatePayload;
    } catch {
      throw new BadRequestException('Invalid OAuth state.');
    }
    if (
      typeof payload.iat !== 'number' ||
      Date.now() - payload.iat > OAUTH_STATE_TTL_MS
    ) {
      throw new BadRequestException('Expired OAuth state.');
    }
    return payload;
  }
}
