// MODUL-AI | Utilidades HTTP (Request/Response estándar).
import {getSessionUser} from './auth.mjs';

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function json(data, status = 200, extraHeaders = {}) {
  const headers = new Headers({'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store'});
  for (const [k, v] of Object.entries(extraHeaders)) headers.append(k, v);
  return new Response(JSON.stringify(data), {status, headers});
}

const MAX_BODY = 512 * 1024;
export async function readJson(request) {
  const text = await request.text();
  if (text.length > MAX_BODY) throw new HttpError(413, 'El proyecto es demasiado grande.');
  try { return text ? JSON.parse(text) : {}; } catch { throw new HttpError(400, 'JSON no válido.'); }
}

// Protección CSRF: las peticiones que modifican datos deben venir del mismo sitio.
export function assertSameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return;
  let originHost = '';
  try { originHost = new URL(origin).host; } catch { /* inválido */ }
  if (originHost !== new URL(request.url).host) throw new HttpError(403, 'Origen no permitido.');
}

export function requireUser(request) {
  const user = getSessionUser(request);
  if (!user) throw new HttpError(401, 'Inicia sesión para continuar.');
  return user;
}

export function handle(fn, {mutates = false} = {}) {
  return async request => {
    try {
      if (mutates) assertSameOrigin(request);
      return await fn(request);
    } catch (err) {
      if (err instanceof HttpError) return json({error: err.message}, err.status);
      console.error('[api]', err);
      return json({error: 'Error interno del servidor. Inténtalo de nuevo.'}, 500);
    }
  };
}
