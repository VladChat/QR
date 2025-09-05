import { type Env } from '../index';
import { getQRFromCacheThenDB, recordScan } from '../lib/db';
import { rateLimitScan } from '../lib/rate';

export default async function resolve(req: Request, env: Env) {
  const { slug } = (req as any).params;
  const ip = req.headers.get('CF-Connecting-IP') ?? '0.0.0.0';

  if (!(await rateLimitScan(env, ip))) {
    return new Response('Too Many Requests', { status: 429 });
  }

  const data = await getQRFromCacheThenDB(env, slug);
  if (!data) return new Response('Not Found', { status: 404 });

  await recordScan(env, data.id, ip);

  // HTML fallback
  if (req.headers.get('accept')?.includes('text/html')) {
    const claim = data.status !== 'active'
      ? `<a href="${env.FRONTEND_BASE_URL}/claim.html?slug=${slug}">Claim this code</a>`
      : '';
    return new Response(
      `<!doctype html><meta charset="utf-8"><h1>${data.title ?? 'QR'}</h1><p>${data.body ?? ''}</p>${claim}`,
      { headers: { 'content-type': 'text/html; charset=utf-8' } }
    );
  }

  return Response.json({
    slug,
    status: data.status,
    title: data.title ?? null,
    body: data.body ?? null,
    editableByPublic: !!data.editable_by_public
  });
}
