// Ubicación de la app: junto al .exe si está compilado, o la raíz del proyecto con Node.
import {dirname, basename, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export const IS_EXE = !/^(node|bun)(\.exe)?$/i.test(basename(process.execPath));
export const ROOT = IS_EXE ? dirname(process.execPath) : resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const PUBLIC_DIR = join(ROOT, 'public');
export const DATA_DIR = process.env.DATA_DIR ? resolve(process.env.DATA_DIR) : join(ROOT, 'data');
