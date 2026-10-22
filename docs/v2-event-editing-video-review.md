# Edición de eventos y navegación de vídeo v2

Rama `codex/v2-event-editing-video`, desde `origin/feat/v2` en
`4eac640bb27c5098cce15d1be1bc317973d278ac`. La migración nueva es
`supabase/migrations/20261022100000_atomic_event_editing.sql`; las anteriores
permanecen intactas. Solo se aplica en PostgreSQL local para esta revisión.

## Edición y seguridad

`update_event` es un RPC `security invoker`, con `search_path = ''`, autenticación
por `auth.uid()`, comprobación explícita del propietario y permisos RLS existentes.
Solo `authenticated` tiene EXECUTE; ni PUBLIC ni anon. Bloquea primero el análisis
y después el evento, comprueba la pertenencia y rechaza completed. No recibe
`event_type`: utiliza el tipo almacenado e inmutable. La versión `updated_at`
recibida debe coincidir exactamente, conservando su precisión original.

En una única transacción retira roles, actualiza campos base, hace upsert del
detalle tipado y añade roles finales. Las constraints/triggers siguen validando
resultados, equipos, participantes, coordenadas y cambios out/in. Un error tardío
revierte también la retirada de roles y cualquier cambio anterior. No crea un
segundo evento. Las vistas facts/team/player calculan el estado nuevo directamente.
Notas, orden, autor, fecha de creación y `card_events.related_foul_event_id` no son
campos del editor y permanecen intactos, incluso si el payload intenta cambiar la
relación de la tarjeta.

`data/event-editing.ts` carga solo el evento solicitado: facts completo, sus roles
y una comprobación final de versión, en ese orden. Si una edición se confirma
entre las lecturas, se rechaza el snapshot mezclado. Todas las consultas están
acotadas por análisis/evento y son cancelables. Guardar usa una sola llamada RPC.
`EventEditor` reutiliza `QuickEventForm`, sus componentes tipados y las validaciones
de `event-capture`. La selección de tipo desaparece durante edición. Cancelar no
escribe; cambiar de evento desmonta/cancela la lectura anterior. El guardado mantiene
la exclusión de doble envío y espera la recarga de timeline/workspace. Un commit
confirmado seguido de fallo de lectura cierra el editor y bloquea nuevas escrituras
hasta recargar, para no repetir la operación.

El decoder conserva detalles completos, coordenadas raw y destinos 0/0. No aplica
valores de creación a datos históricos null. Tiro, tarjeta y longitud de saque
permiten «Descoñecido», que ya admite el esquema; los valores iniciales de captura
siguen siendo point/yellow/short. Los roles adicionales o repetidos que no exponía
la captura rápida permanecen visibles y editables. Se conserva también el portero
histórico de un tiro cuando el esquema lo permite. Un cambio explícito de
resultado/equipo limpia roles incompatibles; un participante obsoleto en un
snapshot de edición provoca validación, sin eliminar silenciosamente su identidad.

## Posesiones: decisión conservadora

- Sin posesión: edición normal.
- Inferida: cualquier edición correcta desacopla solo este evento, incluso si
  únicamente cambia detalle o coordenadas. No modifica ni elimina la posesión,
  ni los enlaces de otros eventos. La UI mantiene un aviso para revisar y
  reconstruir explícitamente; nunca llama a rebuild después de guardar.
- Manual: se rechaza **toda** edición del evento asociado con SQLSTATE 55000 y un
  mensaje claro, también cambios de coordenadas. No se interpreta la intención de
  una corrección manual ni se desvincula silenciosamente. Hace falta revisar esa
  asociación mediante una operación explícita antes de editar.

El aviso de revisión vive en la sesión del panel: no se introduce un estado
persistido de «posesiones pendientes». Que el equipo acreditado difiera del equipo
de la posesión es válido en el modelo y no se usa como criterio de invalidación.

## Vídeo

`domain/video-navigation.ts` usa URL/URLSearchParams y acepta solo HTTP(S), sin
credenciales embebidas. Infiere desde la URL aunque provider sea null.

- YouTube watch/youtu.be/embed: identifica host e ID, conserva parámetros útiles,
  reemplaza timestamps previos y abre el vídeo con `t` al segundo derivado.
- MP4/WebM/Ogg: reproductor HTML5 con controles, sin autoplay. Mantiene el último
  seek pendiente hasta metadata, valida duración configurada y real, permite
  nuevas selecciones del mismo vídeo y remonta al cambiar de recurso. Maneja
  errores de carga y de asignación de currentTime. El servidor de origen debe
  permitir reproducir/buscar el contenido; no hay proxy ni descarga backend.
- Otros proveedores: enlace al original y timestamp visible con el aviso «salto
  exacto non dispoñible». No añade parámetros inventados.

`TimelineEventRow` y `VideoEventLinks` mantienen pequeño el timeline. Todos los
vídeos sincronizados son accesibles. Los enlaces externos usan `_blank` y
`noreferrer`. Una URL insegura, mapping ausente o segundo fuera de duración conocida
no genera acción de seek. Completed deshabilita editar/quitar/inferir, pero permite
navegar. No se persisten timestamps ni el último vídeo seleccionado.

## Validación y reproducción

Desde `gaeliza-frontend`: `npm ci`, `npm audit --audit-level=high`, `npm run lint`,
`npm run build`, `npm test`: todos exit 0. Audit: cero vulnerabilidades. Tests Node:
106/106. Navegador: 27 escenarios, 28 resultados contando el contenedor, todos
verdes. SQL: 132 aserciones (46 + 40 + 46), todas verdes tras aplicar desde cero
las 24 migraciones. Sin cambios de dependencias, lockfile o configuración CI.

El smoke usa Playwright y Chrome externos al proyecto, sin nuevas dependencias:

```sh
cd gaeliza-frontend
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/ruta/a/chrome \
  node --test tests/tagging-browser.mjs
```

`TAGGING_SMOKE_PORT` permite elegir otro puerto (por defecto 5187). Todas las
peticiones Supabase están interceptadas; no se usa un proyecto remoto. El fixture
`tests/fixtures/tagging.webm` es un vídeo negro local de 16×16, 60 segundos,
generado con `ffmpeg -f lavfi -i color=c=black:s=16x16:r=1:d=60 -c:v libvpx -an`.
El servidor simulado implementa Range para probar el seek real de Chrome, incluidos
metadata pendiente, nueva selección, cambio de recurso, límites y error de carga.

En una base PostgreSQL 17 **desechable**, con los stubs locales de auth/storage
necesarios para migraciones Supabase y todas las migraciones en orden, ejecutar
como postgres con `ON_ERROR_STOP=1`:

```sh
psql "$LOCAL_DB" -v ON_ERROR_STOP=1 -f supabase/tests/tagging.sql
psql "$LOCAL_DB" -v ON_ERROR_STOP=1 -f supabase/tests/tagging-extended.sql
psql "$LOCAL_DB" -v ON_ERROR_STOP=1 -f supabase/tests/event-editing.sql
```

Cada suite revierte sus fixtures. La nueva cubre 46 aserciones: los 13 tipos,
resultado/receptor/interceptor, cambio de equipo/período/reloj, ceros, rollback,
posesiones, datos conservados, vistas analíticas, permisos, completed e inmutabilidad.
Las suites anteriores mantienen 46 y 40 aserciones.

## Alcance y decisiones pendientes

No hay dashboards, migraciones remotas, cambios legacy/producción, ni optimización
del bundle. Se mantiene el warning de chunk >500 kB. Quedan para un slice futuro
la UI explícita de asociación/corrección de posesiones manuales, la edición de la
relación tarjeta/falta y una posible señal persistente de posesiones pendientes.
No bloquean esta entrega: las decisiones actuales favorecen conservar datos y
rechazar cambios ambiguos. No se ha hecho merge ni activado auto-merge.

## Corrección de concurrencia tras revisión humana

La revisión detectó que el token solo cambiaba al escribir `events`, aunque RLS
permite mutar directamente detalles o insertar/borrar roles. Un editor antiguo
podía por tanto sobrescribir un cambio hijo no detectado. Se corrige únicamente
en la nueva migración `20261022110000_version_event_child_mutations.sql`, sin
modificar migraciones publicadas ni los RPC, sus grants o las políticas RLS.

- `events_set_updated_at` pasa a una función específica de eventos, invoker. Usa
  `greatest(clock_timestamp(), old.updated_at + interval '1 microsecond')` para
  avanzar estrictamente incluso dentro de una transacción o con ajuste de reloj.
  Ignora el timestamp enviado por el cliente y recupera tokens no finitos usando
  el reloj actual. El helper genérico `private.set_updated_at` queda intacto para
  las demás tablas.
- Las diez tablas de detalles y `event_participants` tienen un trigger AFTER
  INSERT/UPDATE/DELETE, también invoker. Por cada fila realmente modificada toca
  cada padre distinto una vez. Si una reasignación está permitida, versiona tanto
  el padre anterior como el nuevo. Un UPDATE sin cambios no escribe el padre.
- El guard BEFORE `event_child_require_editable_analysis` mantiene los locks y la
  prohibición completed. El UPDATE del padre sigue sujeto a RLS y los triggers
  existentes; no existe un camino de vuelta hacia hijos ni recursión. No hay flags
  de sesión que permitan eludir la versión durante un RPC.
- En el cascade de un evento eliminado, el padre ya no existe y el UPDATE afecta
  cero filas. En cambio, borrar una falta que provoca SET NULL en una tarjeta
  superviviente sí avanza la versión de esa tarjeta. Los errores y rollbacks
  revierten todos los cambios de versión junto con las filas.
- Authenticated tiene grant UPDATE sobre `event_participants`, pero actualmente
  ninguna política UPDATE: el owner modifica cero filas por ese camino. Se mantiene
  esta restricción. El trigger cubre igualmente UPDATE; las pruebas de esa ruta y
  de reasignación usan mantenimiento privilegiado **solo en PostgreSQL local**,
  sin añadir políticas ni permisos al producto.

Validación repetida de la corrección:

- Las 25 migraciones desde cero en PostgreSQL 17 desechable; cuatro suites verdes:
  46 + 40 + 46 anteriores y 119 nuevas, **251 aserciones**. La suite nueva cubre
  I/U/D en cada tabla tipada, roles, no-ops, ambos padres de una reasignación,
  stale 40001, log_event/update_event, versiones dentro de una transacción,
  rollback, completed y ambos tipos de cascade.
- Se verificó que la regresión falla contra las primeras 24 migraciones al no
  avanzar la versión tras un UPDATE solo de shot_events, y pasa tras la nueva.
- Además se comprobó en sesiones/transacciones separadas: lectura de versión,
  commit de cambio directo de detalle/rol, RPC stale rechazado con 40001, RPC
  vigente correcto y eliminación con cascade.
- `npm ci`, `npm audit --audit-level=high` (0 vulnerabilidades), lint y build: exit 0.
  Node: 106/106. Browser: 27 escenarios / 28 resultados, todos verdes.
- Sin cambios frontend, dependencias, configuración CI ni Supabase remoto. Sigue
  únicamente el warning conocido del bundle >500 kB.

Las suites `event-editing.sql` y `event-child-versioning.sql` comparten ahora
`supabase/tests/fixtures/editing.sql` mediante `\ir`, para evitar duplicar la
preparación de esta regresión. Se ejecutan con `psql -f` (no como stdin aislado),
conservando el subdirectorio fixtures junto a los scripts:

```sh
psql "$LOCAL_DB" -v ON_ERROR_STOP=1 -f supabase/tests/event-child-versioning.sql
```

Las cuatro suites se han vuelto a ejecutar desde cero con ese layout, manteniendo
las 251 aserciones. No se modifica la configuración de SonarCloud ni su umbral de
duplicación; se comparte el código repetido de las pruebas.
