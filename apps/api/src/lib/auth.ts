import { SignJWT, jwtVerify } from 'jose';
import { ulid } from 'ulid';
import { verifyPinHash } from './crypto';

const cookieName = 'qr_session';

export async function createMagicToken(env: Env, payload: { email: string; slug: string }) {
  const secret = new TextEncoder().encode(env.COOKIE_SECRET);
  const ttlMin = parseInt(env.MAGIC_TOKEN_TTL_MIN || '20', 10);
  const exp = Math.floor(Date.now() / 1000) + ttlMin * 60;

  return await new SignJWT(payload as any)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(env.JWT_ISSUER)
    .setJti(ulid())
    .setExpirationTime(exp)
    .sign(secret);
}

export async function readMagicToken(env: Env, token: string) {
  try {
    const secret = new TextEncoder().encode(env.COOKIE_SECRET);
    const { payload } = await jwtVerify(token, secret, { issuer: env.JWT_ISSUER });
    return payload as any as { email: string; slug: string };
  } catch {
    return null;
  }
}

export async function setOwnerSession(env: Env, res: Response, userId: string) {
  const secret = new TextEncoder().encode(env.COOKIE_SECRET);
  const ttlH = parseInt(env.SESSION_TTL_HOURS || '12', 10);
  const exp = Math.floor(Date.now() / 1000) + ttlH * 3600;

  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(env.JWT_ISSUER)
    .setExpirationTime(exp)
    .sign(secret);

  const cookie = `${cookieName}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${ttlH*3600}`;
  res.headers.append('Set-Cookie', cookie);
}

export async function readSession(env: Env, req: Request) {
  const cookie = req.headers.get('cookie') || '';
  const match = cookie.match(new RegExp(`${cookieName}=([^;]+)`));
  if (!match) return null;
  try {
    const secret = new TextEncoder().encode(env.COOKIE_SECRET);
    const { payload } = await jwtVerify(match[1], secret, { issuer: env.JWT_ISSUER });
    return payload as any as { sub: string };
  } catch {
    return null;
  }
}

export async function verifyOwnerOrPin(env: Env, req: Request, slug: string, pin?: string) {
  const session = await readSession(env, req);

  if (session) {
    const row = await env.DB.prepare(`
      SELECT q.id FROM qr_codes q
      JOIN qr_claims c ON c.qr_id = q.id
      WHERE q.slug = ? AND c.user_id = ?
    `).bind(slug, (session as any).sub).first();
    if (row) return { ok: true };
  }

  if (pin) {
    const row = await env.DB.prepare(`
      SELECT c.pin_hash FROM qr_codes q
      JOIN qr_claims c ON c.qr_id = q.id
      WHERE q.slug = ? LIMIT 1
    `).bind(slug).first() as { pin_hash?: string } | null;

    if (row?.pin_hash && await verifyPinHash(row.pin_hash, pin)) {
      return { ok: true };
    }
  }

  const pub = await env.DB.prepare(`
    SELECT c.editable_by_public FROM qr_codes q
    JOIN qr_claims c ON c.qr_id = q.id
    WHERE q.slug = ? LIMIT 1
  `).bind(slug).first() as { editable_by_public?: number } | null;

  if (pub?.editable_by_public) return { ok: true };

  return { ok: false };
}
