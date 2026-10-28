import {getDb} from '../db.mjs';
import {hashPassword, verifyPassword, normalizeEmail, validatePassword, createSession, destroySession,
  readCookie, sessionCookie, clearCookie, getSessionUser, MAX_FAILED, LOCK_MINUTES} from '../auth.mjs';
import {handle, json, readJson, HttpError} from '../http.mjs';

const WRONG = 'Correo o contraseña incorrectos.';

export const register = handle(async request => {
  const body = await readJson(request);
  const email = normalizeEmail(body.email);
  if (!email) throw new HttpError(400, 'Escribe un correo electrónico válido.');
  const problem = validatePassword(body.password);
  if (problem) throw new HttpError(400, problem);
  const passwordHash = await hashPassword(String(body.password));
  const db = getDb();
  const {changes, lastInsertRowid} = db.run('INSERT OR IGNORE INTO users (email, password_hash) VALUES (?, ?)', email, passwordHash);
  if (!changes) throw new HttpError(409, 'Ya existe una cuenta con ese correo. Usa «Entrar».');
  const token = createSession(lastInsertRowid);
  return json({user: {id: lastInsertRowid, email}}, 201, {'set-cookie': sessionCookie(request, token)});
}, {mutates: true});

export const login = handle(async request => {
  const body = await readJson(request);
  const email = normalizeEmail(body.email);
  const password = String(body.password || '');
  if (!email || !password || password.length > 200) throw new HttpError(400, WRONG);
  const db = getDb();
  const user = db.get('SELECT id, email, password_hash, failed_logins, locked_until FROM users WHERE email = ?', email);
  if (!user) { await hashPassword(password); throw new HttpError(401, WRONG); } // mismo tiempo de respuesta
  if (user.locked_until && user.locked_until > Date.now()) {
    throw new HttpError(429, `Demasiados intentos. Espera ${LOCK_MINUTES} minutos e inténtalo de nuevo.`);
  }
  if (!(await verifyPassword(password, user.password_hash))) {
    const failed = user.failed_logins + 1;
    if (failed >= MAX_FAILED) db.run('UPDATE users SET failed_logins = 0, locked_until = ? WHERE id = ?', Date.now() + LOCK_MINUTES * 60e3, user.id);
    else db.run('UPDATE users SET failed_logins = ? WHERE id = ?', failed, user.id);
    throw new HttpError(401, WRONG);
  }
  db.run('UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = ?', user.id);
  const token = createSession(user.id);
  return json({user: {id: user.id, email: user.email}}, 200, {'set-cookie': sessionCookie(request, token)});
}, {mutates: true});

export const logout = handle(async request => {
  destroySession(readCookie(request));
  return json({ok: true}, 200, {'set-cookie': clearCookie(request)});
}, {mutates: true});

export const me = handle(async request => json({user: getSessionUser(request)}));
