# MODUL-AI · Integración progresiva GitHub + Supabase

## Infraestructura confirmada
- GitHub: https://github.com/yhovelalex-lgtm/MODUL-AI
- Supabase existente: `ntnraylysccypmpmrzvs`, sin proyectos nuevos.
- Editor original (Sites): https://modul-ai-laboratorio-yhovel.teddymaquera159123.chatgpt.site
- GitHub Pages: activar en Settings > Pages > Deploy from branch > main / (root).

## Flujo conectado en la DEMO 3D
1. Renderizador de muestra (alternativas A/B/C de datos ficticios).
2. Registro / login con Supabase Auth (requiere email verificado cuando la configuración de Auth lo exige).
3. Guardar versión 3D en `public.modul_3d_previews`.
4. Consultar únicamente las versiones del propietario.
5. Seleccionar una versión para volver a visualizarla en el visor.

`index.html` usa solamente la clave **publicable** del proyecto, nunca service_role. La seguridad de los registros depende de las políticas RLS. Se deben comprobar con una cuenta real el signup, confirmación, inicio de sesión, guardar, listar, restaurar y cerrar sesión antes de marcar el flujo como verificado.

## Tablas
- `public.modul_projects`: original v0.2, historial 2D y resultados. SIN CAMBIOS.
- `public.modul_3d_previews`: nuevas versiones de vista 3D de prueba. Guarda `name`, `alternative`, `geometry`, `parts`, propietario y fecha.
- La segunda tabla está aislada por propietario (SELECT e INSERT únicamente con `auth.uid()=owner_id`); por diseño no permite sobrescribir versiones.

## Pendientes necesarios para sistema completo
- Recuperar código fuente de Sites (`dist/app.mjs`, `dist/editor.mjs`, `dist/generative.mjs`, `dist/cloud.mjs`, `dist/engine.mjs`) y `.openai/hosting.json`.
- Vincular el estado **real y actual** de A/B/C del editor al visor. Ahora el 3D usa datos de muestra y NO sincroniza con el diseño 2D real.
- Incorporar despiece técnico no duplicado con materiales, uniones, tolerancias y revisión profesional (el actual es esquemático, no fabricable).
- Validar render y funcionamiento en navegador y móvil. Probar Auth y RLS desde dos cuentas diferentes.
- Configurar un solo despliegue de la interfaz final cuando se disponga del proyecto canónico, preservando el acceso original y sin imponer cambios de hosting.
- Make/Notion: integración posterior, sin conectar secretos al frontend.

## Seguridad
No insertar credenciales de administrador, `service_role`, correos personales, contraseña ni webhooks privados en GitHub. La clave publicable y URL de Supabase son aptas para clientes; el aislamiento está en RLS. Las versiones 3D se crean como registros nuevos.

## Activación de sitio estático de prueba
En GitHub > Settings > Pages, seleccionar rama main / root. Una vez desplegado, comprobar el estado en Actions y abrir `https://yhovelalex-lgtm.github.io/MODUL-AI/`. No afirmar que el sitio está publicado sin comprobar su disponibilidad.
