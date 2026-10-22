# Tagging: ergonomía y disciplina ligada a una falta

Base: `feat/v2` en `55ca68df4a8c4afc7b7bc85550f39b96d9c9983a`.
Rama: `feat/v2-tagging-ergonomics`. Sin cambios legacy, dependencias ni Supabase remoto.

## Escritura canónica y seguridad

Migration nueva creada con Supabase CLI:
`20261022125346_log_foul_with_optional_card.sql`.

RPC `public.log_foul_with_optional_card`:

- Obligatorios: `p_analysis_id uuid`, `p_period_id uuid`, `p_team_id uuid`,
  `p_second_in_period integer`.
- Opcionales: `p_x numeric`, `p_y numeric`, `p_detail jsonb`,
  `p_participants jsonb`, `p_card_type text`, `p_card_recipient_id uuid`.
- Devuelve JSON `{ foul_event_id: uuid, card_event_id: uuid | null }`.
- `SECURITY INVOKER`, `search_path = ''`, autenticación obligatoria,
  EXECUTE concedido a authenticated y revocado a PUBLIC/anon.
- Reutiliza `log_event` una vez para la falta y otra para la tarjeta opcional.
  No captura excepciones ni separa transacciones: cualquier fallo revierte ambos
  eventos, detalles, participantes, cambio de estado y actividad del análisis.
  Mantiene las políticas RLS, validaciones y triggers existentes.

La tarjeta conserva su propia identidad canónica y enlaza mediante
`card_events.related_foul_event_id`. Comparte análisis, equipo, período y segundo
con la falta al crearse, pero tiene x/y null. La falta conserva su posición.
El sancionado es opcional, se sugiere el infractor mientras no haya una elección
explícita y puede ser otra persona del equipo. Elegir «Sen identificar» es una
selección explícita que no se sustituye por el infractor. Cambiar de equipo o tipo
descarta selecciones incompatibles; guardar limpia la sanción para la próxima falta.

Tarxeta sigue disponible como evento independiente. Editar una tarjeta usa el
editor y `update_event` existentes: el servidor conserva la relación sin que el
cliente la reenvíe. Borrar una falta deja la tarjeta independiente por el FK
`ON DELETE SET NULL`; no hay cascade delete de falta a tarjeta.

## Captura y revisión

- Trece tipos en sus cinco grupos, sticky desde 1001 px, debajo del header de 64 px.
- Vídeo secundario sticky en desktop, show/hide y navegación existentes intactos.
  Móvil/tablet hasta 1000 px usa flujo normal sin sticky en esos paneles.
- Campos y posición comparten columnas donde hay ancho; labels y controles
  mantienen tamaños accesibles. Campo ampliado, acotado para no dominar la captura.
- Marcador prioriza los dos equipos y sus tanteos; conteo debajo como dato secundario.
- Ocho eventos recientes por defecto, cronológicos, ampliables en la misma timeline.
  Una relación que cruza el corte incluye el grupo completo, por lo que puede haber
  más de ocho hechos visibles. Completed muestra la revisión completa.
- La tarjeta ligada se anida bajo la falta y conserva editar, quitar y navegación
  temporal. El conteo sigue incluyendo ambos hechos canónicos.
- Lectura de la relación desde la vista ya existente; participantes de tarjetas en
  lotes de hasta 100 IDs junto a los cambios. No se modifica la vista ni hay N+1.

## Validación

- npm ci, npm audit --audit-level=high: correctos; cero vulnerabilidades.
- npm run lint, npm run build: correctos; se conserva el warning de bundle >500 kB.
- Node: 130 pruebas, incluidas tres regresiones de agrupación/corte de timeline.
- Browser: 54 escenarios en cuatro suites (58 resultados contando suites padre).
  Tagging, UX, auth y ergonomía; red limitada a fixtures locales.
- PostgreSQL 17 local fresh: 27 migrations, siete suites y 348 assertions.
  La suite específica aporta 32 comprobaciones; incluye los tres colores,
  destinatario distinto/opcional, identidad y coordenadas, estado/actividad,
  RLS, completed, rollback, integridad, edición individual y borrado de la falta.

Reproducir browser con Playwright y Chromium externos, sin añadir dependencias:

```sh
node --test tests/auth-browser.mjs tests/tagging-browser.mjs tests/ux-browser.mjs tests/ergonomics-browser.mjs
```

Opcional: `ERGONOMICS_SCREENSHOT_DIR` para regenerar la [galería](screenshots/v2-tagging-ergonomics/README.md).
Las capturas usan datos y vídeo sintéticos, no Supabase remoto. Los controles de
fixture pertenecen al harness, no al producto.

## Revisión visual y límites

Se revisaron desktop con/sin vídeo, falta con tarjeta, relación en timeline y móvil.
Sin nuevas cards, pills decorativas, sombras, gradientes, iconos, animaciones ni
paneles anidados. Se reutilizan tokens, controles y etiquetas del sistema aprobado.

Deuda explícita: la edición posterior de una falta no crea, elimina ni reasigna
su tarjeta. Los dos eventos se editan/eliminan individualmente. No se sincronizan
posteriormente sus tiempos/equipo al editar: la relación identifica el contexto
original, dentro de las restricciones canónicas existentes. No se incorpora
paginación backend ni se cambia analytics. YouTube se prueba con navegación/embed
controlado, no con acceso externo al proveedor. El warning de bundle queda pendiente.
