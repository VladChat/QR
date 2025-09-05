const SCAN_LIMIT_PER_MIN = 60;
const EDIT_LIMIT_PER_MIN = 10;

export async function rateLimitScan(env: Env, ip: string) {
  return tokenBucket(env, `rl:scan:${ip}`, SCAN_LIMIT_PER_MIN, 60);
}

export async function rateLimitEdit(env: Env, ip: string, slug: string) {
  return tokenBucket(env, `rl:edit:${ip}:${slug}`, EDIT_LIMIT_PER_MIN, 60);
}

async function tokenBucket(env: Env, key: string, capacity: number, windowSec: number) {
  const now = Date.now();
  const rec = (await env.KV.get(key, 'json')) as any || { tokens: capacity, ts: now };
  const elapsed = (now - rec.ts) / 1000;
  const refill = Math.floor((elapsed / windowSec) * capacity);
  const tokens = Math.min(capacity, rec.tokens + Math.max(0, refill)) - 1;
  if (tokens < 0) return false;
  await env.KV.put(key, JSON.stringify({ tokens, ts: now }), { expirationTtl: windowSec * 2 });
  return true;
}
