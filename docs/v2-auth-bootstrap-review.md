# Auth v2: bootstrap ordenado y recuperación

Rama `fix/v2-auth-bootstrap`, creada desde el HEAD verificado de `feat/v2`:
`c013cb880a9ac114a12b00cd1ef6fc5b7ca2dd5a`. Sin cambios en dependencias,
Dashboard, DB, RLS, configuración de Auth, StrictMode ni código legacy.

## Diagnóstico y límite de la evidencia

El efecto anterior llamaba a `getSession()` y registraba inmediatamente
`onAuthStateChange()`, antes de terminar la recuperación inicial. StrictMode
repetía ese lifecycle. El listener inicial y el getSession podían escribir el
mismo estado inicial desde rutas independientes. Un error de getSession dejaba
además status `ready`; RequireSession no comprobaba ese error antes de iniciar
la creación de invitado.

Se inspeccionó la versión instalada real: `@supabase/supabase-js` y `auth-js`
2.118.0. Su inicialización ya comparte una promesa, encola notificaciones durante
la recuperación y, sin lock personalizado, usa el camino sin el lock legado.
`onAuthStateChange` aún realiza su propia emisión INITIAL_SESSION al registrarse.
No hay evidencia para atribuir la espera observada de 1–2 minutos a un deadlock
histórico concreto. No se reprodujo esa duración exacta contra el servicio real;
no se accedió a Supabase remoto. El solapamiento innecesario de la aplicación sí
está confirmado y se elimina; la defensa de timeout es adicional.

## Lifecycle

`session-bootstrap.ts` concentra el contrato, sin React ni APIs privadas del SDK:

1. Publicar `loading` y resolver `getSession()`.
2. Ante éxito, publicar `ready` con la sesión inicial, incluida sesión null.
3. Registrar un único listener del provider para cambios posteriores.
4. Ignorar INITIAL_SESSION porque su estado ya se resolvió arriba. El callback
   es síncrono y solo publica estado; no llama ni espera métodos Auth.
5. Ante fallo devuelto/rechazo, publicar `error`, sin registrar un listener ni
   intentar sustituir la identidad.

Un solo getSession en vuelo se comparte entre el replay de StrictMode, remounts
y retry mientras siga pendiente. Cada intento tiene su propia vigencia y timer;
un intento desmontado o agotado no puede publicar estado ni registrar listeners.
El cleanup es idempotente: retry y el cleanup del efecto desuscriben una sola vez
el listener de ese intento y eliminan su timer. El provider
protege también las resoluciones asíncronas de guest/signOut por generación.

La aplicación conserva la instancia singleton existente de Supabase. No crea
nuevos clientes ni toca los listeners internos del SDK en producción.

## Timeout y retry

Fallback de 15 segundos, eliminado al resolver getSession o desmontar el intento.
No retrasa la llamada ni actúa como mecanismo de serialización. Al vencer, sale
del spinner y muestra «Non foi posible recuperar a sesión.» con «Tentar de novo».
Una respuesta tardía no cambia ese error por sí sola.

Retry invalida inmediatamente el intento anterior, vuelve a loading y ejecuta
otro bootstrap con un nuevo presupuesto de 15 segundos. Si la recuperación
subyacente ya terminó se hace una lectura nueva. Si sigue pendiente se comparte
esa recuperación, evitando llamadas concurrentes adicionales. getSession no
expone cancelación pública: no se finge abortarlo ni se reinicia el cliente.
Si el SDK nunca resuelve, no puede garantizarse éxito; la UI vuelve a error
recuperable en lugar de quedar indefinidamente en el spinner.

RequireSession solo crea invitado tras `ready`, sesión null y ausencia de error.
La deduplicación abarca la secuencia completa de lectura/creación, incluyendo
efectos dobles. Retry recupera primero la sesión; no fuerza signOut, no limpia
storage ni crea identidades nuevas en cada reload. Las opciones persistSession,
autoRefreshToken y detectSessionInUrl permanecen intactas.

## Regresiones y validación

- Diez pruebas Node nuevas del contrato: sesión existente/null, deduplicación,
  recuperación lenta, returned error/rechazo, timeout, late results, retry antes
  y después de resolver, cambios posteriores y cleanup. Timers simulados, sin
  esperas de 15 segundos ni mocks de internals privados del SDK.
- Nueve escenarios de navegador nuevos con AuthProvider, RequireSession, router
  y Dashboard reales bajo StrictMode. Incluyen error/timeout/retry, remounts,
  eventos posteriores, retry de creación de invitado fallida y persistencia de
  identidad al recargar.
- El caso de integración usa el SDK real con una sesión anonymous expirada en
  storage y un endpoint Auth **local**: retiene el refresh, responde HTTP 200 con
  token renovado para el mismo usuario y verifica entrada inmediata al Dashboard.
  Landing funciona mientras Auth está pendiente, no hay consultas al Dashboard
  antes de recuperar Auth, no se crea otro invitado y el reload posterior no
  repite el refresh. Los fallos restantes se inyectan mediante las APIs públicas.
- Se mantienen los 27 escenarios de tagging y 11 de UX anteriores. Solo cambia
  una propiedad de su fixture AuthContext para reflejar el contrato de retry.

Validación final local: `npm ci`, `npm audit --audit-level=high` (0
vulnerabilidades), lint, build y **127/127** pruebas Node. Browser: **47 escenarios,
50/50 resultados** incluyendo sus tres tests padre. Persiste el warning conocido
del bundle >500 kB (~611 kB), sin cambiar límites. PostgreSQL no se ejecuta:
ningún schema, migration, payload deportivo ni acceso a DB cambia.

Reproducción desde `gaeliza-frontend`:

```sh
npm ci
npm audit --audit-level=high
npm run lint
npm run build
npm test
node --test tests/auth-browser.mjs
node --test tests/tagging-browser.mjs
node --test tests/ux-browser.mjs
```

Los browser smoke requieren Playwright y Chromium como herramientas externas del
entorno, sin añadirlos a las dependencias. Si es necesario, indicar
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.
