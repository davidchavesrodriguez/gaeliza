# Self-service match setup

`Nova análise` conserva la selección de partidos existentes y añade creación personal desde una cuenta vacía, incluida una sesión invitada autenticada. Los equipos local y visitante tienen borradores independientes; crear uno lo selecciona automáticamente. Catálogo y plantel se consultan en páginas de 30 elementos.

El equipo personal se inserta directamente con las políticas existentes. La capa data obtiene el usuario autenticado y fija scope, ownership y referencias nulas: el formulario no proporciona otro propietario. El plantel mínimo permite añadir jugadores persistentes, sin convocarlos automáticamente. El rival puede crearse sin plantel y utilizar jugadores temporales en Convocatoria.

## Migration y contratos

`20261022151520_self_service_match_setup.sql`, creada con Supabase CLI `migration new`, añade:

- `create_team_player(p_team_id uuid, p_first_name text, p_last_name text = null, p_default_number integer = null, p_primary_position text = null) → uuid`: crea jugador del usuario y membership en su equipo personal. Rechaza equipos oficiales/ajenos. Un error en membership revierte también el jugador.
- `create_personal_match_analysis(p_home_team_id uuid, p_away_team_id uuid, p_scheduled_at timestamptz, p_round_label text = null, p_mode text = 'post_match') → {match_id, analysis_id}`: valida equipos distintos, visibles y oficiales o personales propios; crea un match personal scheduled, sin competición/fase/venue; llama a `create_analysis` para crear el análisis privado draft y los dos períodos canónicos. Un fallo incluso al crear períodos revierte todo el conjunto.

Ambas funciones son SECURITY INVOKER, search_path vacío, sin permisos PUBLIC/anon y con EXECUTE para authenticated. No cambian RLS ni usan service_role. Los tests usan dos usuarios, equipos privados conocidos por UUID y rol anon para verificar las restricciones. No se aplicó nada a Supabase remoto.

## Fechas y límites

El control datetime-local representa la zona del dispositivo. Se convierte a un instante ISO UTC y vuelve a mostrarse en hora local. Se prueban Madrid en verano/invierno, Nueva York y Kolkata. Se rechazan fechas imposibles y horas inexistentes durante el salto DST; en la hora repetida de otoño se usa la primera ocurrencia, conforme a Date del navegador. No hay selector de zona ni desambiguación DST adicional en este slice.

No se incluye edición/eliminación del plantel, gestión de clubes/competiciones, importación ni sharing. Los equipos/jugadores creados son recursos persistentes y se conservan si se abandona la preparación del partido. Las RPC son atómicas, pero no incluyen claves de idempotencia para reintentos tras una respuesta de red perdida; la UI bloquea dobles envíos mientras hay una petición pendiente.

## Validación local

- npm ci, audit --audit-level=high, lint, build y npm test.
- 143 pruebas Node; audit: cero vulnerabilidades.
- PostgreSQL 17 aislado, desde cero: 28 migrations, 8 suites, 386 assertions (38 nuevas).
- Browser completo: auth, tagging, UX, ergonomía, convocatoria y self-service; 68 escenarios más sus 6 pruebas contenedoras, 74 resultados verdes.
- Browser usa páginas y módulos data reales con transporte local simulado; la seguridad y atomicidad se comprueban por separado en PostgreSQL real. La validación integrada en Supabase remoto queda para revisión humana.
- Se conserva el warning conocido de bundle >500 kB (~625 kB).

[Galería de capturas](screenshots/v2-self-service-match-setup/README.md).
