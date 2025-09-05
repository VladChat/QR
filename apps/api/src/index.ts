import { Router } from 'itty-router';
import resolve from './routes/resolve';
import edit from './routes/edit';
import { requestClaim, verifyClaim } from './routes/claim';

export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  APP_BASE_URL: string;
  FRONTEND_BASE_URL: string;
  JWT_ISSUER: string;
  MAGIC_TOKEN_TTL_MIN: string;
  SESSION_TTL_HOURS: string;
  POSTMARK_TOKEN?: string;
  RESEND_API_KEY?: string;
  COOKIE_SECRET: string;
  TURNSTILE_SECRET?: string;
}

const router = Router();

router.get('/s/:slug', resolve);
router.post('/qr/:slug/edit', edit);

router.post('/claim/request', requestClaim);
router.get('/claim/verify', verifyClaim);

router.all('*', () => new Response('Not found', { status: 404 }));

export default {
  fetch: (req: Request, env: Env, ctx: ExecutionContext) => router.handle(req, env, ctx)
};
