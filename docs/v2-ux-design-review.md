# Revisión de UX y diseño v2

Rama: `codex/v2-ux-design-foundation`. Base verificada con fetch explícito de
`feat/v2`: `ff70de30e3f61f4b6db13c290281997eb0e391cc`.
El primer commit del slice fue `docs: define Gaeliza product design system`;
[DESIGN.md](DESIGN.md) es la fuente de verdad visual.

## Comportamiento entregado

- Dashboard de análisis propios, con `draft`/`in_progress` separados de
  `completed`, equipos, fecha, estado, eventos, presencia de vídeo y timestamp.
  Continuar conserva el ID; borradores abren convocatoria y el resto tagging.
  No se ofrece una eliminación de análisis nueva.
- Una petición PostgREST por página de 50 análisis: joins de equipos y counts.
  Filtro de propietario
  explícito, cancelación, carga adicional y errores recuperables sin vaciar filas.
  La fecha mostrada, orden y paginación usan `analyses.updated_at`, mantenido
  por la DB para la actividad del agregado. Sin consultar timestamps de eventos
  ni construir un activity log. Desempate por ID y sin consultas N+1.
- Inicio visible también durante carga/error. Sección del workspace en query
  string. El estado de guardado sigue promesas de escritura reales: pending,
  confirmación o fallo. Un commit seguido de fallo de lectura permanece
  «Gardado» con recuperación explícita y bloqueo de nuevas escrituras.
  El borrador del formulario se registra al confirmar un evento; no hay autosave
  por pulsación ni temporizadores de éxito.
- Finalización confirmada con diálogo nativo, cancelación/Escape y retorno de
  foco. Completado conserva timeline y vídeo, oculta la captura y bloquea
  edición/eliminación/inferencia/configuración. Reabrir usa la operación existente.
- Explicación de sync junto al control: partido 00:00 / vídeo 03:42. Mappings de
  presentación gallegos para posiciones y enums, sin alterar valores almacenados.
  Las posiciones personalizadas siguen siendo texto libre. Fechas gallegas
  explícitas incluso si el navegador carece del locale `gl-ES`.
- Saque de porta sin origen en captura **y edición**: `x/y = null`, destino
  opcional, incluido `0,0`. Editar un origen histórico lo limpia en esa escritura,
  según aclaración del usuario sobre sus datos de prueba. Sin limpieza masiva.
- Trece controles agrupados en Principais, Xogo, Reinicios, Disciplina y Cambios,
  con selección `aria-pressed` y teclado; mismo formulario tipado para edición.
- Vídeo secundario colapsable: al ocultarlo el formulario recupera ancho. HTML5
  reutilizado, embed YouTube de host/ID validado, sin autoplay ni API adicional;
  otros proveedores abren el original, nunca iframe. Seek desde timeline también
  en completed. El destino recibe foco al navegar desde un evento.

## Revisión visual y accesibilidad

Revisados dashboard, landing, tagging de escritorio oscuro/claro, móvil de 390 px
y workspace completado. Se sustituyen cajas anidadas por secciones/divisores y
filas; superficies neutras, verde para selección/acción y campo. Una familia de
sistema, números tabulares, radius 3/6 px, sin sombras ni gradientes decorativos,
sin métricas ficticias, fotos o animaciones de entrada. Landing con flujo concreto.

Temas completos mediante tokens comunes y selector persistido. Se respeta el
tema del sistema inicialmente y sus cambios mientras no haya elección manual.
Sin duplicar componentes ni añadir dependencias.

Browser verifica foco visible por Tab, activación por Enter, diálogo/cancelación,
retorno de foco, labels, navegación móvil sin overflow y contraste calculado de
tokens reales. Texto/estado supera 4.5:1 y bordes de control 3:1 en ambos temas
(texto secundario sobre superficie: 8.11:1 oscuro / 6.34:1 claro; borde de control:
3.57:1 / 3.27:1). Esto no sustituye una auditoría completa de accesibilidad.
El spinner respeta `prefers-reduced-motion`; no se introduce scroll animado.

Decisiones para revisión humana:

- Los trece controles ocupan dos filas en escritorio de 1440 px con vídeo abierto;
  en móvil el formulario se apila y requiere scroll. Se prioriza legibilidad sobre
  columnas estrechas o un menú que esconda tipos.
- Completado muestra la timeline como contenido principal, sin formulario inerte
  ni un dashboard analítico nuevo. El vídeo sigue siendo secundario.
- El vídeo oculto se desmonta para detener la reproducción; al reabrir vuelve al
  último instante solicitado, sin conservar el playhead en vivo. Visibilidad solo
  en memoria. YouTube recarga el embed para seek, sin introducir SDK.
- El tema claro usa el mismo acento y jerarquía; el oscuro es la referencia.

## Validación local

| Comprobación | Resultado |
| --- | --- |
| `npm ci` | exit 0, lockfile sin cambios |
| `npm audit --audit-level=high` | exit 0, 0 vulnerabilidades |
| `npm run lint` | exit 0 |
| `npm run build` | exit 0 |
| `npm test` | 117/117 |
| Browser de tagging anterior | 27 escenarios, 28/28 resultados incluyendo padre |
| Browser UX ampliado | 11 escenarios, 12/12 resultados incluyendo padre |
| PostgreSQL tagging | 46 aserciones |
| PostgreSQL tagging extended | 40 aserciones |
| PostgreSQL event editing | 46 aserciones |
| PostgreSQL child versioning | 119 aserciones |
| PostgreSQL UX kickout | 5 aserciones |
| PostgreSQL analysis activity | 60 aserciones |

PostgreSQL 17 local desechable, sin red, bootstrap mínimo auth/storage y las 26
migrations aplicadas desde cero. Las seis suites pasan (316 aserciones) y hacen
rollback. El caso nuevo cubre captura sin origen, destino cero, edición de origen
histórico y analytics. La revisión añade una migration; ninguna anterior se modifica. No acceso a
Supabase remoto, credenciales privilegiadas ni cambios de legacy.

Browser ejecuta páginas/componentes reales con transporte local simulado; cubre
dashboard → continuar → tagging → finalizar → dashboard/completado → reabrir,
fallos y escritura retenida para verificar pending. No requiere Supabase remoto.
Playwright/Chromium son herramientas del entorno, no dependencias de producción.

Reproducción desde `gaeliza-frontend`, con Playwright disponible para Node y un
Chromium instalado:

```sh
node --test tests/tagging-browser.mjs
UX_SCREENSHOT_DIR=/tmp/gaeliza-ux node --test tests/ux-browser.mjs
```

Si Chromium no está en la ubicación de Playwright, pasar
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. Para SQL, usar únicamente una base local
desechable con migrations aplicadas y ejecutar los seis archivos de
`supabase/tests/`, conservando su carpeta `fixtures/` para los `\ir`.

Las capturas también están publicadas en la [galería del repositorio](screenshots/v2-ux-design-foundation/README.md), accesible desde GitHub sin acceso al entorno local.

Capturas generadas en `/workspace/artifacts/ux-foundation/`: `dashboard-dark.png`,
`tagging-desktop-dark.png`, `tagging-desktop-light.png`, `tagging-mobile-dark.png`,
`workspace-completed-dark.png` y `landing-dark.png`. Son fixtures identificadas de
revisión, no actividad inventada en producto; el player reproduce un WebM negro
local de prueba. Las capturas no se incorporan como assets de la aplicación.

## Deuda y límites

Permanece el aviso conocido de chunk mayor de 500 kB (~610 kB minificado); sin
cambiar límites ni optimizar bundles en este slice. No se añade eliminación de
análisis, migración de invitados entre dispositivos ni historial de actividad.
El listado no es realtime. Mantener la separación de domain/data/UI y
continuar con slices acotados antes de añadir analytics o nuevos servicios.

## Revisión: actividad del agregado y copy

Migration creada con Supabase CLI 2.76.15 mediante
`supabase migration new version_analysis_workspace_activity`:
`20261022110208_version_analysis_workspace_activity.sql`, posterior a todas las
existentes. Aplicada únicamente a PostgreSQL local. Ninguna migration integrada
se edita ni se ejecuta contra Supabase remoto.

INSERT/UPDATE/DELETE en `analysis_participants`, `analysis_videos`,
`video_sync_points`, `analysis_periods` y `events` propagan actividad al análisis.
Los triggers existentes de detalles tipados y `event_participants` siguen
versionando el evento; esa versión avanza el análisis mediante el trigger de
`events`, sin nuevos triggers en las once tablas de hijos de evento.

El helper privado del reloj se renombra a `set_aggregate_updated_at`, compartido
por eventos y análisis. Usa `clock_timestamp()` con mínimo de versión anterior
+ 1 microsegundo, sin confiar en un timestamp enviado por el cliente. No-op de
evento y metadatos conserva versión; los no-ops del resto de hijos ignoran su
`updated_at` de bookkeeping. El touch de un cambio real de detalle/rol es ahora
explícito, distinguiéndolo de una actualización idéntica del evento. Se mantienen
los conflictos optimistic concurrency y las protecciones existentes de completed.

Los helpers son SECURITY INVOKER y no se conceden permisos de ejecución directa.
Se conservan políticas/grants RLS. La transición automática draft → in_progress
del primer evento se integra en su único UPDATE del análisis, retirando el
trigger/función anterior que usaba SECURITY DEFINER. No se añaden privilegios.

Las reasignaciones permitidas bloquean y actualizan ambos análisis en orden de
ID. En una cascada de borrado de análisis, la fila padre ya no existe: el lookup
no devuelve filas y no se intenta su UPDATE. Un borrado de vídeo/sync o evento
con análisis vivo sí registra actividad. El flujo siempre asciende y ningún
trigger de análisis escribe en hijos; no hay ciclos ni guardas por profundidad
que oculten cambios legítimos. Todo queda en la misma transacción y revierte en
rollback. Las pruebas registran físicamente los UPDATEs del padre para verificar
cero writes en no-ops de hijos y cascadas de análisis, y un solo write del primer
evento para fecha y estado.

La nueva suite SQL cubre las cinco tablas y las tres operaciones, dirección de
período, detalles/roles, reasignación, permisos, create_analysis/log_event/
update_event, rollback tardío, completed y cascadas. Node verifica orden, ID de
desempate y timestamp del análisis; browser añade una escritura solo de
convocatoria seguida de Inicio y comprueba que sube la fila sin eventos y que
su etiqueta usa exactamente el timestamp del agregado.

Copy revisado por contexto: «Nova análise», «As túas análises», «Completadas»,
«Análise finalizada», «Reábrea» y «reabrila», incluidas navegación, confirmación,
errores y tests. `out_of_play` se presenta como «Balón fóra» tanto en formulario
como timeline; su enum no cambia. También se eliminan overrides que exponían
«Steps»/«Pickup» y se corrigen «Pao» → «Pau» y «Zancadilla» → «Cambadela».
«Pase completado» mantiene su concordancia masculina. Sin dudas lingüísticas
pendientes identificadas en el copy revisado.

El favicon conserva su dibujo existente y sustituye azul/blanco por el fondo
neutro oscuro y acento verde definidos en DESIGN.md. Sin nuevo logo ni assets
de aplicación adicionales.

El contrato de actividad se aplica a las mutaciones desde esta migration. No se
inventa ni reconstruye actividad histórica que el esquema anterior no registró,
por ejemplo hijos ya eliminados; no hay backfill que finja actividad nueva.
