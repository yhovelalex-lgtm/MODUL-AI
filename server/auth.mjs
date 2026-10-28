// MODUL-AI | Cuentas propias: contraseñas con scrypt y sesiones en cookie HttpOnly.
import {randomBytes, scrypt as scryptCb, timingSafeEqual, createHash} from 'node:crypto';
import {promisify} from 'node:util';
import {getDb} from './db.mjs';

const scrypt = promisify(scryptCb);
const N = 16384, R = 8, P = 1, KEYLEN = 64;
export const SESSION_COOKIE = 'modul_session';
export const SESSION_DAYS = 30;
export const MAX_FAILED = 5, LOCK_MINUTES = 15;

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, KEYLEN, {N, r: R, p: P});
  return ['scrypt', N, R, P, salt.toString('base64url'), Buffer.from(hash).toString('base64url')].join('$');
}

export async function verifyPassword(password, stored) {
  const [alg, n, r, p, saltB64, hashB64] = String(stored).split('$');
  if (alg !== 'scrypt') return false;
  const expected = Buffer.from(hashB64, 'base64url');
  const actual = Buffer.from(await scrypt(password, Buffer.from(saltB64, 'base64url'), expected.length, {N: +n, r: +r, p: +p}));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

const sha256 = s => createHash('sha256').update(s).digest('hex');

export function normalizeEmail(raw) {
  const email = String(raw || '').trim().toLowerCase();
  if (email.length < 5 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export function validatePassword(raw) {
  const password = String(raw || '');
  if (password.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
  if (password.length > 200) return 'La contraseña es demasiado larga.';
  return null;
}

export function createSession(userId) {
  const token = randomBytes(32).toString('base64url');
  const db = getDb();
  db.run('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)', sha256(token), userId, Date.now() + SESSION_DAYS * 86400e3);
  if (Math.random() < 0.1) db.run('DELETE FROM sessions WHERE expires_at < ?', Date.now());
  return token;
}

export function destroySession(token) {
  if (token) getDb().run('DELETE FROM sessions WHERE token_hash = ?', sha256(token));
}

export function readCookie(request, name = SESSION_COOKIE) {
  const header = request.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) {
      try { return decodeURIComponent(part.slice(i + 1).trim()); } catch { return null; }
    }
  }
  return null;
}

// «Secure» solo cuando la conexión es HTTPS (en local con http://localhost no hace falta).
const secureFlag = request => (new URL(request.url).protocol === 'https:' ? '; Secure' : '');
export function sessionCookie(request, token) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secureFlag(request)}`;
}
export const clearCookie = request => `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureFlag(request)}`;

export function getSessionUser(request) {
  const token = readCookie(request);
  if (!token || token.length > 100) return null;
  return getDb().get(
    `SELECT u.id, u.email FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ?`,
    sha256(token), Date.now()
  );
}
