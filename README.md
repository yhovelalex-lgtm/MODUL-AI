# MODUL-AI · Estudio modular 2D + 3D

Editor generativo de viviendas modulares: genera 3 alternativas, edita ambientes en el plano 2D, explóralos en 3D y guarda tus proyectos en tu propia cuenta.

Funciona **en tu PC** (doble clic) y en **cualquier VPS** (Node o Docker). En modo local usa SQLite y Three.js incluido, sin servicios externos. La publicación en Vercel usa Supabase Auth y una tabla con aislamiento por propietario para el guardado en línea. Las cuentas y datos locales permanecen en tu PC y no se suben a GitHub.

## Qué incluye
- **Generador por franjas:** zona social al frente, pasillo y zona privada atrás (o pasillo central en lotes angostos), con medidas reales por ambiente. Tres alternativas distintas: Equilibrio, Privacidad y Servicios.
- **Plano técnico 2D:** muros con su espesor, puertas con su barrido, ventanas, cotas del lote, calle e ingreso. Se edita arrastrando (con vista previa en verde o rojo) o con las flechas del teclado. Deshacer y rehacer con Ctrl+Z y Ctrl+Y.
- **Modelo 3D tipo maqueta:** muros sin duplicar con vanos reales, pisos de madera y cerámica, mobiliario de referencia, techo, corte a 1,20 m, despiece animado y vistas de perspectiva, planta y fachada.
- **Despiece conceptual:** metros de muro exterior e interior, puertas, ventanas y losas, exportable a CSV.
- **Exportar:** plano SVG, imagen PNG del 3D, despiece CSV y proyecto JSON (se puede volver a abrir).

## 1. Abrir en tu PC (Windows)

1. Doble clic en **`MODUL-AI.exe`**.
2. Se abre una ventana negra (el servidor) y tu navegador en `http://localhost:3000`.
3. **No cierres la ventana negra** mientras uses la app; ciérrala para apagarla.

- Si Windows muestra «Windows protegió su PC», pulsa **Más información → Ejecutar de todas formas** (el ejecutable no está firmado digitalmente).
- Si haces doble clic con la app ya abierta, solo abre otra pestaña.
- Alternativa con Node.js 22.13+ instalado: doble clic en **`INICIAR-CON-NODE.bat`**.

El `.exe` debe quedarse en la misma carpeta que `public/`. Tus datos se guardan en `data/modul.db`.

## 2. Publicar en un VPS

### Opción A · Docker (recomendada)
```bash
docker build -t modul-ai .
docker run -d --name modul-ai -p 3000:3000 -v modul-data:/app/data --restart unless-stopped modul-ai
```

### Opción B · Node.js 22.13+ con pm2
```bash
npm run check && npm test
HOST=127.0.0.1 PORT=3000 pm2 start "npm start" --name modul-ai
pm2 save
```

### HTTPS con Nginx (delante de A o B)
```nginx
server {
  server_name tudominio.com;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```
Luego `sudo certbot --nginx -d tudominio.com`. Con HTTPS, la cookie de sesión se marca como `Secure` automáticamente.

### Variables de entorno
| Variable | Por defecto | Uso |
|---|---|---|
| `PORT` | `3000` | Puerto del servidor |
| `HOST` | `127.0.0.1` | Usa `0.0.0.0` solo si expones el puerto sin Nginx |
| `DATA_DIR` | `./data` | Carpeta de la base SQLite |

### Copias de seguridad
Toda la información está en `data/modul.db` (más `modul.db-wal` mientras corre). Para respaldar: detén la app y copia la carpeta `data/`, o usa `sqlite3 data/modul.db ".backup respaldo.db"` en caliente.

## 3. Desarrollo
```bash
npm start          # servidor en http://localhost:3000
npm run open       # igual, y abre el navegador
npm test           # motor + API (usa una base temporal)
npm run exe        # genera MODUL-AI.exe para Windows (requiere internet la primera vez)
npm run exe:linux  # ejecutable para Linux
```
No hay dependencias que instalar (`npm install` no es necesario).

## Estructura
- `public/` — interfaz: `index.html`, estilos en `public/css/`, tipografía Archivo en `public/fonts/`, módulos en `public/dist/` y Three.js en `public/vendor/`.
- `public/dist/modul-core.mjs` — motor generativo (también valida los proyectos en el servidor).
- `public/dist/modul-plan.mjs` — análisis constructivo: muros, puertas, ventanas y despiece.
- `public/dist/modul-studio.mjs` — editor 2D e historial.
- `public/dist/modul-3d.mjs` — modelo 3D.
- `public/dist/modul-app.mjs` — interfaz (paneles, cuenta, proyectos, exportación).
- `public/dist/modul-api.mjs` — cliente de la API.
- `server/server.mjs` — servidor web (archivos + API).
- `server/db.mjs` — SQLite; las tablas `users`, `sessions`, `projects` se crean solas.
- `server/auth.mjs` — contraseñas (scrypt) y sesiones (cookie HttpOnly).
- `server/routes/` — rutas de la API.
- `tests/` — pruebas automáticas.

## API
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/auth/register` | Crear cuenta `{email, password}` |
| POST | `/api/auth/login` | Entrar (5 intentos fallidos → bloqueo de 15 min) |
| POST | `/api/auth/logout` | Cerrar sesión |
| GET | `/api/auth/me` | Usuario actual |
| GET | `/api/projects` | Mis proyectos (`?id=N` para uno completo) |
| POST | `/api/projects` | Guardar `{data:{input, alternatives, active, revision}}` |
| DELETE | `/api/projects?id=N` | Borrar |
| GET | `/api/health` | Estado del servidor y la base |

Cada usuario solo puede ver y borrar sus propios proyectos; el servidor valida cada proyecto con el mismo motor antes de guardarlo.

## Límites
La generación y el despiece son **conceptuales**: no son documentos de fabricación ni de aprobación estructural.

## Publicación en Vercel

- Repositorio: `yhovelalex-lgtm/MODUL-AI`, rama `main`.
- Directorio de salida: `public`; compilación: `npm run build`; Node 22.
- `api/index.mjs` utiliza `server/cloud.mjs`: sesiones HttpOnly, Secure, SameSite; protección de origen; validación del proyecto antes de guardar.
- Supabase existente: `ntnraylysccypmpmrzvs`, tabla nueva `modul_studio_projects`, RLS para SELECT/INSERT/DELETE del propietario. Las tablas anteriores no se modifican.
- La configuración predeterminada contiene exclusivamente la URL y clave publicable de Supabase. Se pueden sobrescribir con `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY`. Nunca se usa una clave administrativa.
- El correo debe confirmarse si Supabase lo exige; después se vuelve al sitio y se inicia sesión. Los límites y destinatarios permitidos dependen del SMTP configurado en Supabase.
- El código anterior se conserva en `legacy/` como referencia histórica.
- Para desarrollo local: `npm ci && npm start` (mantiene las cuentas SQLite originales).
