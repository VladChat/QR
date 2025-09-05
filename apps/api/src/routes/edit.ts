import { type Env } from '../index';
import { verifyOwnerOrPin } from '../lib/auth';
import { updateQRAndCache } from '../lib/db';
import { rateLimitEdit } from '../lib/rate';

export default async function edit(req: Request, env: Env) {
  const { slug } = (req as any).params;
  const ip = req.headers.get('CF-Connecting-IP') ?? '0.0.0.0';

  if (!(await rateLimitEdit(env, ip, slug))) {
    return new Response('Too Many Requests', { status: 429 });
  }

  const payload = await req.json().catch(() => ({}));
  const { title, note, pin } = payload || {};

  const auth = await verifyOwnerOrPin(env, req, slug, pin);
  if (!auth.ok) return new Response('Unauthorized', { status: 401 });

  await updateQRAndCache(env, slug, { title, body: note });
  return Response.json({ ok: true });
}
