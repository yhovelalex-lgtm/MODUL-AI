import {getDb} from '../db.mjs';
import {handle, json, readJson, requireUser, HttpError} from '../http.mjs';
import {validateProjectState} from '../../public/dist/modul-core.mjs';

const MAX_PROJECTS = 200;
const SCHEMA_VERSION = '0.4';

function projectId(request) {
  const raw = new URL(request.url).searchParams.get('id');
  if (raw === null) return null;
  if (!/^\d{1,15}$/.test(raw)) throw new HttpError(400, 'Identificador de proyecto no válido.');
  return Number(raw);
}

// GET /api/projects → lista · GET /api/projects?id=N → proyecto completo
export const list = handle(async request => {
  const user = requireUser(request);
  const id = projectId(request);
  const db = getDb();
  if (id !== null) {
    const row = db.get('SELECT id, name, schema_version, data, area_m2, selected, created_at FROM projects WHERE id = ? AND user_id = ?', id, user.id);
    if (!row) throw new HttpError(404, 'Proyecto no encontrado.');
    return json({project: {...row, data: JSON.parse(row.data)}});
  }
  const rows = db.all('SELECT id, name, area_m2, selected, created_at FROM projects WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 50', user.id);
  return json({projects: rows});
});

// POST /api/projects  {data:{input, alternatives, active, revision}}
export const create = handle(async request => {
  const user = requireUser(request);
  const body = await readJson(request);
  let verified;
  try { verified = validateProjectState(body.data); }
  catch (err) { throw new HttpError(400, 'Proyecto no válido: ' + err.message); }
  const {name, width, depth, module, bedrooms, bathrooms} = verified.input;
  const data = {input: {name, width, depth, module, bedrooms, bathrooms}, alternatives: verified.alternatives, active: verified.active, revision: verified.revision};
  const area = verified.alternatives[verified.active].reduce((sum, r) => sum + r.w * r.d, 0);
  const db = getDb();
  if (db.get('SELECT count(*) AS n FROM projects WHERE user_id = ?', user.id).n >= MAX_PROJECTS) {
    throw new HttpError(409, `Límite de ${MAX_PROJECTS} proyectos alcanzado. Borra alguno antes de guardar.`);
  }
  const {lastInsertRowid} = db.run(
    'INSERT INTO projects (user_id, name, schema_version, data, area_m2, selected) VALUES (?, ?, ?, ?, ?, ?)',
    user.id, name, SCHEMA_VERSION, JSON.stringify(data), Math.round(area * 100) / 100, verified.active
  );
  return json({project: db.get('SELECT id, name, area_m2, selected, created_at FROM projects WHERE id = ?', lastInsertRowid)}, 201);
}, {mutates: true});

// DELETE /api/projects?id=N
export const remove = handle(async request => {
  const user = requireUser(request);
  const id = projectId(request);
  if (id === null) throw new HttpError(400, 'Falta el identificador del proyecto.');
  const {changes} = getDb().run('DELETE FROM projects WHERE id = ? AND user_id = ?', id, user.id);
  if (!changes) throw new HttpError(404, 'Proyecto no encontrado.');
  return json({ok: true});
}, {mutates: true});
