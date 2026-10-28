# MODUL-AI · Laboratorio de diseño modular

Proyecto de vivienda modular progresiva, con exploración de alternativas y representación volumétrica interactiva.

## Enlaces de los sistemas existentes
- [Aplicación original MODUL-AI v0.2](https://modul-ai-laboratorio-yhovel.teddymaquera159123.chatgpt.site) — fuente canónica en ChatGPT Sites; **todavía no sincronizada aquí**.
- [Backend Supabase MODUL-AI](https://supabase.com/dashboard/project/ntnraylysccypmpmrzvs) — proyecto existente con autenticación y `public.modul_projects`. No crear uno nuevo.
- [Demostración 3D con despiece conceptual](./index.html) — prototipo independiente alojable en GitHub Pages, sin acceso a datos personales.

## Qué contiene este repositorio
- `index.html`: visor WebGL Three.js, orbitación, selección de ambientes, opciones A/B/C, cubierta, explosión de piezas, lista y exportación CSV/JSON.
- `docs/INTEGRACION.md`: contratos de datos y pasos para fusionarlo con el editor original.
- `.github/workflows/ci.yml`: verificación mínima de archivos en cada push.

## Para ver directamente en navegador
En **Settings → Pages → Build and deployment**, seleccionar **Deploy from a branch**, rama `main`, carpeta `/ (root)`. GitHub Pages publicará el visor independiente y permitirá acceder por navegador. No confundirlo con la app original ni afirmar que está publicado antes de verificarlo.

## Integración pendiente
La fuente v0.2 del editor 2D, solver, auth y cliente de Supabase aún vive en el repositorio de ChatGPT Sites. Se debe importar conservando archivos, pruebas y hosting, y luego conectar la vista 3D a cada alternativa y los eventos de edición/fijación/restauración. Evitar incrustar claves de servicio o webhooks en el frontend.

## Alcance constructivo
El despiece mostrado es **conceptual: no apto para compra, fabricación ni montaje**. Los paños compartidos se duplican, faltan huecos, materiales, espesores reales, uniones, cargas, tolerancias, cálculo estructural y aprobación profesional.

### Tecnologías
HTML, CSS, ES modules, [Three.js](https://threejs.org), Supabase (backend existente); GitHub para control de versiones. Licencias de dependencias según sus respectivos proyectos.
