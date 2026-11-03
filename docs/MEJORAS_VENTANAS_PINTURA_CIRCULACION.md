# Ventanas, pintura y circulación adaptable

## Uso

- Selecciona un ambiente y elige **Ventanas del ambiente**: original, celosía plana de madera o celosía plegable hacia afuera. Los dos estilos nuevos agregan una protección exterior al vidrio y conservan los vanos existentes.
- En **Pintar**, elige un color. Los botones pintan los muros o el piso del ambiente seleccionado. **Pintar con clic en 3D** permite elegir el ambiente desde la superficie: un clic en un muro pinta sus muros, un clic en el piso pinta su piso. Las caras de muros compartidos conservan el color del ambiente correspondiente. **Restaurar acabados** recupera los materiales originales.
- El hall se selecciona en el plano o el modelo. Muévelo con el inspector, arrastre en 2D o flechas. Las habitaciones también admiten estas acciones. Al confirmar un cambio geométrico, se conectan el ingreso, los pasillos y todos los ambientes mediante celdas libres de media retícula.
- Los enlaces creados automáticamente se recalculan, sin acumular conexiones obsoletas. Fijar, mover o personalizar un enlace lo conserva. La fijación del hall protege durante la edición; generar alternativas nuevas reconstruye la circulación.
- Estilos, pintura y conexiones forman parte de cada alternativa y se incluyen en JSON, guardado de proyecto y deshacer/rehacer. Los proyectos anteriores siguen abriendo con el aspecto original.

## Alcance de la circulación

El motor conserva sus restricciones de geometría: retícula, dimensiones positivas, zona edificable, reserva posterior, ausencia de superposiciones y acceso desde el ingreso central. Los nuevos corredores tienen un ancho mínimo geométrico de medio módulo. No se atraviesan habitaciones ni pasillos existentes, ni se desplazan otros ambientes para forzar una solución. Se rechaza el movimiento si no hay una conexión válida.

La validación existente **no implementa normativa urbanística, evacuación, iluminación, ventilación, estructura ni accesibilidad**. La conexión automática es conceptual; su ancho útil entre acabados y su cumplimiento normativo requieren revisión profesional. No se han inventado parámetros legales.

## Implementación

- `modul-circulation.mjs`: búsqueda sobre retícula y agrupación de nuevas conexiones en rectángulos sin superposición.
- `modul-studio.mjs`: edición y selección del hall, actualización atómica de ambiente y conexiones, pintura e historial.
- `modul-core.mjs`: campos opcionales de apariencia y persistencia compatible; límite de tramos de circulación acotado por la retícula.
- `modul-3d.mjs`: dos celosías, materiales por ambiente, selección de caras y actualización del modelo al editar acabados.
- `modul-app.mjs`, `index.html`, `app.css`: controles y explicación de alcance.
- `tests/circulation.test.mjs`: conexión física al ingreso y puertas al hall, movimiento, rechazo, limpieza, bloqueos y persistencia.

## Verificación

`npm run build` comprueba sintaxis de los módulos y ejecuta pruebas del motor, la API local y el adaptador cloud con servicios simulados. La prueba de conectividad comprueba además que cada puerta de habitación abra a circulación conectada, no solo a espacio exterior libre.

Verificación local realizada con Node 24: 31 pruebas aprobadas y análisis de sintaxis correcto. La CI del repositorio ejecuta Node 22. En Chromium se verificaron las tres opciones de ventana, pintura por botones y raycast 3D, exportación/importación JSON, deshacer/rehacer, movimiento de dormitorio con conexiones nuevas, bloqueo, hall con teclado y arrastre, corte/techo/despiece y viewport móvil de 390 px sin desbordamientos. Sin errores JavaScript durante ese recorrido. Las capturas de fachada se inspeccionaron visualmente. No se ha probado contra cuentas ni proyectos de producción.

La ampliación por niveles queda fuera de este cambio.
