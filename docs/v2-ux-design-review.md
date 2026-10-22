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
- Una petición PostgREST por página de 50 análisis: joins de equipos, counts y
  como máximo un timestamp de evento por análisis. Filtro de propietario
  explícito, cancelación, carga adicional y errores recuperables sin vaciar filas.
  La fecha mostrada es el máximo entre `analyses.updated_at` y el último evento;
  no pretende ser un registro universal de todas las tablas hijas. La paginación
  se ordena por `analyses.updated_at` e ID, no por un agregado costoso. No N+1.
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
| `npm test` | 116/116 |
| Browser de tagging anterior | 27 escenarios, 28/28 resultados incluyendo padre |
| Browser UX ampliado | 10 escenarios, 11/11 resultados incluyendo padre |
| PostgreSQL tagging | 46 aserciones |
| PostgreSQL tagging extended | 40 aserciones |
| PostgreSQL event editing | 46 aserciones |
| PostgreSQL child versioning | 119 aserciones |
| PostgreSQL UX kickout | 5 aserciones |

PostgreSQL 17 local desechable, sin red, bootstrap mínimo auth/storage y las 25
migrations aplicadas desde cero. Las cinco suites pasan (256 aserciones) y hacen
rollback. El caso nuevo cubre captura sin origen, destino cero, edición de origen
histórico y analytics. Ninguna migration modificada ni añadida. No acceso a
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
desechable con migrations aplicadas y ejecutar los cinco archivos de
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
análisis, migración de invitados entre dispositivos ni historial universal de
actividad. El listado no es realtime. Mantener la separación de domain/data/UI y
continuar con slices acotados antes de añadir analytics o nuevos servicios.
