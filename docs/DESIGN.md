# Gaeliza — sistema visual y de interacción

Fuente de verdad para Gaeliza v2. Antes de añadir un patrón, comprobar este
documento y reutilizar el existente. La identidad viene del partido: equipos,
marcador gaélico, período, reloj, campo, jugadores, vídeo y hechos canónicos.
No simular actividad, métricas ni resultados para llenar una pantalla.

## Principios

1. La acción de análisis tiene prioridad sobre la decoración y el vídeo.
2. Densidad limpia, con contexto visible y desplazamiento razonable. Reducir
   navegación innecesaria, no esconder controles importantes.
3. Una sección organiza trabajo relacionado; una fila representa un análisis,
   jugador o evento. Card solo para contenido independiente, nunca como layout
   universal ni dentro de otra card.
4. Estado real y lenguaje concreto: qué se guardó, qué falta, qué se puede hacer.
5. Dark es la referencia de diseño. Light usa los mismos componentes y tokens.
   Sin duplicar reglas de componentes por tema.

## Tokens y color

Tokens CSS globales; los estilos de componentes no deben introducir colores
literales de superficie, texto, borde o estado.

| Token | Dark | Light | Función |
| --- | --- | --- | --- |
| `--paper` | `#111619` | `#f3f5f6` | Fondo del producto |
| `--surface` | `#1a2125` | `#ffffff` | Superficie de trabajo/diálogo |
| `--surface-muted` | `#242d32` | `#e8edf0` | Controles secundarios |
| `--ink` | `#edf2f4` | `#172126` | Texto principal |
| `--ink-soft` | `#abb9c1` | `#526269` | Texto secundario legible |
| `--line` | `#3c4b54` | `#c3cfd5` | Divisor y borde de controles |
| `--accent` | `#77dba6` | `#14653f` | Selección/acción/focus/positivo |
| `--accent-strong` | `#a0edc2` | `#0c4a2c` | Hover del acento |
| `--on-accent` | `#10251a` | `#ffffff` | Texto de acción primaria |
| `--accent-soft` | `#19382a` | `#e0f1e7` | Selección, nunca fondo general |
| `--warning` | `#efc576` | `#805000` | Aviso que requiere atención |
| `--danger` | `#ffa79e` | `#a32722` | Error/acción destructiva |
| `--info` | `#a4c5f5` | `#245698` | Información, distinta de éxito |

No convertir warning/error/info a verde. Un campo puede usar verde apagado por
su significado deportivo, pero no colorear todas las superficies de la aplicación.
Sin gradientes, glow, glassmorphism, blur ni imágenes decorativas.

## Tipografía, números y jerarquía

Una única familia de sistema (`system-ui` con fallbacks nativos); sin descargar
fuentes ni familias adicionales. Números tabulares para marcador, reloj, dorsales
y tiempos. Texto de controles 14–16 px, secundario mínimo 12 px, cuerpo 15–16 px.
H1 de app 24–30 px; H2 18–22 px; marcador/reloj 28–36 px. La landing puede usar
un título de hasta 48 px, sin trasladarlo al workspace. Interlineado 1.45–1.6.
Peso 600–700 para selección y jerarquía, no toda la pantalla en negrita.
No usar uppercase/eyebrow encima de cada título. Etiquetas de agrupación normales,
pequeñas y descriptivas. Se permite mayúscula breve en un estado si aporta algo.

## Spacing, radius, borders y shadows

Escala 4, 8, 12, 16, 24, 32 y 48 px; tokens `--space-1` a `--space-7`.
Separación de secciones 24–32 px; filas 12–16 px; campos relacionados 8–12 px.
Radius `--radius-sm: 3px`, `--radius: 6px`; máximo habitual 8 px. Campo rectangular.
Pills solo en estado/filtro/toggle compacto, nunca en todas las acciones.
Borde 1 px. Preferir divisor a un contenedor completo. Los controles usan
`--control-line` (#627985 dark / #7e919c light) para distinguirlos con contraste
no textual suficiente; los divisores usan `--line`. `--shadow: none`; únicamente
un diálogo modal puede separarse del fondo mediante overlay funcional oscuro.

## Surface hierarchy y composición

Fondo neutro → secciones delimitadas → controles/superficie de vídeo → diálogo.
Header compacto y contenido de hasta 1480 px, con gutters 24 px (16 px móvil).
Dashboard como listas de análisis, no grid de tarjetas. Preparación como secciones
y filas de convocatoria; formularios identificables sin cajas anidadas. Los nombres
históricos de clases que contienen `card` no justifican dibujar una card.

## Buttons e inputs

Acción primaria sólida de acento, secundaria neutra con borde, acción textual
cuando tenga menor prioridad; eliminación en color danger. Altura objetivo 40–44 px,
radius 6 px y etiqueta verbal específica. Sin desplazamientos/decoración al hover.
Estado disabled visible y cursor coherente, sin confundirlo con readonly.
Labels visibles asociados; no usar placeholder como label. Inputs con contraste,
foco claro y errores junto al control o formulario. Conservar el borrador tras un
fallo de escritura. Registrar un evento es una acción explícita: no fingir que
cada tecla del borrador se guarda automáticamente.

## Tables/lists e indicadores de estado

Filas con divisores, campos alineados y acciones al final. Un análisis muestra
partido/fecha, estado traducido, última modificación disponible y progreso real
barato si existe; sin porcentajes inventados. «En curso» agrupa draft/in_progress;
«Completadas» es una sección independiente. La etiqueta de actualización y la
paginación usan exclusivamente `analyses.updated_at`, mantenido por la DB para
todo el workspace (convocatoria, períodos, vídeos, sync y eventos, incluidos sus
detalles/roles). No aproximar la actividad leyendo solo el último evento.
Paginación explícita, no truncado oculto.
Estados con texto, no solo color. Guardado discreto y accesible: Gardando… mientras
existe escritura pendiente; Gardado tras confirmación; Erro ao gardar ante fallo.
Un fallo de lectura posterior a un commit se explica como recarga pendiente, no
como escritura fallida. La carga inicial nunca se presenta como un nuevo guardado.

## Navigation y lifecycle

Inicio accesible desde el shell y desde cada análisis. Navegación entre convocatoria,
vídeo y tagging mediante controles reales con selección visible y URL recuperable.
Continuar abre el ID correcto; recargar no cambia silenciosamente de análisis.
Finalizar requiere confirmación: deja readonly, conserva datos y permite reabrir.
Completed mantiene timeline/vídeo y ofrece reapertura explícita, sin dashboard de
analytics inventado. No ofrecer eliminar análisis sin un flujo backend seguro ya
expuesto. La sesión invitada depende de volver desde el mismo navegador.

## Empty, error y loading

Empty compacto: explicar qué falta y una acción concreta. Sin tres tarjetas de
marketing. Loading con texto y `aria-live`, sin skeletons que inventen números.
Error con mensaje y recuperación real (recargar/reintentar), sin ocultar un commit
confirmado. No borrar una lista existente por un fallo de paginación.

## Tagging workspace, timeline y vídeo

Contexto/scoreboard y período/reloj antes que adornos. Controles agrupados:
Principais (tiro, pase, recuperación, perda); Xogo (duelo, regate, bloqueo);
Reinicios (saque de porta, reinicio); Disciplina (falta, tarxeta); Cambios
(substitución, cambio de porteiro). Trece tipos accesibles en desktop con botones
reales y `aria-pressed`, selección inequívoca. Sin trece cards ni carrusel oculto.
Formulario activo reutilizado para captura/edición, identidad física inmutable.
Saque de porta, en captura y edición: origen no solicitado y payload null/null;
destino opcional, incluido 0/0. Al editar un saque con origen anterior, la nueva
escritura lo deja en null/null; decisión confirmada por el usuario (datos de prueba).
No se realiza una limpieza masiva de registros ni cambia el schema.

Desktop: controles/formulario ocupan la mayor parte, vídeo secundario colapsable;
al ocultarlo se recupera el ancho. Timeline como lista de filas compactas posterior
al trabajo activo. En móvil, apilar, sin dos columnas estrechas. Estado de visibilidad
solo en memoria, sin almacenamiento innecesario.

Reutilizar navegación y sync derivados. Directos: HTML5 controls, sin autoplay.
YouTube: embed pequeño solo desde ID/host validado, sin API ni dependencia extra;
inicio/seek derivados, permisos de iframe mínimos y título accesible. Abrir un
recurso externo es explícito. Otros proveedores: original HTTP(S), sin iframe ni
parámetros de seek ficticios. Al ocultar/desmontar un player deja de reproducirse.
Timestamps disponibles para todos los vídeos relevantes y también en completed.
Microcopy junto a sync: «Indica en que instante do vídeo comeza este período»;
ejemplo partido 00:00 / vídeo 03:42, sin tutorial invasivo.

## Landing/public pages y copy

Presentar Gaeliza como herramienta para cuerpos técnicos y analistas de fútbol
gaélico: preparar partido/convocatoria, sincronizar vídeo, registrar y revisar hechos.
Layout editorial, una acción de entrada clara y flujo concreto. Sin porcentajes,
marcadores ficticios, stock, imágenes generadas, capability-card grid, claims de IA
ni frases como «obtén insights» o «leva a análise ao seguinte nivel».
Galego coherente. «Análise» es femenino, también en plural: «Nova análise»,
«As túas análises», «Análise completada/finalizada», «Reábrea» o «reabrila» según
la frase. Mantener concordancia en navegación, estados y errores. Esto no cambia
el género de otros sustantivos: un «Pase completado» sigue siendo masculino.
Enums internos se traducen en un mapping central, nunca en DB. `out_of_play`
se presenta como «Balón fóra»; no «Fóra de xogo», que sugiere offside.
Goalkeeper → Porteiro; Defender → Defensa; Midfield/Midfielder → Centrocampista;
Forward → Dianteiro; Attacker → Atacante. «Saque de porta» evita confundir kickout
con cualquier reinicio. Desconocido se presenta como tal, no como un identificador.

## Motion y accessibility

Sin fade/slide por defecto ni scroll animado obligatorio. Solo spinner de carga
si ayuda, desactivado para `prefers-reduced-motion`. Sin autoplay. Respetar
`prefers-color-scheme` inicialmente; selector persistido puede sobrescribirlo.
Focus visible 2 px con offset, enlaces distinguibles, botones y links según acción,
labels, nav landmarks, heading order y `aria-current`/`aria-pressed` donde aporten
semántica. Confirmación con foco atrapado por diálogo nativo, Escape/cancelar y
retorno al control que lo abrió. Objetivo WCAG AA en ambos temas; revisar contraste
con colores calculados, teclado y tamaños desktop/móvil en navegador.

## Anti-slop checklist de cada revisión

- ¿Se puede sustituir una card por una sección/fila/divisor? ¿Hay cajas anidadas?
- ¿Radius, sombra, eyebrow o grid simétrica tienen una función real?
- ¿El espacio sigue la prioridad de tagging y contexto del partido?
- ¿Verde indica una selección/acción/estado y no colorea todo?
- ¿Hay copy genérico, enums sin traducir o datos ficticios?
- ¿La identidad viene del campo, reloj, equipos y eventos?
- ¿El estado de persistencia coincide con la respuesta real de la mutación?
- ¿Volver, continuar, finalizar y reabrir son reconocibles con teclado?
- ¿Vídeo oculto devuelve espacio? ¿Móvil conserva controles legibles?
- ¿Ambos temas, contraste, focus y reduced-motion siguen funcionando?

Decisiones visuales ambiguas: preferir la solución funcional más simple. Documentar
excepciones concretas en el informe del slice; no inventar un patrón ornamental.
