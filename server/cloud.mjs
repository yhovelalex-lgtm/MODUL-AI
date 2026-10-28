import {createClient} from '@supabase/supabase-js';
import {validateProjectState} from '../public/dist/modul-core.mjs';

const TABLE = 'modul_studio_projects';
const URL = 'https://ntnraylysccypmpmrzvs.supabase.co';
const KEY = 'sb_publishable_Jj75vcJ8kIZMt5tm3Ldsag_HE3tD3uv';
const MAX_BODY = 512 * 1024;
class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const publicUser = u => u ? {id: u.id, email: u.email} : null;
const cookies = request => Object.fromEntries((request.headers.get('cookie') || '').split(';').map(part => {
  const i = part.indexOf('=');
  return i < 0 ? ['', ''] : [part.slice(0, i).trim(), part.slice(i + 1).trim()];
}));
function sessionCookies(headers, session) {
  for (const [name, value] of [['modul_access', session?.access_token], ['modul_refresh', session?.refresh_token]]) {
    headers.append('set-cookie', `${name}=${value || ''}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${value ? 2592000 : 0}`);
  }
}
async function bodyOf(request) {
  const reader = request.body?.getReader();
  if (!reader) return {};
  const chunks = []; let size = 0;
  while (true) {
    const {done, value} = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY) { await reader.cancel(); throw new ApiError(413, 'El proyecto es demasiado grande.'); }
    chunks.push(Buffer.from(value));
  }
  try { return JSON.parse(Buffer.concat(chunks).toString() || '{}'); }
  catch { throw new ApiError(400, 'JSON no válido.'); }
}
function authError(error) {
  if (!error) return;
  const messages = {
    invalid_credentials: 'Correo o contraseña incorrectos.',
    email_not_confirmed: 'Confirma tu correo electrónico antes de entrar.',
    user_already_exists: 'Ya existe una cuenta con ese correo. Usa «Entrar».',
    over_email_send_rate_limit: 'Espera unos minutos antes de solicitar otro correo.',
    email_address_not_authorized: 'El servicio de correo aún no permite este destinatario. Contacta al administrador.',
    signup_disabled: 'El registro de cuentas está deshabilitado.',
    weak_password: 'Usa una contraseña más segura, de al menos 8 caracteres.'
  };
  throw new ApiError(error.status === 429 ? 429 : 400, messages[error.code] || 'No se pudo iniciar sesión o crear la cuenta. Revisa tus datos e inténtalo de nuevo.');
}
function dbResult(result) {
  if (result.error) throw new ApiError(503, 'No se pudo acceder a tus proyectos. Inténtalo de nuevo.');
  return result.data;
}

export function createCloudHandler(clientFactory = () => createClient(process.env.SUPABASE_URL || URL, process.env.SUPABASE_PUBLISHABLE_KEY || KEY, {
  auth: {persistSession: false, autoRefreshToken: false, detectSessionInUrl: false}
})) {
  return async request => {
    const headers = new Headers({'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store', 'vary': 'Cookie'});
    const reply = (data, status = 200) => new Response(JSON.stringify(data), {status, headers});
    try {
      const url = new globalThis.URL(request.url), path = url.pathname.replace(/\/$/, '');
      const method = request.method;
      if (!['GET', 'HEAD'].includes(method)) {
        if (request.headers.get('origin') !== url.origin) throw new ApiError(403, 'Origen no permitido.');
        if (method !== 'DELETE' && !request.headers.get('content-type')?.startsWith('application/json')) throw new ApiError(415, 'Se requiere JSON.');
      }
      const known = {'/api/health': ['GET'], '/api/auth/register': ['POST'], '/api/auth/login': ['POST'], '/api/auth/logout': ['POST'], '/api/auth/me': ['GET'], '/api/projects': ['GET', 'POST', 'DELETE']};
      if (!known[path]) throw new ApiError(404, 'Ruta no encontrada.');
      if (!known[path].includes(method)) throw new ApiError(405, 'Método no permitido.');
      const client = clientFactory();
      if (path === '/api/health') return reply({ok: true, app: 'modul-ai', storage: 'supabase'});
      if (path === '/api/auth/register' || path === '/api/auth/login') {
        const body = await bodyOf(request);
        const email = String(body.email || '').trim().toLowerCase(), password = String(body.password || '');
        if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8 || password.length > 200) throw new ApiError(400, 'Escribe un correo válido y una contraseña de 8 a 200 caracteres.');
        const register = path.endsWith('/register');
        const {data, error} = register ? await client.auth.signUp({email, password}) : await client.auth.signInWithPassword({email, password});
        authError(error);
        if (!data.session) return reply({user: null, confirmationRequired: true}, 202);
        sessionCookies(headers, data.session);
        return reply({user: publicUser(data.user)}, register ? 201 : 200);
      }
      const saved = cookies(request);
      let user = null;
      if (saved.modul_access && saved.modul_refresh && saved.modul_access.length < 4096 && saved.modul_refresh.length < 1024) {
        const {data, error} = await client.auth.setSession({access_token: saved.modul_access, refresh_token: saved.modul_refresh});
        if (!error && data.session) {
          // setSession verifies the access token with Auth, or refreshes an expired session.
          user = data.user;
          sessionCookies(headers, data.session);
        } else sessionCookies(headers, null);
      }
      if (path === '/api/auth/me') return reply({user: publicUser(user)});
      if (path === '/api/auth/logout') {
        if (user) authError((await client.auth.signOut({scope: 'local'})).error);
        sessionCookies(headers, null);
        return reply({ok: true});
      }
      if (!user) throw new ApiError(401, 'Inicia sesión para continuar.');
      const id = url.searchParams.get('id');
      if (id !== null && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new ApiError(400, 'Identificador de proyecto no válido.');
      const fields = 'id,name,area_m2,selected,created_at';
      if (method === 'GET') {
        if (id) {
          const row = dbResult(await client.from(TABLE).select(fields + ',schema_version,data').eq('owner_id', user.id).eq('id', id).maybeSingle());
          if (!row) throw new ApiError(404, 'Proyecto no encontrado.');
          return reply({project: row});
        }
        return reply({projects: dbResult(await client.from(TABLE).select(fields).eq('owner_id', user.id).order('created_at', {ascending: false}).limit(50))});
      }
      if (method === 'DELETE') {
        if (!id) throw new ApiError(400, 'Falta el identificador del proyecto.');
        const rows = dbResult(await client.from(TABLE).delete().eq('owner_id', user.id).eq('id', id).select('id'));
        if (!rows.length) throw new ApiError(404, 'Proyecto no encontrado.');
        return reply({ok: true});
      }
      const body = await bodyOf(request);
      let verified;
      try { verified = validateProjectState(body.data); }
      catch { throw new ApiError(400, 'Proyecto no válido. Genera las alternativas antes de guardar.'); }
      const {input, alternatives, active, revision} = verified;
      const area = alternatives[active].reduce((sum, r) => sum + r.w * r.d, 0);
      const count = await client.from(TABLE).select('id', {count: 'exact', head: true}).eq('owner_id', user.id);
      dbResult(count);
      if (count.count >= 200) throw new ApiError(409, 'Límite de 200 proyectos alcanzado. Borra alguno antes de guardar.');
      const row = dbResult(await client.from(TABLE).insert({owner_id: user.id, name: input.name, data: {input, alternatives, active, revision}, selected: active, area_m2: Math.round(area * 100) / 100}).select(fields).single());
      return reply({project: row}, 201);
    } catch (error) {
      return reply({error: error instanceof ApiError ? error.message : 'Servicio temporalmente no disponible. Inténtalo de nuevo.'}, error.status || 503);
    }
  };
}

export const cloudHandler = createCloudHandler();
