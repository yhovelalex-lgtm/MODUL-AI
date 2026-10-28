// Tabla de rutas de la API: "MÉTODO /ruta" → manejador (Request → Response).
import {register, login, logout, me} from './routes/auth.mjs';
import {list, create, remove} from './routes/projects.mjs';
import {getDb} from './db.mjs';
import {handle, json} from './http.mjs';

const health = handle(async () => { getDb().get('SELECT 1 AS ok'); return json({ok: true, app: 'modul-ai', database: 'conectada'}); });

export const routes = {
  'POST /api/auth/register': register,
  'POST /api/auth/login': login,
  'POST /api/auth/logout': logout,
  'GET /api/auth/me': me,
  'GET /api/projects': list,
  'POST /api/projects': create,
  'DELETE /api/projects': remove,
  'GET /api/health': health
};
