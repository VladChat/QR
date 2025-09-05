import { ulid } from 'ulid';
import { hashPin } from './crypto';

export async function getQRFromCacheThenDB(env: Env, slug: string) {
  const cacheKey = `qr:slug:${slug}`;
  const cached = await env.KV.get(cacheKey, 'json');
  if (cached) return cached;

  const qr = await env.DB.prepare(`
    SELECT q.id, q.slug, q.status,
           c.editable_by_public,
           n.title, n.body
    FROM qr_codes q
    LEFT JOIN qr_claims c ON c.qr_id = q.id
    LEFT JOIN qr_notes n ON n.qr_id = q.id
    WHERE q.slug = ? LIMIT 1
  `).bind(slug).first();

  if (qr) await env.KV.put(cacheKey, JSON.stringify(qr), { expirationTtl: 600 });
  return qr;
}

export async function recordScan(env: Env, qrId: string, ip: string) {
  await env.DB.batch([
    env.DB.prepare(`UPDATE qr_codes SET last_scan_at = ? WHERE id = ?`)
      .bind(Date.now(), qrId),
    env.DB.prepare(`INSERT INTO audit_events (id, qr_id, ip, kind, ts)
                    VALUES (?, ?, ?, 'SCAN', ?)`)
      .bind(ulid(), qrId, ip, Date.now())
  ]);
}

export async function beginPendingClaim(env: Env, slug: string) {
  const qr = await env.DB.prepare(`SELECT id, status FROM qr_codes WHERE slug = ?`).bind(slug).first();
  if (!qr) return false;
  if ((qr as any).status === 'active') return true;
  await env.DB.prepare(`UPDATE qr_codes SET status = 'pending' WHERE id = ?`).bind((qr as any).id).run();
  return true;
}

export async function finalizeClaim(env: Env, email: string, slug: string) {
  const now = Date.now();
  const user = await ensureUser(env, email, now);
  const qr = await env.DB.prepare(`SELECT id FROM qr_codes WHERE slug = ?`).bind(slug).first();

  if (!qr) throw new Error('missing slug');

  await env.DB.prepare(`
    INSERT INTO qr_notes (id, qr_id, title, body, updated_at, version)
    SELECT ?, ?, NULL, NULL, ?, 1
    WHERE NOT EXISTS (SELECT 1 FROM qr_notes WHERE qr_id = ?)
  `).bind(ulid(), (qr as any).id, now, (qr as any).id).run();

  await env.DB.prepare(`
    INSERT INTO qr_claims (id, qr_id, user_id, claimed_at, editable_by_public)
    VALUES (?, ?, ?, ?, 0)
    ON CONFLICT(qr_id) DO UPDATE SET user_id = excluded.user_id
  `).bind(ulid(), (qr as any).id, (user as any).id, now).run();

  await env.DB.prepare(`UPDATE qr_codes SET status = 'active' WHERE id = ?`).bind((qr as any).id).run();

  await bumpCache(env, slug);
  return (user as any).id;
}

export async function updateQRAndCache(env: Env, slug: string, { title, body } : { title?: string; body?: string }) {
  const qr = await env.DB.prepare(`SELECT id FROM qr_codes WHERE slug = ?`).bind(slug).first();
  if (!qr) throw new Error('not found');

  const now = Date.now();
  await env.DB.prepare(`
    UPDATE qr_notes SET
      title = COALESCE(?, title),
      body  = COALESCE(?, body),
      updated_at = ?
    WHERE qr_id = ?
  `).bind(title ?? null, body ?? null, now, (qr as any).id).run();
}

export async function bumpCache(env: Env, slug: string) {
  await env.KV.delete(`qr:slug:${slug}`);
  await getQRFromCacheThenDB(env, slug);
}

export async function setOrClearPIN(env: Env, slug: string, pin?: string) {
  const qr = await env.DB.prepare(`SELECT id FROM qr_codes WHERE slug = ?`).bind(slug).first();
  if (!qr) return;
  const pinHash = pin ? await hashPin(pin) : null;
  await env.DB.prepare(`UPDATE qr_claims SET pin_hash = ? WHERE qr_id = ?`).bind(pinHash, (qr as any).id).run();
}

async function ensureUser(env: Env, email: string, now: number) {
  const found = await env.DB.prepare(`SELECT id FROM users WHERE email = ?`).bind(email).first();
  if (found) return found as { id: string };
  const id = ulid();
  await env.DB.prepare(`INSERT INTO users (id, email, created_at) VALUES (?, ?, ?)`)
    .bind(id, email, now).run();
  return { id };
}
