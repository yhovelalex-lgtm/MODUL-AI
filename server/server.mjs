// MODUL-AI | Servidor web: interfaz + API + base SQLite. Funciona en tu PC y en cualquier VPS.
//   node server/server.mjs            → http://localhost:3000
//   node server/server.mjs --open     → además abre el navegador
//   Variables: PORT (3000), HOST (127.0.0.1; usa 0.0.0.0 en un VPS sin proxy), DATA_DIR (./data)
import {createServer} from 'node:http';
import {readFile, stat} from 'node:fs/promises';
import {join, extname, normalize, sep} from 'node:path';
import {exec} from 'node:child_process';
import {PUBLIC_DIR, IS_EXE} from './paths.mjs';
import {initDb} from './db.mjs';
import {routes} from './routes.mjs';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png',
  '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.webp': 'image/webp', '.woff2': 'font/woff2'
};
const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'x-frame-options': 'DENY',
  'content-security-policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'"
};

function requestUrl(req) {
  const https = req.socket.encrypted || String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
  return new URL(req.url, `${https ? 'https' : 'http'}://${req.headers.host || 'localhost'}`);
}

async function handleApi(req, res, url) {
  const handler = routes[req.method + ' ' + url.pathname.replace(/\/$/, '')];
  let response;
  if (!handler) {
    const known = Object.keys(routes).some(k => k.endsWith(' ' + url.pathname.replace(/\/$/, '')));
    response = Response.json({error: known ? 'Método no permitido.' : 'Ruta no encontrada.'}, {status: known ? 405 : 404});
  } else {
    const chunks = [];
    let size = 0;
    for await (const c of req) { size += c.length; if (size > 1024 * 1024) { res.writeHead(413); return res.end(); } chunks.push(c); }
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(', ') : v);
    const body = ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks);
    response = await handler(new Request(url, {method: req.method, headers, body}));
  }
  const out = {};
  response.headers.forEach((v, k) => { if (k !== 'set-cookie') out[k] = v; });
  const cookies = response.headers.getSetCookie ? response.headers.getSetCookie() : [];
  if (cookies.length) out['set-cookie'] = cookies;
  res.writeHead(response.status, out);
  res.end(Buffer.from(await response.arrayBuffer()));
}

async function handleStatic(req, res, url) {
  let path;
  try { path = decodeURIComponent(url.pathname); } catch { path = '/'; }
  if (path === '/' || path === '') path = '/index.html';
  if (!extname(path)) path += '.html';
  const file = normalize(join(PUBLIC_DIR, path));
  const info = file.startsWith(PUBLIC_DIR + sep) ? await stat(file).catch(() => null) : null;
  if (!info?.isFile()) {
    res.writeHead(404, {'content-type': TYPES['.html']});
    return res.end(await readFile(join(PUBLIC_DIR, '404.html')));
  }
  res.writeHead(200, {
    'content-type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream',
    'cache-control': file.includes(sep + 'vendor' + sep) ? 'public, max-age=604800' : 'no-cache'
  });
  if (req.method === 'HEAD') return res.end();
  res.end(await readFile(file));
}

export function createApp() {
  return createServer(async (req, res) => {
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
    try {
      const url = requestUrl(req);
      if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
      if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
      return await handleStatic(req, res, url);
    } catch (err) {
      console.error(err);
      if (!res.headersSent) res.writeHead(500, {'content-type': 'text/plain; charset=utf-8'});
      res.end('Error interno');
    }
  });
}

function openBrowser(url) {
  const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd, err => { if (err) console.log('Abre manualmente: ' + url); });
}

async function alreadyRunning(port) {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/health`, {signal: AbortSignal.timeout(1500)});
    return (await r.json()).app === 'modul-ai';
  } catch { return false; }
}

async function main() {
  const db = await initDb();
  const host = process.env.HOST || '127.0.0.1';
  const fixedPort = !!process.env.PORT;
  let port = Number(process.env.PORT || 3000);
  const shouldOpen = IS_EXE || process.argv.includes('--open');
  const server = createApp();

  for (let attempt = 0; ; attempt++) {
    try {
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => { server.off('error', reject); resolve(); });
      });
      break;
    } catch (err) {
      if (err.code !== 'EADDRINUSE') throw err;
      if (shouldOpen && await alreadyRunning(port)) {
        console.log('MODUL-AI ya estaba abierto. Abriendo el navegador…');
        openBrowser(`http://localhost:${port}/`);
        setTimeout(() => process.exit(0), 1500);
        return;
      }
      if (fixedPort || attempt >= 10) throw new Error(`El puerto ${port} está ocupado. Usa otra variable PORT.`);
      port++;
    }
  }

  const shown = host === '0.0.0.0' || host === '::' ? 'localhost' : host === '127.0.0.1' ? 'localhost' : host;
  const url = `http://${shown}:${port}/`;
  console.log('');
  console.log('  ▦ MODUL-AI está funcionando');
  console.log('    Abre: ' + url);
  console.log('    Base de datos: ' + db.file);
  console.log(IS_EXE ? '    No cierres esta ventana mientras uses la aplicación.' : '    Ctrl+C para detener.');
  console.log('');
  if (shouldOpen) openBrowser(url);

  const stop = () => { server.close(); try { db.close(); } catch { /* ya cerrada */ } process.exit(0); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch(err => {
  console.error('\nNo se pudo iniciar MODUL-AI: ' + err.message);
  if (IS_EXE) setTimeout(() => process.exit(1), 15000); else process.exit(1);
});
