import { type Env } from '../index';
import { json } from 'itty-router';
import { beginPendingClaim, finalizeClaim } from '../lib/db';
import { createMagicToken, readMagicToken, setOwnerSession } from '../lib/auth';
import { sendLoginLink } from '../lib/mailer';

export async function requestClaim(req: Request, env: Env) {
  const { email, slug } = await req.json();
  if (!email || !slug) return new Response('Bad Request', { status: 400 });

  const ok = await beginPendingClaim(env, slug);
  if (!ok) return new Response('Not Found', { status: 404 });

  const token = await createMagicToken(env, { email, slug });
  const link = `${env.APP_BASE_URL}/claim/verify?token=${encodeURIComponent(token)}`;

  await sendLoginLink(env, email, link);
  return json({ ok: true });
}

export async function verifyClaim(req: Request, env: Env) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token') || '';
  const data = await readMagicToken(env, token);
  if (!data) return new Response('Invalid or expired', { status: 400 });

  const userId = await finalizeClaim(env, data.email, data.slug);

  const res = new Response(null, {
    status: 302,
    headers: { Location: `${env.FRONTEND_BASE_URL}/edit.html?slug=${data.slug}` }
  });
  await setOwnerSession(env, res, userId);
  return res;
}
