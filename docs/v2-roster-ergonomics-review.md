# Convocatoria: ergonomía por equipo

Base real de `feat/v2`: `55ca68df4a8c4afc7b7bc85550f39b96d9c9983a`.
Rama: `feat/v2-roster-ergonomics`. Este PR no incorpora el PR de ergonomía de tagging
mientras no forme parte de la base; no hay cambios en tagging, DB, RPCs ni dependencias.

## Cambios

`TeamRoster` representa cada región de equipo con sus convocados, formulario
 temporal y disponibles. `AnalysisWorkspacePage` conserva la carga, agrupación,
mutaciones, protección de completed y navegación. Reutiliza exclusivamente las
operaciones de `data/analysis-workspace.ts`; no crea jugadores persistentes.

- Filas de unos 49 px en desktop (dorsal, nombre, posición traducida y Quitar).
  Nombre y posición admiten varias líneas si son largos; sin truncado de identidad.
- Counts de texto, sin badges; vacío breve con formulario inmediatamente accesible.
- Dos regiones independientes desde 1001 px. Hasta 1000 px se apilan, sin forzar
  alturas iguales. A 390 px la posición ocupa una segunda línea de la fila.
- Temporal con nombre y dorsal opcional, asociado explícitamente a su equipo.
  Borradores separados, retenidos ante fallos y navegación a vídeo y vuelta;
  se limpian al confirmar la escritura, incluso si después falla la recarga.
- Disponibles en filas de mínimo 44 px. Hasta seis se muestran completos; más de
  seis usan un área de scroll de 264 px, accesible también con teclado.
- Continuar aparece sobre los equipos junto a «Vídeo e sincronización», sticky
  debajo del header en desktop. En móvil/tablet fluye normalmente y no tapa filas.
  No se exige un mínimo de convocados.

La compactación secundaria se limita a esa navegación. Se conserva VideoSetupPanel,
orientación, vídeos y sync sin cambiar sus contratos o controles.

## Validación y revisión

- npm ci: OK; npm audit --audit-level=high: cero vulnerabilidades.
- Lint y build: OK. Warning existente de bundle >500 kB conservado.
- Node: 127/127.
- Browser: 54 escenarios, 58 resultados incluyendo cuatro suites padre, todos verdes.
  La nueva suite aporta siete escenarios: densidad/vacío, altas persistentes y bajas,
  temporales por equipo y counts, error/reintento, navegación con 30 convocados,
  responsive/teclado y completed/disponibles largos.
- Sin DB: no se ejecuta PostgreSQL fresh, conforme al alcance solicitado.
- [Capturas sintéticas](screenshots/v2-roster-ergonomics/README.md): desktop ambos
  equipos, rival vacío, convocatoria larga y móvil. Ninguna consulta remota.

Reproducir desde `gaeliza-frontend`, con Playwright/Chromium externos disponibles:

```sh
node --test tests/auth-browser.mjs tests/tagging-browser.mjs tests/ux-browser.mjs tests/roster-browser.mjs
```

Revisión anti-slop: filas y divisores, counts discretos, regiones de altura natural,
sin nuevas cards, sombras, gradientes, pills ni CTA flotante. Se reutilizan tokens
existentes. Las reglas de filas compactas están acotadas a la convocatoria.

## Límites

Los convocados siguen mostrándose completos; solo disponibles numerosos usan scroll
interno. En móvil una convocatoria larga requiere desplazamiento y la acción para
avanzar está arriba; no hay barra superpuesta. Los borradores no sobreviven a una
recarga del navegador, igual que antes. Sin CRUD persistente ni nuevas capacidades
de vídeo. Pendiente únicamente el warning de bundle ya conocido.
