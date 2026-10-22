# Tagging v2: segunda fase para revisión

Rama `codex/v2-tagging-complete`, creada desde el HEAD remoto de `feat/v2`:
`398ed78c776bc3d8f78ab58d79032cfbb7b64a60`. Se ha vuelto a consultar el remoto
antes de finalizar. No se trabaja sobre la rama de integración ni se hace merge.

## Arquitectura y archivos principales

`components/TaggingPanel.tsx` pasa de 993 a 104 líneas y compone:

- `tagging/QuickEventForm.tsx`: borrador, validación y envío; menos de 100 líneas.
- `CommonEventFields`, `EventParticipantFields`, `EventDetailFields` y componentes
  específicos de tiro/pase/duelo/regate/falta/saque/reinicio/tarjeta/recuperación/perdida.
  `ChoiceField` comparte únicamente el select tipado, sin un motor de formularios.
- `TaggingScoreboard`, `TaggingTimeline` y `PossessionControls`: presentación y
  acciones explícitas, separadas del formulario.
- `useTaggingEvents`: lecturas cancelables, exclusión de mutaciones concurrentes,
  avisos de commit confirmado y recuperación de una recarga fallida.

`domain/event-capture.ts` contiene una unión discriminada de detalles según tipo,
valores del esquema, roles elegibles, limpieza del borrador y validación previa al
RPC. `domain/tagging.ts` mantiene sync y añade resúmenes. `data/tagging.ts` sigue
siendo el acceso a Supabase: una llamada `log_event` por hecho físico.

No hay acceso directo a Supabase dentro de componentes, any ni casts para forzar
las uniones. Solo se mantienen aserciones en la frontera de respuestas PostgREST,
como ya hace el repositorio. No hay cambios legacy, nuevas dependencias, cambios de
manifest/lockfile/CI, dashboards ni modificaciones de migraciones integradas.

## Captura añadida

- Pase: completed/incomplete/intercepted, hand/foot, origen/destino opcionales.
  Pasador y receptor real/previsto según resultado; interceptor rival solo para
  intercepted. Nunca genera recovery o turnover complementarios.
- Duelo: aerial/ground/other; equipo acreditado = ganador, winner local al evento
  y loser rival. La UI lo explica también cuando no se identifica jugador.
- Regate: successful/failed, dribbler del equipo y defender rival.
- Reinicio: free/sideline/throw_in/forty_five/penalty/other y restart_taker opcional.
- Substitución: player_out/player_in del mismo equipo; ambos, uno solo o ninguno.
- Cambio de portero: goalkeeper_out/goalkeeper_in del mismo equipo. Los eventos
  no modifican convocatoria ni `initial_goalkeeper`.

Los siete tipos anteriores continúan disponibles. Cambiar tipo descarta los
campos y roles anteriores; pulsar otra vez el tipo activo conserva el borrador.
Cambiar equipo o resultado limpia solo los roles incompatibles. Si un participante
ha desaparecido de la última convocatoria disponible, no se envía su identificador.
El backend sigue siendo la autoridad ante cambios concurrentes en base de datos.
Las coordenadas raw conservan 0 y se validan como parejas también para destino de
pass/kickout. El reloj respeta el rango integer de PostgreSQL y admite tiempo añadido.

El timeline conserva facts, orden estable y paginación de 500. Muestra detalles de
los nuevos tipos y los participantes históricos conocidos en los cambios; para
los ausentes indica que no se conocen, sin inventar identidades. Solo los eventos
substitution/goalkeeper_change requieren una lectura adicional de roles, con
AbortSignal y lotes de 100 IDs para limitar la longitud de las URLs. El tiempo de
vídeo sigue siendo derivado, con el mismo algoritmo y pruebas de sincronización.

## Integridad: una migración nueva

`20261021190000_extended_tagging_participant_semantics.sql` protege dos invariantes:

1. Receiver implica pase completed; intended_receiver implica incomplete o
   intercepted. La prueba SQL falló contra el esquema anterior: se podía registrar
   receiver en un pase incompleto y aumentar falsamente `analysis_player_stats.receptions`.
   Se protege tanto la escritura del rol como el cambio/borrado posterior del detalle.
2. Un mismo participante no puede salir y entrar en el mismo evento de sustitución
   o cambio de portero. Se permiten todos los casos de información parcial.

Los controles existentes de tipo, equipo y completed ya cubren las tablas y roles
nuevos; no se duplican. Los disparadores usan el bloqueo existente por análisis,
funciones internas security definer con search_path vacío y EXECUTE revocado.
Se justifica el acceso interno para comprobar detalles y roles hermanos sin depender
de visibilidad parcial; no otorga escrituras nuevas ni cambia RLS/RPCs públicos.

No se han ejecutado migraciones ni consultas contra Supabase remoto en esta tarea.
Antes de desplegar, revisar roles históricos incompatibles si los hubiera; no se
reescriben ni destruyen datos para corregirlos silenciosamente.

## Validación

Con Node 24.19.0 y npm 11.9.0, desde `gaeliza-frontend`:

```bash
npm_config_cache=/workspace/.npm npm ci
npm_config_cache=/workspace/.npm npm audit --audit-level=high
npm run lint
npm run build
npm test
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/workspace/.cloud-tools/chrome/opt/google/chrome/chrome \
  node --test tests/tagging-browser.mjs
```

- Instalación: exit 0, manifest y lockfile sin cambios.
- Audit: exit 0, **0 vulnerabilidades**.
- Lint y build: exit 0. Persiste el aviso conocido de bundle >500 kB.
- Tests Node: **89 pruebas**, todas correctas. Se conservan reloj, sync,
  paginación >500, ceros y AbortSignal; se amplían todos los tipos/roles, limpieza
  de estado, datos ausentes, límites y resúmenes. El nuevo test de datos comprueba
  500 cambios con cinco consultas acotadas de participantes y fallo sin publicar
  un timeline parcial.
- Navegador: **22 escenarios** correctos, 23 resultados incluyendo el padre.
  Se conserva el smoke anterior y se añaden pases con tres resultados, destino
  cero, tipos nuevos con roles, captura parcial y eliminación de un participante.
  Playwright/navegador se usan desde herramientas externas, sin dependencias nuevas.
  El tráfico está interceptado en el fixture local y no contacta Supabase remoto.
- PostgreSQL 17 local desechable, sin red externa: se aplican las 23 migraciones.
  `supabase/tests/tagging.sql`: **46 aserciones** correctas.
  `supabase/tests/tagging-extended.sql`: **40 aserciones** correctas, además de las
  llamadas válidas al RPC que fallarían el script si no fueran aceptadas.
  Se comprueban facts, team/player stats, no duplicación, roles/equipos, detalles,
  completed, inferencia explícita y flags iniciales. Los fixtures de Auth/Storage
  son mínimos; las políticas RLS y funciones son las reales de las migraciones.
  Todas las fixtures de cada suite se revierten al finalizar.

Para repetir SQL sobre **solo** una base local v2 desechable con las migraciones:

```bash
psql '<conexion-local>' -v ON_ERROR_STOP=1 -f supabase/tests/tagging.sql
psql '<conexion-local>' -v ON_ERROR_STOP=1 -f supabase/tests/tagging-extended.sql
```

Los resultados de navegador/SQL locales no equivalen a un despliegue ni a un
smoke autenticado del proyecto alojado. Esta tarea no necesita modificar ese proyecto.

## Decisiones conservadoras y revisión humana

- Pass, duel, dribble y restart aceptan detalles desconocidos (null), tal como
  permiten sus CHECKs. No se adivina el resultado de un pase. Con resultado
  desconocido se ofrece el pasador, sin afirmar recepción o intercepción.
  Shot/card/kickout mantienen sus mínimos y defaults del MVP.
- La inferencia de posesiones no cambia. El significado de un regate failed no
  especifica por sí solo una pérdida de control: no se inventa un turnover ni
  una regla de cierre. Revisar esa semántica de producto antes de modificar el RPC;
  hasta entonces se conserva la interpretación actual y la reconstrucción explícita.
- Siguen pendientes la edición avanzada de eventos y navegación/seek de vídeo.
  No se amplían métricas: las métricas existentes de pases/intercepciones/recepciones
  se verifican sobre hechos canónicos y roles válidos.
- Las consultas adicionales de participantes son deliberadas y acotadas. Un futuro
  read model dedicado podría reducir peticiones si aparecen timelines muy densos.
- Revisar la migración nueva antes de aplicarla. Los archivos SQL ya integrados
  permanecen intactos. No se necesita ampliar permisos ni relajar RLS.
