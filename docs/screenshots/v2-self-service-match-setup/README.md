# Nova análise: preparación autosuficiente

Capturas locales con fixtures sintéticos, sin conexión a Supabase remoto. Abrir cada imagen para verla a tamaño completo.

## Cuenta vacía

![Cuenta vacía con acción para crear el primer partido](empty-user.png)

## Crear partido en escritorio

![Equipos personales seleccionados y fecha local](create-match-desktop.png)

## Crear equipos inline

![Borradores independientes de local y visitante](create-team.png)

## Plantel persistente

![Dos jugadores persistentes y formulario mínimo](persistent-roster.png)

## Móvil

![Crear partido a 390 px sin desbordamiento horizontal](mobile.png)

Regenerar desde `gaeliza-frontend` con Playwright disponible:

```sh
SETUP_SCREENSHOT_DIR=../docs/screenshots/v2-self-service-match-setup node --test tests/self-service-browser.mjs
```

El harness acepta `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` para un Chromium instalado localmente.
