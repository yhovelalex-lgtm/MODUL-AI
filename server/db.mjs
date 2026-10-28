// MODUL-AI | Base de datos SQLite en un archivo (data/modul.db). Las tablas se crean solas.
// Funciona con Node ≥ 22.13 (node:sqlite) y con Bun / el ejecutable (bun:sqlite).
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {DATA_DIR} from './paths.mjs';

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  failed_logins  INTEGER NOT NULL DEFAULT 0,
  locked_until   INTEGER,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  INTEGER NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE TABLE IF NOT EXISTS projects (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  schema_version  TEXT NOT NULL,
  data            TEXT NOT NULL,
  area_m2         REAL,
  selected        TEXT NOT NULL DEFAULT 'A',
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS projects_user_created_idx ON projects(user_id, created_at DESC);
`;

let db = null;

async function openDatabase(file) {
  if (typeof Bun !== 'undefined') {
    const {Database} = await import('bun' + ':sqlite');
    return new Database(file, {create: true});
  }
  const {DatabaseSync} = await import('node' + ':sqlite');
  return new DatabaseSync(file);
}

export async function initDb(file = process.env.DB_FILE || join(DATA_DIR, 'modul.db')) {
  if (db) return db;
  if (file !== ':memory:') mkdirSync(join(file, '..'), {recursive: true});
  const raw = await openDatabase(file);
  raw.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  raw.exec(SCHEMA_SQL);
  const stmt = sql => raw.prepare(sql);
  db = {
    file,
    all: (sql, ...p) => stmt(sql).all(...p),
    get: (sql, ...p) => stmt(sql).get(...p) ?? null,
    run: (sql, ...p) => { const r = stmt(sql).run(...p); return {changes: Number(r.changes), lastInsertRowid: Number(r.lastInsertRowid)}; },
    close: () => { raw.close(); db = null; }
  };
  return db;
}

export function getDb() {
  if (!db) throw new Error('La base de datos no está inicializada.');
  return db;
}
