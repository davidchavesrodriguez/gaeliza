# Gaeliza v2: tagging MVP para revisión

Rama: `codex/v2-tagging`, creada desde `feat/v2` en
`8d6991b672bbae6d04ec314b7e412831ab60a077`. Se revisaron y rescataron los archivos
relacionados con tagging de `feat/v2-tagging` en
`4ede29339a9e46564cdcc0e08b075f804708421d`; no se fusionó esa rama. Se conserva el
lockfile de integración. El único cambio de tooling es un script `npm test` con el
runner nativo de Node y su ejecución en CI, sin dependencias adicionales.

## Comportamiento

Desde convocatoria → vídeo/directo → tagging se pueden capturar shot, recovery,
turnover, foul, card, kickout y block. Cada captura invoca una vez `log_event` con
su detalle y roles de `analysis_participants`, incluidos participantes temporales.
Todos admiten captura a nivel de equipo y posición opcional; kickout exige elegir
short/long. No se crean eventos complementarios automáticamente.

El timeline lee `analysis_event_facts` paginado y ordenado por período, segundo,
sort_order, creación e identificador. Muestra equipo y resultado, marcador analítico
y tiempos de vídeo calculados, nunca persistidos en events. Los puntos exactos y
la interpolación usan los anclajes del mismo vídeo y período. Fuera de los anclajes
se usa el offset del más cercano a velocidad 1x; un tiempo negativo o un conjunto
de anclajes ambiguo/no monótono devuelve ausencia de sincronización.

Inferir posesiones es una acción explícita. El RPC existente rechaza reconstruir
si hay correcciones manuales. Un análisis completed bloquea captura, borrado e
inferencia en pantalla; hay una acción explícita para reabrirlo.

## Correcciones sobre el trabajo recuperado

- Los segundos fraccionarios menores de diez se formatean con cero inicial.
  El parser rechaza fracciones en minutos/horas, hexadecimal, exponentes, signos,
  espacios internos y desbordamientos. Los tiempos de evento son enteros.
- Se admite tiempo añadido después de la duración nominal del período. El
  esquema original de events solo exige segundos no negativos; la captura no
  debe convertir `expected_duration_seconds` en un límite del partido real.
- Cero es una coordenada válida; las parejas incompletas se rechazan en UI/SQL.
  Las tarjetas también admiten las coordenadas comunes opcionales.
- Cambiar equipo o resultado limpia roles incompatibles. Antes de enviar se
  comprueba que los participantes seleccionados siguen disponibles.
- Una mutación mantiene la captura bloqueada hasta refrescar eventos y workspace.
  Si la escritura se confirma y falla la lectura, se indica que ya está guardada,
  se bloquea la recaptura y se ofrece recargar datos. Las lecturas se cancelan al
  desmontar/cambiar análisis. Un análisis inaccesible tras navegar muestra error
  en lugar de un spinner indefinido con el workspace anterior.
- El timeline ya no invierte el orden cronológico y no se limita silenciosamente
  al máximo de filas de una única petición PostgREST.
- Borrar/reabrir exige recibir la fila afectada: una escritura filtrada por RLS
  no puede presentarse como exitosa.
- El cliente acepta el par `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` del
  sandbox. Se mantienen los alias explícitos v2 de despliegues/CI cuando no existe
  ninguno de los dos nombres estándar; nunca se mezclan pares incompletos.

## Migraciones nuevas respecto a feat/v2

- `20261021181000_harden_tagging_timeline.sql`: anclaje único por segundo del
  período, monotonía serializada por vídeo, bloqueo de completed en events y todas
  sus tablas de detalles/participantes, transición atómica draft → in_progress.
  Las escrituras de eventos bloquean la fila del análisis para coordinarse con
  la transición a completed. Los borrados en cascada no se confunden con edición.
- `20261021181500_validate_event_participant_teams.sql`: equipo según rol y tipo;
  protege también cambios posteriores de equipo, identidad del detalle y resultado
  que invalidarían roles existentes. Las referencias temporales siguen permitidas.
- `20261021181700_validate_coordinate_pairs.sql`: parejas X/Y en events y parejas
  de destino en pass_events y kickout_events, conservando los checks 0..100.

No se han cambiado políticas RLS, usado service_role ni desplegado migraciones,
creado usuarios o modificado datos en Supabase remoto. Los disparadores internos
security definer tienen search_path vacío y ejecución pública revocada;
`log_event`, las lecturas y la inferencia conservan su modelo de permisos original.

## Validación ejecutada

En `gaeliza-frontend` con Node 24.19.0 y npm 11.9.0:

```bash
npm ci --cache /workspace/.npm --no-fund
npm audit --cache /workspace/.npm
npm run lint
npm run build
npm test
```

El primer `npm ci` sin cache explícita falló por permisos del cache global; el
comando de arriba completó la instalación con verificación de integridad intacta.

- Instalación correcta; lockfile sin cambios.
- Lint: correcto, sin errores ni avisos.
- Build TypeScript/Vite: correcto; aviso de bundle mayor de 500 kB.
- Node: 47 pruebas de dominio/datos pasan. Incluyen reloj, exactitud/interpolación/
  ausencia de sync, paginación con 501 filas, ceros, AbortSignal, RPC único y
  escrituras sin fila visible por RLS.
- Navegador: 12 escenarios pasan (13 resultados del runner incluyendo su padre).
  Cubren los siete tipos, limpieza de participantes, ceros, orden, recarga lenta,
  recarga fallida tras commit, inferencia explícita y completed/reapertura.
  Se usó Playwright disponible en el entorno y Chrome externo, sin añadirlos al
  package.json. El transporte Supabase está interceptado con fixtures locales;
  no se envían solicitudes al proyecto remoto.
- SQL: las 22 migraciones se aplicaron desde cero en PostgreSQL 17 desechable
  local. Pasan 46 aserciones de `supabase/tests/tagging.sql`, con RLS real y
  callers authenticated/anon; fixtures mínimos de Auth/Storage sustituyen esos
  servicios en esta comprobación. Incluyen rollback de un primer evento inválido,
  transición de estado, roles, coordenadas, manual possessions, completed y
  privacidad/publicación de hechos. No equivalen a probar todo Supabase hospedado.
- Diff completo revisado y sin cambios legacy o dependencias ajenos al slice.

Para repetir las pruebas rápidas (Node >=22.18 o Node 24): `npm test`.
Para repetir el navegador, instalar Playwright fuera del frontend y su navegador,
y exponer su ruta mediante NODE_PATH si corresponde:

```bash
node --test tests/tagging-browser.mjs
# Opcional: PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/ruta/a/chrome
```

Para repetir SQL, usar **solo** una base local desechable v2 con las migraciones
aplicadas y ejecutar como postgres:

```bash
psql '<conexion-local>' -v ON_ERROR_STOP=1 -f supabase/tests/tagging.sql
```

Las fixtures y funciones auxiliares SQL se revierten al finalizar.

## Pendiente de decisión humana

`npm audit` termina con código 1: **21 vulnerabilidades, 19 high y 2 moderate**.
El árbol instalado es el mismo lockfile heredado de `feat/v2`; afecta a tooling
como Vite/Rollup/PostCSS y las dependencias de ESLint/typescript-eslint. La
política actual de CI exige audit limpio, por lo que este resultado bloquea CI.
No se oculta ni se rebaja el umbral; actualizar ese árbol es trabajo pendiente
que conviene coordinar con los cambios de dependencias de integración.

Revisar las tres migraciones antes de aplicarlas al sandbox de desarrollo y hacer
un smoke de extremo a extremo con una sesión de Auth y un análisis de ese proyecto.
No se ha probado escritura autenticada contra el sandbox ni aplicado SQL allí.
Una comprobación de lectura sin filas contra `analysis_event_facts` tampoco pudo
conectarse: el proxy devolvió HTTP 403 al establecer el túnel (curl 56). Revisar
el permiso de red al host del sandbox antes del smoke remoto; este error no
demuestra que falten tablas o credenciales.
Si el sandbox ya recibió las versiones parciales con estos mismos nombres, usar
migraciones correctivas nuevas para las diferencias en vez de editar su historial.
Los datos con anclajes duplicados/no monótonos o coordenadas incompletas requieren
revisión previa: no se corrigen ni destruyen automáticamente para hacer pasar DDL.

La política de extrapolación 1x fuera de anclajes es una decisión explícita para
revisión; no detecta cortes fuera del intervalo sincronizado. La configuración
previa de puntos de sincronización aún exige tiempos dentro de la duración
nominal; se puede registrar tagging en tiempo añadido y extrapolar con el último
anclaje. Edición avanzada de eventos, pases/duelos en la UI, colaboración en tiempo
real y enlaces de seek a proveedores de vídeo quedan fuera de este MVP.
