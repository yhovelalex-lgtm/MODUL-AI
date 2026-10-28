// Pruebas de la API con una base SQLite temporal (no toca data/modul.db).
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {generateAlternatives} from '../public/dist/modul-core.mjs';
import {initDb} from '../server/db.mjs';
import {routes} from '../server/routes.mjs';

const BASE = 'https://modul.test';
const R = routes;
const register = {POST: R['POST /api/auth/register']}, login = {POST: R['POST /api/auth/login']}, logout = {POST: R['POST /api/auth/logout']};
const me = {GET: R['GET /api/auth/me']}, health = {GET: R['GET /api/health']};
const projects = {GET: R['GET /api/projects'], POST: R['POST /api/projects'], DELETE: R['DELETE /api/projects']};

function req(path, {method = 'GET', body, cookie, origin = BASE} = {}) {
  const headers = {host: 'modul.test'};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (cookie) headers.cookie = cookie;
  if (origin && method !== 'GET') headers.origin = origin;
  return new Request(BASE + path, {method, headers, body: body === undefined ? undefined : JSON.stringify(body)});
}
const cookieOf = res => (res.headers.get('set-cookie') || '').split(';')[0];
const project = () => {
  const input = {name: 'Casa de prueba', width: 12, depth: 15, module: 3, bedrooms: 2, bathrooms: 1};
  const {alternatives} = generateAlternatives(input, {seed: 934, tries: 60});
  return {input, alternatives, active: 'B', revision: 3};
};

test('API con SQLite', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'modul-'));
  const db = await initDb(join(dir, 'prueba.db'));

  await t.test('health responde', async () => {
    const res = await health.GET(req('/api/health'));
    assert.equal(res.status, 200);
  });

  let ana, beto;
  await t.test('registro valida y crea sesión', async () => {
    assert.equal((await register.POST(req('/api/auth/register', {method: 'POST', body: {email: 'mal', password: '12345678'}}))).status, 400);
    assert.equal((await register.POST(req('/api/auth/register', {method: 'POST', body: {email: 'ana@x.pe', password: 'corta'}}))).status, 400);
    const res = await register.POST(req('/api/auth/register', {method: 'POST', body: {email: 'Ana@X.pe', password: 'clave-segura-1'}}));
    assert.equal(res.status, 201);
    ana = cookieOf(res);
    assert.match(res.headers.get('set-cookie'), /HttpOnly/);
    assert.match(res.headers.get('set-cookie'), /Secure/);
    assert.equal((await register.POST(req('/api/auth/register', {method: 'POST', body: {email: 'ana@x.pe', password: 'otra-clave-1'}}))).status, 409);
    const who = await (await me.GET(req('/api/auth/me', {cookie: ana}))).json();
    assert.equal(who.user.email, 'ana@x.pe');
  });

  await t.test('bloquea peticiones de otro origen', async () => {
    const res = await register.POST(req('/api/auth/register', {method: 'POST', origin: 'https://malicioso.com', body: {email: 'z@x.pe', password: 'clave-segura-1'}}));
    assert.equal(res.status, 403);
  });

  await t.test('login correcto e incorrecto', async () => {
    assert.equal((await login.POST(req('/api/auth/login', {method: 'POST', body: {email: 'ana@x.pe', password: 'incorrecta'}}))).status, 401);
    assert.equal((await login.POST(req('/api/auth/login', {method: 'POST', body: {email: 'nadie@x.pe', password: 'incorrecta'}}))).status, 401);
    const ok = await login.POST(req('/api/auth/login', {method: 'POST', body: {email: 'ana@x.pe', password: 'clave-segura-1'}}));
    assert.equal(ok.status, 200);
    const reg = await register.POST(req('/api/auth/register', {method: 'POST', body: {email: 'beto@x.pe', password: 'clave-segura-2'}}));
    beto = cookieOf(reg);
  });

  await t.test('bloqueo tras 5 intentos fallidos', async () => {
    await register.POST(req('/api/auth/register', {method: 'POST', body: {email: 'caro@x.pe', password: 'clave-segura-3'}}));
    for (let i = 0; i < 5; i++) await login.POST(req('/api/auth/login', {method: 'POST', body: {email: 'caro@x.pe', password: 'mala-' + i}}));
    const res = await login.POST(req('/api/auth/login', {method: 'POST', body: {email: 'caro@x.pe', password: 'clave-segura-3'}}));
    assert.equal(res.status, 429);
  });

  let id;
  await t.test('guardar, listar y restaurar proyecto', async () => {
    assert.equal((await projects.POST(req('/api/projects', {method: 'POST', body: {data: project()}}))).status, 401);
    const bad = project(); bad.alternatives.A[0].x = 999;
    assert.equal((await projects.POST(req('/api/projects', {method: 'POST', cookie: ana, body: {data: bad}}))).status, 400);
    const res = await projects.POST(req('/api/projects', {method: 'POST', cookie: ana, body: {data: project()}}));
    assert.equal(res.status, 201);
    id = (await res.json()).project.id;
    const list = await (await projects.GET(req('/api/projects', {cookie: ana}))).json();
    assert.equal(list.projects.length, 1);
    assert.equal(list.projects[0].name, 'Casa de prueba');
    const full = await (await projects.GET(req('/api/projects?id=' + id, {cookie: ana}))).json();
    assert.equal(full.project.data.active, 'B');
    assert.deepEqual(full.project.data.alternatives.A, project().alternatives.A.map(r => ({...r, locked: !!r.locked})));
  });

  await t.test('aislamiento entre usuarios', async () => {
    assert.equal((await projects.GET(req('/api/projects?id=' + id, {cookie: beto}))).status, 404);
    assert.equal((await projects.DELETE(req('/api/projects?id=' + id, {method: 'DELETE', cookie: beto}))).status, 404);
    const list = await (await projects.GET(req('/api/projects', {cookie: beto}))).json();
    assert.equal(list.projects.length, 0);
    assert.equal((await projects.GET(req('/api/projects?id=abc', {cookie: ana}))).status, 400);
  });

  await t.test('borrar y cerrar sesión', async () => {
    assert.equal((await projects.DELETE(req('/api/projects?id=' + id, {method: 'DELETE', cookie: ana}))).status, 200);
    assert.equal((await logout.POST(req('/api/auth/logout', {method: 'POST', cookie: ana}))).status, 200);
    const who = await (await me.GET(req('/api/auth/me', {cookie: ana}))).json();
    assert.equal(who.user, null);
  });

  await t.test('cookie sin Secure en http y con Secure en https', async () => {
    const res = await register.POST(new Request('http://localhost:3000/api/auth/register', {method: 'POST', headers: {'content-type': 'application/json', origin: 'http://localhost:3000'}, body: JSON.stringify({email: 'local@x.pe', password: 'clave-segura-9'})}));
    assert.equal(res.status, 201);
    assert.doesNotMatch(res.headers.get('set-cookie'), /Secure/);
  });

  db.close();
  rmSync(dir, {recursive: true, force: true});
});
