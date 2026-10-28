# MODUL-AI · Estudio modular 2D + 3D

Repositorio oficial de trabajo: https://github.com/yhovelalex-lgtm/MODUL-AI

## Infraestructura
- **Frontend:** Vercel (aplicación estática con módulos ES, Three.js).
- **Control de versiones:** GitHub, rama `main`, pull requests y GitHub Actions.
- **Backend existente:** Supabase proyecto `ntnraylysccypmpmrzvs` (Auth, `modul_projects`, RLS).
- **App original:** https://modul-ai-laboratorio-yhovel.teddymaquera159123.chatgpt.site (sin modificar).

## Publicar en Vercel sin cambiar de base de datos
1. Abre https://vercel.com/new e inicia sesión con la cuenta que administra tu despliegue.
2. Selecciona **Import Git Repository** y autoriza GitHub para `yhovelalex-lgtm/MODUL-AI` si se solicita.
3. Comprueba que el repositorio seleccionado sea exactamente `yhovelalex-lgtm/MODUL-AI`.
4. Configura **Framework Preset: Other**, **Root Directory: .**, **Build Command: npm run build**, **Output Directory: public**.
5. Selecciona la rama de producción **main** y despliega.
6. Copia el dominio de Vercel generado y añádelo en Supabase **Authentication → URL Configuration → Redirect URLs / Site URL** según tu flujo de autenticación.
7. Verifica manualmente inicio de sesión, registro, generar, mover, fijar, guardar, listar y restaurar un proyecto.

Vercel despliega automáticamente nuevas versiones al actualizar `main`, y crea un enlace de **Preview** para los pull requests. La integración Git controla esos despliegues; no necesitas publicar con un token en un workflow separado.

## Calidad y versiones
- `npm run check` → comprobación sintáctica.
- `npm test` → pruebas del motor.
- `npm run build` → pruebas y preparación de archivos estáticos en `public/`.
- `.github/workflows/ci.yml` ejecuta el build en los push y pull requests.
- Trabaja en ramas `feature/*`, abre un PR y revisa el resultado antes de fusionarlo a `main`.
- Crea una etiqueta de versión `v0.3.0` cuando el despliegue sea comprobado; no se ha creado todavía.
- En Vercel, utiliza los Deployments anteriores para regresar a una versión conocida si aparece un problema.

## Archivos clave
- `index.html`: interfaz unificada, visor 3D y autenticación.
- `dist/modul-core.mjs`: generador heurístico conceptual.
- `dist/modul-studio.mjs`: editor 2D, historial y conexión a Supabase.
- `tests/modul-core.test.mjs`: pruebas automatizadas.
- `scripts/build.mjs`: copia la app a `public/` para Vercel.
- `vercel.json`: configuración de Vercel.
- `.github/workflows/ci.yml`: integración continua.
- `.gitignore`: exclusión de secretos y archivos generados.

## Seguridad
En el navegador solo se utiliza la **clave publicable** del proyecto Supabase, nunca una clave secreta o `service_role`. Mantén activadas las políticas RLS. No publiques variables privadas en GitHub, archivos `.env` ni workflows.

## Estado y límites
Esta versión es una reimplementación provisional basada en requisitos documentados; el código fuente canónico de la aplicación original de Sites todavía no se ha incorporado. La generación y el despiece son **conceptuales**, no documentos para fabricación o aprobación estructural. El despliegue público en Vercel queda pendiente hasta completar la vinculación del repositorio y comprobar la URL real.
