# Gaeliza v2 — auditoría visual y de interacción

Fecha: 22 de octubre de 2026. Base revisada: `feat/v2`, `0b92de556f340adbe2e217a74806594a23fdf23b`.
Estado: **propuesta para revisión humana; no implementada**. [DESIGN.md](DESIGN.md) sigue siendo la fuente de verdad. Este documento propone precisiones de composición, no sustituye sus reglas ni autoriza cambios funcionales.

Lectura recomendada: resumen y diagnóstico (§1–3), decisiones por pantalla (§4), sistema propuesto (§5–19), wireframes (§20), riesgos y plan de revisión (§21–24).

## 1. Executive summary

La principal causa de «Excel premium» es **la equivalencia visual entre contexto deportivo, controles de captura y mantenimiento de registros**. El producto ya tiene objetos propios del fútbol gaélico, pero los distribuye como secciones de configuración: equipos duplicados entre título y marcador, tiempo dentro del formulario, líneas de igual intensidad delimitando casi todo y acciones repetidas en cada registro. El problema no se resuelve con otra fuente, una paleta nueva o más imágenes de deporte.

Recomiendo **Mesa de análisis de partido / Tactical Workstation**: un contexto compacto y conjunto de equipos, marcador analítico y referencia temporal; debajo, una estación de captura con acción, detalle y campo; vídeo auxiliar; secuencia de jugadas posterior. La palabra workstation describe prioridades y continuidad durante una sesión larga, no una estética de consola.

Cinco decisiones de mayor impacto:

1. Reunir equipos y resultados en un bloque legible de un vistazo; dar al período/tiempo del borrador una posición estable, sin inventar un reloj en directo.
2. Reducir la altura acumulada del shell, avisos, marcador y títulos antes de llegar a la captura. Recuperar espacio para trabajar, no para añadir paneles.
3. Dar a acción y resultado más peso que a campos de enriquecimiento; conservar los trece tipos visibles en desktop y todos sus campos disponibles.
4. Integrar campo y coordenadas como una única herramienta espacial, manteniendo entrada numérica accesible y semántica actual.
5. Transformar la lectura de timeline de registros altos con acciones repetidas a secuencia compacta de tiempo → acción → protagonistas → resultado, sin perder edición, enlaces ni independencia de falta/tarjeta.

Cambian más tagging, contexto del workspace y timeline. Cambian moderadamente Nova análise y vídeo. Convocatoria conserva sus dos listas independientes; Landing y Dashboard requieren ajustes de jerarquía, no reconstrucción.

## 2. Método, evidencia y diagnóstico «Excel premium»

### Evidencia visual inspeccionada

Se abrieron individualmente las 14 imágenes solicitadas; no se dedujo su apariencia de nombres de clases:

| Clave | Capturas del repositorio | Lo que permiten juzgar |
| --- | --- | --- |
| T1–T5 | [desktop-video](screenshots/v2-tagging-ergonomics/desktop-video.png), [desktop-no-video](screenshots/v2-tagging-ergonomics/desktop-no-video.png), [foul-with-card](screenshots/v2-tagging-ergonomics/foul-with-card.png), [linked-timeline](screenshots/v2-tagging-ergonomics/linked-timeline.png), [mobile](screenshots/v2-tagging-ergonomics/mobile.png) | Captura, distribución campo/formulario, vínculo disciplinario, longitud móvil |
| R1–R4 | [desktop-both-teams](screenshots/v2-roster-ergonomics/desktop-both-teams.png), [desktop-empty-rival](screenshots/v2-roster-ergonomics/desktop-empty-rival.png), [desktop-long-roster](screenshots/v2-roster-ergonomics/desktop-long-roster.png), [mobile](screenshots/v2-roster-ergonomics/mobile.png) | Filas, desequilibrio real de planteles, CTA y longitud |
| N1–N5 | [empty-user](screenshots/v2-self-service-match-setup/empty-user.png), [create-match-desktop](screenshots/v2-self-service-match-setup/create-match-desktop.png), [create-team](screenshots/v2-self-service-match-setup/create-team.png), [persistent-roster](screenshots/v2-self-service-match-setup/persistent-roster.png), [mobile](screenshots/v2-self-service-match-setup/mobile.png) | Preparación autosuficiente y disclosures existentes |
| F1–F5 | [landing-dark](screenshots/v2-ux-design-foundation/landing-dark.png), [dashboard-dark](screenshots/v2-ux-design-foundation/dashboard-dark.png), [workspace-completed-dark](screenshots/v2-ux-design-foundation/workspace-completed-dark.png), [tagging-desktop-dark](screenshots/v2-ux-design-foundation/tagging-desktop-dark.png), [tagging-desktop-light](screenshots/v2-ux-design-foundation/tagging-desktop-light.png) | Shell completo, lectura/reapertura, equivalencia de temas; tagging histórico |

Las capturas T son fixtures parciales: «Complete fixture» y «Gaeliza · Fixture local» **no son UI de producto que haya que rediseñar**. F4/F5 preceden a mejoras ergonómicas posteriores: su campo pequeño no se presenta como defecto aún intacto. Se contrastó el estado actual ejecutando el harness UX existente contra transporte local, sin cambiar archivos de tests ni código productivo. Se inspeccionó visualmente el render actual de tagging y de **Vídeo e sincronización**, incluyendo orientación, tres fuentes, sync points y formulario de tiempos. La observación temporal se guardó solo en `/tmp`, no como asset del PR. El recorrido existente completó 12 resultados verdes; esto no valida la propuesta futura.

Lectura auxiliar de los componentes actuales para comprobar qué controles/datos existen: `VideoSetupPanel`, shell del workspace, scoreboard, timeline, pitch y formularios. No se consultó Supabase remoto. Las capturas son sintéticas: ni nombres repetidos ni vídeo negro prueban un problema de producción. No hay estudio con usuarios, medición ocular ni sesión observada de 120 minutos: los efectos sobre velocidad/fatiga son hipótesis de diseño a validar.

### Hipótesis contrastadas

| Sospecha | Dictamen | Evidencia y consecuencia |
| --- | --- | --- |
| Uniformidad excesiva de controles | Confirmada en captura/setup | T1/N2: selectores, búsqueda y acciones auxiliares compiten con igual borde y altura. Diferenciar roles, no eliminar affordances de inputs. |
| Demasiadas cards | No como causa dominante | R/N/T usan superficies abiertas. No recomendar otra campaña genérica de «quitar cards». |
| Separación lineal homogénea | Confirmada | T4/R3/F2: divisores regulares producen ritmo de registro. Reservar líneas para cambio de región o tracking de filas que lo necesiten. |
| Jerarquía tipográfica inexistente | Descartada; insuficiente localmente | H1, nombres y marcador ya cambian de tamaño. F2 tiene jerarquía básica; T1 aísla físicamente las cifras y no destaca el tiempo. |
| Falta de objetos deportivos | Parcial | Campo, dorsal y score existen. Pierden relación entre sí; no faltan ilustraciones. |
| Exceso de flujo vertical | Confirmado | T5 y R4 son páginas largas; F shell + T controles empujan captura hacia abajo. R4 tiene 30 jugadores reales: no todo scroll es desperdicio. |
| Densidad siempre demasiado alta | Descartada | N1 y T2 tienen aire abundante; T timeline tiene poca información por altura. El problema es asignación desigual. |
| Simetría administrativa | Parcial | N3 justifica local/visitante; R3 no necesita rellenar la columna corta. No eliminar dos columnas por principio. |
| Pitch como input grande | Parcial, ya mejorado | T2 lo amplía y lo acerca al formulario; X/Y siguen pareciendo dos campos adicionales y falta una relación visual inequívoca con el evento activo. |
| Timeline CRUD | Confirmada | T4: «Editar/Quitar» repetidos, saltos de vídeo largos, mucha altura por evento; la relación falta/tarjeta ya ofrece una buena excepción. |
| CTA equivocado | Localizado | Guardar está bien identificado. Finalizar en shell y múltiples secundarios ocupan atención; en N1 la acción útil de crear el primer partido parece secundaria ante un submit deshabilitado. |
| Navegación tipo configuración | Parcial | Las tres etapas son comprensibles y recuperables; pesan demasiado junto a varios encabezados antes de capturar. |
| Poca distinción de zonas | Confirmada | Contexto, metadatos y edición comparten fondo/ritmo. Resolver por posición y agrupación primero, surface solo en herramienta auxiliar. |

## 3. Qué funciona y debe sobrevivir

- Una familia de sistema, base neutral, verde limitado, ausencia de efectos decorativos y copy del deporte.
- Marcador gaélico real derivado de eventos; nunca sustituirlo por una cifra agregada o por resultado oficial supuesto.
- Trece acciones agrupadas, un formulario activo, guardado explícito y vídeo ocultable que devuelve espacio.
- Timeline con ocho eventos iniciales y acceso explícito al resto; vínculo falta/tarjeta sin fusionar sus identidades.
- Convocatoria en filas con dorsal/nombre/posición, equipos independientes y temporales; continuar accesible sin recorrer todo el plantel.
- Nova análise utilizable sin datos sembrados, rival sin plantilla obligatoria, creación inline y borradores separados.
- Dashboard como listas ordenadas por actividad del agregado; completed conserva lectura y reapertura explícita.
- Accesibilidad y errores reales: labels, foco, teclado, borradores tras fallo y ningún guardado simulado.

## 4. Auditoría por pantalla

Prioridades: **P0** estructura que condiciona la captura repetida; **P1** preparación/continuidad; **P2** pulido de lectura. Son prioridades de diseño, no bugs técnicos ni permisos de implementación.

### 4.1 Landing — P2 (F1)

- **Current perception:** editorial sobria y honesta; explica una herramienta, aunque casi todo son instrucciones.
- **What works:** un CTA claro, audiencia concreta, ninguna métrica inventada.
- **Why it feels administrative:** secuencia numerada + párrafo inferior repiten explicación del proceso; no es el principal origen del problema.
- **Hierarchy problem:** debe leerse propósito → entrada → funcionamiento. Ya ocurre, pero «Abrir aplicación» compite ligeramente con el CTA principal.
- **Proposed direction:** mantener dos regiones asimétricas; condensar la explicación inferior cuando repite captura/revisión, dando más proximidad a la entrada invitada.
- **Remove / de-emphasize:** borde/peso del acceso secundario superior; texto redundante, sin borrar advertencia de sesión invitada.
- **Emphasize:** «Comezar unha análise», seguido del alcance real de la herramienta.
- **Keep:** título, sistema tipográfico, ausencia de hero con estadísticas y flujo concreto.
- **Risk:** simplificar demasiado puede ocultar qué hace el producto; conservar los tres verbos preparar/sincronizar/registrar.
- **Priority:** P2; no introducir un mockup o asset nuevo para arreglarlo.

### 4.2 Dashboard — P1 (F2)

- **Current perception:** lista limpia de expedientes, reconocible pero con tres columnas equivalentes.
- **What works:** grupos En curso/Completadas, partido en negrita, timestamp y continuidad real.
- **Why it feels administrative:** badge de estado + fecha relativa en columna separada, botón enmarcado por fila y separadores con igual fuerza.
- **Hierarchy problem:** partido/rival → fecha/identidad del análisis → estado/continuar; hoy el botón derecho pesa casi tanto como el partido y la recencia queda lejos.
- **Proposed direction:** fila de dos líneas, identidad arriba; debajo fecha del partido y contexto existente. Agrupar actualización y continuidad a la derecha, sin columna autónoma de badges.
- **Remove / de-emphasize:** caja de cada CTA repetido y borde del estado; mantener enlace explícito, no toda la fila como un control ambiguo.
- **Emphasize:** nombre del encuentro y primer análisis del orden real, sin convertirlo en hero.
- **Keep:** listas, paginación, orden por `analyses.updated_at`, estado textual, conteos reales.
- **Risk:** «dónde lo dejé» no equivale a último tab visitado; usar solo modo, estado, vídeo/eventos existentes. No añadir tracking ni inventar progreso.
- **Priority:** P1 por frecuencia de reentrada; pulido posterior al tagging.

### 4.3 Nova análise — P1 (N1–N5)

- **Current perception:** formulario funcional con dos formularios de equipos dentro; permite arrancar pero el encuentro aún no domina.
- **What works:** dos caminos claros, equipo seleccionado tras crear, plantel opcional, vacío con salida.
- **Why it feels administrative:** al seleccionar ambos equipos siguen dominando búsqueda/select y crear; abrir plantel desplaza fecha y confirmación muy abajo (N4).
- **Hierarchy problem:** encuentro → cuándo/cómo → preparación opcional. Hoy búsqueda de catálogo precede visualmente a la identidad elegida.
- **Proposed direction:** encabezado de cada lado muestra el nombre seleccionado con «Cambiar equipo»; búsqueda/creación se despliegan en ese lado. Debajo, fecha y modo; plantel es una rama opcional claramente local.
- **Remove / de-emphasize:** ayuda alineada al extremo derecho, doble divisor en vacío, etiqueta opcional con ancho comparable a fecha.
- **Emphasize:** Local/Visitante y nombres; CTA de primer partido en vacío, Crear análise cuando el encuentro está preparado.
- **Keep:** campos visibles al editar, controles nativos, drafts independientes, persistencia y semántica de cancelación actuales.
- **Risk:** disclosure puede esconder cambios; nunca colapsar errores ni drafts activos automáticamente ni hacer que crear rival parezca exigir jugadores.
- **Priority:** P1.

### 4.4 Workspace shell — P0 (R1, F3 y render actual)

- **Current perception:** cabecera de ficha seguida de navegación y otra cabecera deportiva.
- **What works:** volver a Inicio, URL recuperable, estado de guardado y finalizar/reabrir explícitos.
- **Why it feels administrative:** título de partido, estado, aviso, navegación, marcador y título de registro consumen franjas sucesivas.
- **Hierarchy problem:** encuentro → tarea activa → estado auxiliar. Hoy lifecycle y navegación preceden a todo el contenido deportivo.
- **Proposed direction:** en tagging, unificar identidad del encuentro con score; navegación compacta debajo. En setup, mantener título sin score innecesario. Ubicar guardado en espacio reservado cercano al trabajo para evitar saltos de layout.
- **Remove / de-emphasize:** segundo título redundante del partido y «Rexistro de eventos» cuando el contexto de captura ya es inequívoco; Finalizar queda secundario visible.
- **Emphasize:** contexto conjunto, etapa activa y estado completed cuando impide editar.
- **Keep:** rutas, confirmación, foco del diálogo, volver, avisos que requieren acción.
- **Risk:** compactar puede ocultar errores/reapertura; banners de error y completed tienen prioridad sobre metas de altura.
- **Priority:** P0, especialmente por su coste vertical acumulado.

### 4.5 Convocatoria — P1 (R1–R4)

- **Current perception:** hoja de equipo útil, ya más cercana al deporte que otras pantallas.
- **What works:** dorsal ancla la fila, nombres fuertes, columnas independientes, rival vacío no bloquea.
- **Why it feels administrative:** cada fila tiene divisor largo y «Quitar» coloreado; la posición ocupa una columna visualmente muy separada del nombre.
- **Hierarchy problem:** equipo → dorsal/jugador → convocado/disponible → operación. La columna destructiva repetida atrae atención antes que el estado.
- **Proposed direction:** nombre y posición en un bloque; dorsal con columna corta constante; quitar textual discreto con nombre accesible contextual. Separar Convocados/Dispoñibles por título/espacio, no por cajas.
- **Remove / de-emphasize:** intensidad de divisores, prominencia de quitar; no quitar filas para lograr simetría.
- **Emphasize:** equipo y conteo adyacente, dorsal, nombre, condición de disponible.
- **Keep:** altura aproximada actual de 49 px, CTA Continuar accesible, formulario temporal independiente y sin player cards.
- **Risk:** bajar demasiado contraste impide seguir una fila larga; conservar separador sutil en planteles densos y focus de fila al interactuar.
- **Priority:** P1; no rediseño completo.

### 4.6 Vídeo e sincronización — P1 (render actual)

- **Current perception:** tres bloques consecutivos de configuración: orientación, fuentes, sincronización.
- **What works:** explicación partido 00:00 ↔ vídeo 03:42, proveedores explícitos, puntos listados y carácter opcional en directo.
- **Why it feels administrative:** lectura vertical de biblioteca y puntos antes de los controles; largas filas con quitar al extremo; todos los encabezados compiten.
- **Hierarchy problem:** fuente → relación entre relojes → orientación del período. Hoy orientación es primer bloque y la relación temporal llega al final.
- **Proposed direction:** fuente y formulario de sincronización próximos; presentar los dos tiempos en una línea relacional etiquetada. Orientación permanece visible como sección compacta por período después de la tarea temporal, sin recalcular posiciones.
- **Remove / de-emphasize:** bordes repetidos y metadatos de duración; añadir fuente secundaria se despliega cuando ya hay una, con errores siempre visibles.
- **Emphasize:** vídeo seleccionado, período, pareja de tiempos y acción de añadir punto.
- **Keep:** múltiples fuentes/puntos, precisión actual, enlaces originales y flujo directo sin vídeo.
- **Risk:** la flecha visual puede sugerir sincronización automática; mantener texto «Indica…» y confirmación explícita. No proponer nuevo player en setup ni auto-sync.
- **Priority:** P1.

### 4.7 Tagging — P0 (T1/T2, render actual)

- **Current perception:** formulario de registro con vídeo lateral; el dominio se reconoce pero exige recorrer muchas franjas.
- **What works:** grupos de acciones, campo junto a detalles, botón Guardar, vídeo secundario recuperable.
- **Why it feels administrative:** quince o más rectángulos de controles similares; la estructura visual enumera campos antes que la jugada.
- **Hierarchy problem:** partido/tiempo → acción → detalles/campo → vídeo → secuencia. El tiempo aparece al mismo nivel que técnica y las acciones están lejos del score.
- **Proposed direction:** layout medido de §12, contexto compacto, selección de acción estable, cuerpo activo de dos subregiones y herramienta de vídeo contenida.
- **Remove / de-emphasize:** título de registro redundante, instrucciones de persistencia repetidas, borde completo de botones no seleccionados de tipo.
- **Emphasize:** selección de acción, resultado/roles específicos y Guardar; campo como parte de la misma jugada.
- **Keep:** los trece tipos y agrupaciones semánticas, captura explícita, mismos campos y validaciones.
- **Risk:** un diseño demasiado compacto hace difícil tocar/leer; límites de tamaño y fallback de columnas son obligatorios.
- **Priority:** P0, principal cambio del producto.

### 4.8 Event form — P0 (T1/T3)

- **Current perception:** matriz de selects; falta/tarjeta introduce una relación útil pero se lee como dos filas adicionales.
- **What works:** labels claros, desconocido permitido, sanción opcional, capturar/editar reutiliza estructura.
- **Why it feels administrative:** equipo/período/tiempo y técnica/situación se ven equivalentes; no hay énfasis del verbo activo frente a su enriquecimiento.
- **Hierarchy problem:** identidad temporal → qué ocurrió → quién/dónde → detalle opcional. Debe evitarse confundir esa jerarquía de lectura con un cambio del orden lógico o de obligatoriedad.
- **Proposed direction:** tiempo/período en banda del borrador; debajo título de acción con equipo y sus campos prioritarios; técnica/situación siguen visibles pero con agrupación secundaria. Falta y sanción en una agrupación verbal compacta, sancionado solo cuando corresponda como ahora.
- **Remove / de-emphasize:** ayudas repetidas y labels opcionales que dominan; no colapsar todos los campos «avanzados» por defecto.
- **Emphasize:** acción que se va a guardar, equipo, resultado y roles; edición con título «Editar…», cancelar y confirmación específica.
- **Keep:** datos/orden de guardado, null/desconocido, errores y borrador; no asignar defaults para mejorar la captura visual.
- **Risk:** mover el reloj al encabezado puede hacer creer que gobierna vídeo o partido; etiquetar «Tempo do evento», nunca animarlo.
- **Priority:** P0.

### 4.9 Pitch — P0 (T1–T3)

- **Current perception:** campo reconocible y ya suficientemente grande sin vídeo; con vídeo compite con varios controles.
- **What works:** geometría, posición seleccionada, inputs X/Y y Limpar.
- **Why it feels administrative:** título «Posición… / escala 0–100» y dos inputs tienen la gramática de un fieldset más; falta proximidad semántica al evento activo.
- **Hierarchy problem:** objeto espacial → posición/origen-destino → edición exacta. Los números técnicos se ven casi tan importantes como el campo.
- **Proposed direction:** etiqueta específica de evento/origen/destino, campo proporcional, coordenadas compactas inmediatamente debajo; propuesta detallada §14.
- **Remove / de-emphasize:** repetición de «escala 0–100» como cabecera dominante, no la información necesaria ni los controles numéricos.
- **Emphasize:** marca seleccionada y rol espacial sin usar exclusivamente color.
- **Keep:** orientación y coordenadas actuales, rectángulo, accesibilidad numérica y ausencia de ornamento.
- **Risk:** una cancha más «deportiva» puede sugerir coordenadas transformadas o una escala distinta; no girar ni reflejar datos.
- **Priority:** P0 como parte del tagging, no proyecto gráfico separado.

### 4.10 Timeline — P0 (T4/F3)

- **Current perception:** historial de registros con un vínculo disciplinario prometedor.
- **What works:** tiempo, tipo, equipo, resultado, enlace a vídeo y vínculo por sangría.
- **Why it feels administrative:** títulos y botones repetidos, línea de vídeo extensa por fila, poca relación temporal más allá de la columna hora.
- **Hierarchy problem:** período/tiempo → acción y protagonistas → resultado → revisión. «Editar/Quitar» forma otra columna tan persistente como el contenido.
- **Proposed direction:** filas de dos líneas como máximo en caso simple; gutter de tiempo estable y separadores de período; vínculo explícito textual y sangría moderada.
- **Remove / de-emphasize:** caja de contador, prefijo largo repetido «Ir ao vídeo» en todas las fuentes; conservar nombre del destino y precisión del salto.
- **Emphasize:** secuencia, jugada activa al editar y enlace temporal distinguible del tiempo de partido.
- **Keep:** orden actual, ocho iniciales, mostrar anteriores, todas las fuentes, identidad de eventos independientes.
- **Risk:** agrupar visualmente puede implicar borrado en cascada o esconder empate temporal; aclarar vínculo y mantener orden estable.
- **Priority:** P0 después del cuerpo de captura.

### 4.11 Mobile workspace — P0 (T5/R4/N5)

- **Current perception:** desktop apilado; no desborda pero requiere desplazamiento prolongado.
- **What works:** nombres legibles, controles nativos, una columna y navegación accesible.
- **Why it feels administrative:** cinco grupos de acciones ocupan altura antes del formulario; cada select tiene una fila; vídeo queda después de toda la captura y antes de la timeline.
- **Hierarchy problem:** contexto mínimo → acción actual → captura → herramientas. La misma expansión de desktop exige pasar por todo para cambiar de tarea.
- **Proposed direction:** cabecera reducida, selector compacto de acción móvil y contenido de captura en flujo; vídeo auxiliar plegable y timeline posterior (§19).
- **Remove / de-emphasize:** sticky acumulados, trece botones siempre expandidos, metadatos de cabecera en filas propias.
- **Emphasize:** acción actual, tiempo del evento, Guardar alcanzable después de campos; rival accesible sin recorrer 30 jugadores locales.
- **Keep:** sin bottom nav nueva, sin carrusel de acciones, sin scroll horizontal y acceso a todos los tipos.
- **Risk:** ocultar opciones reduce descubribilidad; mostrar nombre de acción y label explícito «Acción», nunca menú de puntos genérico.
- **Priority:** P0 para captura; roster móvil P1.

## 5. Dos direcciones conceptuales

| | A — Mesa de análisis de partido | B — Cuaderno editorial de análisis |
| --- | --- | --- |
| Filosofía | Contexto estable, captura repetible y herramientas cercanas | Lectura de encuentro y secuencia como documento, edición contextual |
| Tagging | Banda partido/tiempo; acción y detalle/campo a izquierda; vídeo auxiliar a derecha | Encabezado de encuentro amplio; secuencia protagonista; formulario como bloque de edición entre lectura y vídeo |
| Dashboard | Lista de encuentros, actualización junto a continuidad; ritmo compacto | Lista con fecha más prominente, títulos mayores y más espacio entre encuentros |
| Fortaleza | Reduce viaje visual en sesiones de captura de 60–120 minutos; conserva vídeo ocultable | Favorece revisión pausada y explicación del partido; continuidad editorial con Landing |
| Riesgo | Densidad excesiva o falsa consola deportiva | Alarga captura, desplaza formulario y privilegia lectura sobre registro; puede exigir interacciones nuevas |

No se proponen diez variantes ni temas de marca. B es una alternativa de jerarquía, no un nuevo modo de producto.

## 6. Dirección recomendada y referencias de criterio

**Elegir A.** La ventaja diferencial ya implementada es registrar/revisar hechos del partido con campo, participantes y vídeo. Priorizar un cuaderno editorial ahora perjudicaría esa tarea repetida. Adoptar de B solo el principio de lectura clara para Landing y listas, no su layout de tagging.

La hipótesis Tactical Workstation es correcta con dos matices: el marcador es **analítico**, no oficial; el tiempo visible es la referencia del evento/borrador, no un cronómetro de partido nuevo. El campo no debe dominar una acción que no necesita ubicación. El vídeo puede ser perceptivamente llamativo por su contenido, pero no recibe más espacio que la captura solo para parecer profesional.

Referencias conceptuales, **sin afirmar inspección de sus interfaces actuales ni aplicar un skill externo**: los principios aportados de unslop-ui-skill / Unslop my UI y Refactoring UI orientan a eliminar énfasis antes de añadirlo. Linear aporta separación de contexto/acción secundaria, no su sidebar ni sus atajos. Fey inspira lectura densa, no paneles de cotización. Strava aporta identidad del hecho deportivo, no feed/social. Apple Fitness aporta jerarquía numérica, no anillos/métricas hero. Oura aporta resumen/contexto/detalle, no puntuaciones nuevas. No se copiaron fuentes, código, dependencias ni branding; no se hizo investigación web de esos productos.

## 7. Gramática visual reutilizable

Las medidas son objetivos de diseño para prototipar, no cambios de tokens autorizados. La jerarquía se obtiene primero por posición y proximidad, después por peso/tamaño; color es un refuerzo.

| Rol | Posición, tamaño y espacio | Contraste/peso | Surface, borde y acento |
| --- | --- | --- | --- |
| Product shell | Arriba, 48–56 px desktop; gutters actuales | Marca 16–18/600, nav 14–16 | Fondo paper; un límite inferior, sin caja; selección con subrayado |
| Match context | Una región conjunta antes de trabajar; 80–96 px objetivo desktop | Equipos 18–22/600, score 32–36/700 | Sin card; neutro, no nombres verdes |
| Primary workspace | Mayor ancho disponible; grupos a 16–24 px | Acción 18–20/600; cuerpo 15–16 | Fondo abierto; un límite con timeline |
| Secondary tool | Columna de 360–400 px para vídeo cuando cabe | Título 16/600, metadata 12–13 | Surface solo del instrumento; no recuadro adicional alrededor de todo |
| Data list | Filas alineadas, ritmo según tarea | Nombre 15–16/600, secundario 13 | Divisor sutil cuando ayuda a seguir fila; no cajas completas |
| Metadata | Junto al dato que aclara, gap 4–8 | 12–13/400, ink-soft | Sin pill, sin verde por defecto |
| Status | Cerca de acción/encuentro; espacio reservado | 13–14, texto inequívoco | Warning/error/info conservan semántica; color nunca único indicador |
| Primary action | Al cierre del trabajo activo, cerca de campos | 14–16/600, target 44 px | Acento sólido, una acción dominante por contexto activo |
| Secondary action | Junto al objeto afectado | 14/400–600, target 40–44 | Texto/enlace para bajo peso; borde cuando inicia una operación relevante |

«Una acción dominante» no significa prohibir Guardar equipo cuando el usuario tiene ese subformulario abierto. En ese momento Crear análise no compite con él: sigue visible como siguiente objetivo, pero no recibe énfasis adicional. No deshabilitar funciones por estética.

## 8. Tipografía

**Mantener una sola familia system-ui.** El defecto observado es la distribución de roles, no falta de una fuente distintiva. No hay necesidad funcional que justifique descarga, fallback adicional o una segunda familia.

| Texto | Objetivo desktop / móvil | Tratamiento |
| --- | --- | --- |
| Team names en contexto | 18–22 / 16–18 px | 600; nombres reales, no uppercase obligatorio; permitir dos líneas |
| Score gaélico | 32–36 / 28–32 | 700, tabular; bloques compactos adyacentes |
| Clock del evento | 24–28 / 22–24 | 600, tabular; label de 12–13 que evita ambigüedad |
| Heading | H1 app 24–28, sección 18–20 | 600–700; un H1 semántico, no varios títulos visuales del mismo objeto |
| Body | 15–16 / 16 | 400; interlineado 1.45–1.6 |
| Form label | 13–14 / 14 | 400–500, visible; valor/control 14–16, móvil 16 para evitar zoom automático |
| Metadata | 12–13 / 13 | ink-soft; no bajar contraste para lograr limpieza |
| Timeline time | 14–16 / 14–16 | 600 y tabular; período 12–13 contiguo |
| Shirt number | 15–16 / 15–16 | 600 y tabular; ancho de 3–4 caracteres, desconocido «—» |

Los rangos no exigen mezclar todos los tamaños. Elegir un tamaño por rol al implementar. No usar tracking amplio, tipografía digital o monoespaciada para simular un marcador televisivo. Texto largo debe envolver antes de desplazar un score fuera de pantalla.

## 9. Color

Mantener exactamente la dirección y tokens actuales hasta validar contraste calculado. No hay evidencia que obligue a una paleta nueva.

**Verde sí:** CTA principal; acción seleccionada mediante texto/peso y subrayado o borde de selección; foco; confirmación positiva temporal; ubicación seleccionada solo con forma/contorno adicionales. Campo puede conservar verde desaturado por su significado, separado del verde de acción.

**Verde no:** ambos nombres de equipos, todos los tiempos, score, encabezados de sección, metadatos, todos los enlaces secundarios por sistema. No colorear todo el workspace ni identificar rival con un color semántico de error. Mantener enlaces reconocibles mediante subrayado aunque se reduzca su prominencia cromática.

Selección: texto más fuerte + marca persistente y semántica de control, no únicamente fondo verde. Focus: contorno externo independiente; no confundir hover, selección y foco. Estados error/warning/info conservan sus tokens. «En curso» no es un éxito ni debe requerir un badge verde.

Dark/light: misma posición, densidad, peso y función de superficies. En light no añadir más cajas para compensar el fondo claro. Comprobar texto 4.5:1, texto grande 3:1 y componentes/foco 3:1 según WCAG AA; las capturas no certifican esas ratios. El campo necesita líneas y marcador distinguibles en ambos temas y alto contraste.

## 10. Borders y surfaces

| Región/objeto | Gramática propuesta | Razón / excepción |
| --- | --- | --- |
| Página y región principal | Sin caja | La posición y 24–32 px separan tareas |
| Shell y navegación | Un divisor funcional | No repetir línea al empezar inmediatamente otra sección |
| Contexto del partido | Sin borde completo | Agrupar cifras/equipos con proximidad, no con marco de televisión |
| Selector de acciones | Sin borde por cada opción inactiva; selección inequívoca | Son opciones de un grupo, no trece CTA; mantener targets |
| Inputs/selects | Borde completo de control | Su editabilidad no debe depender de hover; no eliminar contraste |
| Vídeo | Surface del reproductor | Delimita herramienta real; sin card que duplique su rectángulo |
| Pitch | Solo límite geométrico del terreno | Ninguna card alrededor de un campo ya delimitado |
| Roster | Divisor sutil por fila densa | Ayuda a seguir dorsal/nombre/acción; sin verticales |
| Timeline | Espacio entre hechos; divisor más claro entre períodos | Puede conservar divisor sutil de fila con multiline/múltiples fuentes; no rayar cada subcampo |
| Dashboard | Divisor sutil de fila y mayor espacio entre estados | Listas largas requieren tracking; no convertir a cards |
| Error / completed | Surface y texto contextual cuando requieren atención | No tratarlos como metadata invisible |
| Diálogo | Surface y overlay funcional existentes | Sin glow ni sombra ornamental |

No «cero bordes» como objetivo. La regla es **una frontera por cambio significativo**, no una frontera por nodo de layout.

## 11. Spacing y densidad

| Contexto | Espaciado | Cantidad visible objetivo | Columnas y scroll |
| --- | --- | --- | --- |
| Browse: Dashboard/Landing | 32–48 entre regiones, 12–16 dentro | Dashboard 5–7 filas simples a 900 px alto, según avisos; filas 80–96 px | Lista única; Landing asimétrica. Scroll de documento, sin lista encerrada |
| Setup: Nova/roster/vídeo | 24–32 regiones, 12 campos, 8 label/control | Nova: equipos + fecha/modo + CTA en 900 px sin subformularios; roster 8–11 jugadores por equipo con cabecera | Dos equipos solo si cada columna permite nombre y acción legibles; independencia de alturas; sin scroll interno por equipo |
| Workstation: tagging | 16–24 regiones, 8–12 campos, 4–8 metadatos | A 1440×900: captura simple y Guardar, inicio de timeline; no prometer toda una falta compleja sin scroll | Dos columnas externas, detalle/campo internos si caben; una página con scroll, no tres paneles desplazables |

Objetivos de fila: roster 48–52 px desktop, 56–64 móvil si la posición envuelve; timeline 52–64 simple desktop, 72–96 móvil, más para múltiples fuentes o vínculos. Nunca altura fija que corte texto. Targets principales 44 px. Una captura full-page larga no prueba por sí sola desperdicio: reducir antes las franjas vacías y luego valorar longitud de datos.

## 12. Tagging workstation desktop

### Distribución concreta

A 1440 px: gutters 24; ancho útil 1392. Captura aproximadamente 968 px, gap 24, vídeo 400. A 1366: útil 1318; captura 934, gap 24, vídeo 360. El vídeo no ocupa media pantalla. Dentro de captura, reservar aproximadamente 500–540 px a campos y 360–400 al pitch; si los labels/roles largos no caben, apilar campo debajo **dentro de captura**, no comprimir controles ilegibles.

Orden vertical:

1. Shell global compacto, contexto del encuentro y navegación del workspace. Un solo nombre de encuentro visualmente dominante.
2. Banda del borrador: período y «Tempo do evento», editables con las mismas capacidades actuales; estado de edición/captura claro. No duplicar dos inputs de tiempo.
3. Tipos de evento: trece botones de texto, grupos actuales Principais/Xogo/Reinicios/Disciplina/Cambios; dos o tres filas naturales con vídeo. Ningún carrusel, icono sustitutivo ni «más» en desktop.
4. Cuerpo activo: título de acción, equipo y detalle a izquierda; pitch a derecha cuando procede. Técnica/situación siguen visibles; no cambiar defaults. Para campos adicionales, crece el documento.
5. Guardar al pie del cuerpo activo, alineado con el comienzo de campos, feedback cercano. No ubicarlo debajo de la timeline ni al extremo opuesto de la pantalla.
6. Timeline reciente a todo el ancho, sin quedar encerrada debajo del reproductor; posesiones existente posterior con menor peso, sin rediseñar analytics.

Vídeo comienza al nivel del selector de acciones, con fuente y control de ocultación en su propia cabecera. Conserva proporción y controles del proveedor; no recortar contenido para cuadrar altura con el formulario. Sin reproducción automática. Al ocultarlo, captura ocupa ancho disponible: campos mantienen ancho cómodo y pitch puede crecer hasta unos 500 px; no estirar cada select a media pantalla ni el campo a ancho total.

Presupuesto orientativo a 1440×900: shell/contexto/nav ~180–210 px; banda temporal/tipos ~140–170; cuerpo simple/guardar ~330–390; inicio de timeline ~60. En 1366×768 o formulario de falta con sanción se acepta scroll del documento. **No** disminuir targets, ocultar errores o fijar alturas para lograr una captura bonita.

No añadir sticky al selector completo ni al vídeo. Si se valida una banda sticky de contexto en desktop, debe reemplazar la cabecera al desplazarla, no acumularse; su implementación queda condicionada a pruebas de foco/zoom. La propuesta inicial funciona sin ella.

## 13. Match context / scoreboard

Lectura conjunta, ancho central orientativo 720–900 px, no equipos en extremos separados por un vacío de 1000 px:

```text
GB Lorchos          0-06  —  1-03          Keltoi
                    6 pts    6 pts
Marcador analítico                         43 eventos
Tempo do evento: [2ª parte v] [18:42]      En curso · Gardado
```

Nombres no obligatoriamente uppercase; no escudos inventados. Goles-puntos conservan guion y ceros del formato actual; el guion largo central separa equipos. Totales, si se mantienen, en segunda línea 12–13 px, nunca de mayor peso que el marcador gaélico. «Marcador analítico» explica procedencia: ningún cálculo nuevo o score oficial.

Conteo de eventos a un lado como metadata, no en el centro óptico del encuentro. Estado de análisis separado del período: En curso no significa segundo tiempo. Fecha/modo junto al nombre cuando ayudan, sin otra franja. En completed, aviso legible y reapertura; no mostrar un tiempo editable ni inventar «tiempo final» del partido. En setup, se usa identidad del encuentro sin score redundante.

El ejemplo anterior es esquemático y sintético, no actividad de un usuario. El reloj representa el borrador activo; no transcurre, no gobierna reproducción y no se toma automáticamente del último evento. Al editar se etiqueta el evento existente; identidad física conserva su inmutabilidad actual.

## 14. Pitch como objeto funcional

Integrarlo dentro de la jugada activa, junto a los roles/resultados, no como bloque posterior de ajustes. Conservar geometría/aspect ratio actual; ancho recomendado 360–420 con vídeo y 420–500 sin él, nunca aumentar la escala a costa de los controles. En móvil usa el ancho disponible menos gutters, sin scroll horizontal.

La cabecera debe decir qué se coloca: posición del evento, origen o destino según contrato actual. Marcador seleccionado con contorno contrastado y etiqueta/valor equivalente accesible; origen/destino distinguibles mediante forma y texto si ambos existen. X/Y compactos debajo, con labels visibles y targets suficientes; Limpar junto a ellos, no perdido en otra línea de página. Mantener 0/0 válido. Un saque de porta sigue pidiendo solo destino; el diseño no restaura origen histórico ni cambia datos.

No girar la cancha al cambiar equipo ni normalizar coordenadas por período. Si orientación está disponible, aclararla con texto existente junto al campo, sin flechas decorativas. No inventar orientación cuando es desconocida. Al ampliar en el futuro overlays de analytics, el terreno ya tiene un espacio estable; **este diseño no incorpora capas, leyendas de heatmap ni controles nuevos**.

Acceso por teclado mediante controles numéricos conservados; no declarar accesibilidad de arrastre sin alternativa. Seleccionar punto no debe provocar scroll ni guardar automáticamente.

## 15. Timeline como secuencia de partido

Mantener el orden cronológico actual y los últimos ocho visibles; anteriores se revelan explícitamente. No invertir silenciosamente la cronología para colocar «lo más nuevo» arriba. Tiempo tabular en gutter; período en el grupo o repetido discretamente cuando la paginación deja una fila sin contexto. No conectar con una línea ornamental todos los eventos ni representar distancias de tiempo a escala falsa.

Fila simple: `18:31 · Pase · GB Lorchos · #4 Nome → resultado`; debajo solo información que no cupo y enlaces. No usar flechas para inventar receptor o causalidad si no hay esos datos. Tipo 600, jugador/equipo cuerpo, resultado legible. Mostrar nombre/dorsal solo cuando estén disponibles en los datos existentes del evento; no añadir consultas ni inferir protagonistas ausentes. Tiempo de partido y salto de vídeo son conceptos distintos: enlace `Vídeo 22:13 · Cámara principal`, nunca hacer que 18:31 parezca timestamp del proveedor.

Todas las fuentes siguen accesibles; permiten envolver a segunda línea y explican «Abrir orixinal» cuando no hay seek exacto. No ocultarlas tras un icono sin label. Editar y Quitar siguen disponibles por teclado/touch, en texto de menor prominencia, al final; no depender solo de hover ni introducir un menú adicional únicamente para limpiar el mockup. Conservan comportamiento/confirmaciones actuales.

Falta/tarjeta: sangría de 12–16 px, segmento vertical corto solo en ese vínculo y texto «Vinculada á falta de 18:37». No usar únicamente la sangría. Cada una mantiene tiempo, jugador, editar y quitar independientes. Borrar la falta conserva la tarjeta: la fila restante pierde la relación visual si ya no existe, no desaparece ni queda como hijo huérfano visual. No cambiar RPC ni relación de dominio. Seleccionar edición destaca la fila y el encabezado del editor sin colorear toda la lista.

## 16. Convocatoria: seleccionar participantes

Preservar dos equipos alineados arriba con alturas libres. Nombre de equipo 20 px; conteo discreto adyacente. Columnas internas: dorsal estrecho, jugador/posición flexible, acción textual. No repetir el nombre del equipo en cada fila. Posición debajo del jugador en anchos reducidos; desconocido no se rellena.

Convocados primero; disponibles bajo un título claro con acción Engadir. Los temporales permanecen un formulario compacto del equipo, con explicación «Só nesta análise» próxima. No mover plantel persistente dentro de Convocatoria ni convocar automáticamente. No player cards, camisetas ilustradas, escudos inventados ni alineación táctica nueva.

En desktop mantener Continuar accesible con el patrón actual sin otro sticky. En móvil, antes de las listas, dos enlaces de salto dentro de la página a local/visitante y vuelta al contexto; no tabs que destruyan drafts ni nueva navegación global. Son acceso a secciones existentes, no una feature de plantillas. Con treinta locales debe poder llegarse al rival sin recorrer treinta filas por gesto; mantener también lectura completa en el documento.

## 17. Nova análise: preparar un encuentro

Mantener Partido existente / Crear partido como elección de camino, sin wizard. En nuevo, la primera relación visual es Local ↔ Visitante. Sin equipo elegido, selector/búsqueda visibles; con equipo seleccionado, nombre prominente y acción Cambiar equipo que revela esos mismos controles. Crear equipo sigue accesible en ambos lados. Oficial/Persoal son texto discreto junto al nombre, no una colección de badges.

Crear equipo inline reemplaza solo el área de selección de su lado: nombre, corto opcional y categoría. Guardar equipo y Volver á selección tienen jerarquía distinta; drafts de local/visitante no se mezclan. El plantel persistente permanece disclosure opcional bajo el equipo, con nombre del equipo visible. No autosaltar a la fecha al guardar un jugador ni cerrar un draft del rival.

Fecha/hora y modo antes que etiqueta opcional en lectura; ancho de fecha ajustado a contenido, no media pantalla por simetría. Mantener «Hora local do teu dispositivo». Modo con dos radios, no tarjetas explicativas. La etiqueta puede estar en segunda fila compacta, sin crear un paso adicional.

En vacío, explicar ausencia de partidos y hacer dominante Crear o primeiro partido; modo y submit final quedan fuera del foco hasta elegir el camino. No autoseleccionar equipos ni alterar defaults. En existente, nombres de encuentro primero y fecha/competición después; misma selección y CTA actuales. Error junto al subformulario responsable, foco y draft conservados. No convertir preparación de equipo en condición para crear un rival rápido.

## 18. Dashboard: reanudar en una mirada

Objetivo de inspección de dos segundos: reconocer partido y rival en primera línea; fecha del partido y nombre del análisis si existe en segunda; estado/actualización y Continuar próximos al extremo de la fila. «Actualizado hai…» se distingue de la fecha del encuentro. Progreso solo expresa hechos ya disponibles: eventos y vídeo configurado/no configurado. No afirmar «quedaste en vídeo» a partir de un conteo.

Primera fila del orden real no requiere un marco, una card grande ni marcador duplicado. En curso y Completadas siguen separados, con contador textual. Nova análise conserva CTA principal de la página; Continuar puede ser enlace visible por fila. Completada ofrece Revisar, no un CTA de creación. Empty ofrece entrada inmediata. Aviso invitado legible sin ocupar más peso que la lista; no suprimirlo ni convertirlo en notificación temporal.

## 19. Mobile y tablet: estructura propia

A 390 px (y prueba mínima 320): shell en flujo, nombres de equipo en dos líneas si hace falta, score compacto conjunto. Fecha/modo/status envuelven sin ocultar error. No mantener shell + scoreboard + tabs + CTA todos sticky; propuesta inicial móvil sin sticky de captura ni vídeo. Teclado virtual no debe tapar el control activo o Guardar.

Tagging: sustituir visualmente el panel expandido de trece botones por **un select nativo etiquetado Acción**, con los trece tipos y grupos reconocibles. Selección actual siempre visible; usar exactamente el mismo comportamiento de cambio de tipo/borrador existente. No bottom nav, carrusel ni menú de iconos. Es una variante responsive de presentación, no un catálogo distinto. Mantener botones visibles en desktop; umbral guiado por espacio, orientativamente bajo 768 px.

Orden móvil: contexto → navegación local → período/tiempo → Acción → formulario → pitch/coordenadas → Guardar → vídeo plegable → timeline. El enlace de vídeo desde timeline conserva navegación/foco actual al player; la ocultación no deja audio. No mover vídeo arriba de la acción por defecto ni iniciar reproducción. Ocultación siempre disponible y evidente; no cambiar silenciosamente preferencia al rotar.

Entre 768 y ~1199 px: tipos en filas naturales; vídeo pasa al flujo si no quedan al menos ~840 px de captura y 320 de herramienta. A 1366/1440 sí hay dos columnas externas. Por debajo del ancho útil de detalle+pitch, apilar esos dos; jamás tres columnas externas comprimidas. Tablet táctil conserva targets 44 px.

Roster: enlaces a equipos, una lista por equipo y formularios propios. Nova: local después visitante, fecha/modo y CTA; plantel sigue opcional. Timeline: tiempo y acción primera línea, protagonistas/resultado después, vídeo y operaciones envuelven; target no se reduce para conservar dos líneas.

## 20. Wireframes de revisión

Diagramas de jerarquía, no mockups finales ni promesa de datos disponibles. Nombres, cifras y tiempos son ejemplos sintéticos. Corchetes indican controles, no cards; líneas delimitan regiones cuando tienen función. El marco ASCII no propone un borde alrededor de cada pantalla. Los formatos de score/tiempo y textos finales deben seguir los contratos actuales.

### 20.1 Dashboard desktop

```text
Gaeliza    Inicio    Nova análise                              Tema / sesión

As túas análises                                             [Nova análise]
Sesión invitada: volve desde o mesmo navegador.

En curso · 2
GB Lorchos — Atlántico Demo                  Actualizado hai 8 min
22 out. · Desde vídeo · 12 eventos · Vídeo configurado     Continuar →
──────────────────────────────────────────────────────────────────────────
Keltoi — GB Lorchos                         Actualizado hai 1 día
20 out. · Borrador · Sen vídeo                            Continuar →

Completadas · 1
GB Lorchos — Rival                          Actualizado hai 2 días
18 out. · Completada · 24 eventos                            Revisar →
                                                [Anteriores] [Seguintes]
```

No mostrar el modo si no forma parte de los datos ya disponibles para la fila: usar el contexto existente. No añadir consultas ni información solo para reproducir el dibujo.

### 20.2 Nova análise desktop

```text
Nova análise
[Partido existente]  [Crear partido — seleccionado]

LOCAL                                  VISITANTE
Meu equipo · Persoal                   [Selecciona equipo v]
Cambiar equipo                         [Buscar nome       ] [Buscar]
Crear equipo persoal                   Crear equipo persoal
Xestionar plantel (opcional)
                                       (crear inline, si se abre)
                                       Nome [                 ]
                                       Nome curto [           ]
                                       Categoría [Mixto v]
                                       [Gardar equipo]  Volver á selección

Data e hora [22/10/2026 19:30]          Modo (•) Desde vídeo ( ) En directo
Hora local do teu dispositivo.
Etiqueta do encontro (opcional) [                  ]

A convocatoria prepárase despois.                         [Crear análise]
```

Cuando no hay equipos seleccionados, ambos lados muestran selección/crear. Al abrir plantel, sus filas y alta aparecen dentro del lado correspondiente, no una tercera columna. No cambiar el otro borrador.

### 20.3 Convocatoria desktop

```text
GB Lorchos — Atlántico Demo                 Borrador · Gardado   Finalizar
[Convocatoria]  Vídeo e sincronización  Tagging
Vídeo e sincronización                                          [Continuar]

GB Lorchos · 11 convocados               Atlántico Demo · 1 convocado
 #1  Nome Apelido            Quitar       —  Visitante temporal     Quitar
     Porteiro
 #4  Nome Apelido            Quitar       Engadir temporal
     Defensa                             Nome [      ] Dorsal [ ] [Engadir]
 ...                                     Só nesta análise.

Engadir temporal
Nome [         ] Dorsal [ ] [Engadir]
Só nesta análise.

Dispoñibles no equipo · 2
#11  Nome Apelido             Engadir
#12  Nome Apelido             Engadir
```

No igualar alturas, no rellenar con contenido el lado del rival. La presentación en dos líneas es adaptable: en columna amplia posición puede quedar junto al nombre, sin alejarla hasta el extremo.

### 20.4 Tagging desktop con vídeo

```text
Gaeliza   Inicio   Nova análise                                      sesión

        GB Lorchos           0-06 — 1-03           Keltoi
                              6 pts   6 pts
Marcador analítico                                  En curso · 43 eventos
Convocatoria   Vídeo e sincronización   [Tagging]              Finalizar

Tempo do evento   [2ª parte v] [18:42]                            Gardado

CAPTURA (~934–968 px)                         VÍDEO (~360–400 px)
Principais: [Tiro*] [Pase] [Recuperación] [Perda]  Fonte [Principal v] Ocultar
Xogo: [Duelo] [Regate] [Bloqueo]                  ┌─────────────────────────┐
Reinicios: [Saque de porta] [Reinicio]            │                         │
Disciplina: [Falta] [Tarxeta]                     │  PLAYER / proporción    │
Cambios: [Substitución] [Cambio de porteiro]      │  conservada             │
                                                └─────────────────────────┘
Tiro · Equipo [GB Lorchos v]                     Controles nativos
Resultado [      v]   Tirador [      v]          Abrir no provedor
Asistencia [     v]   Técnica [      v]
Situación [      v]          POSICIÓN DO TIRO
                            ┌─────────────────┐
                            │   campo         │
                            │         ●       │
                            └─────────────────┘
                            X [ ] Y [ ] Limpar
[Gardar tiro]               (opcional)
──────────────────────────────────────────────────────────────────────────
Eventos recentes · 8 de 43                         Mostrar anteriores
2ª parte
18:31  Pase · GB Lorchos · Nome · resultado     Vídeo 22:13   Editar Quitar
18:37  Falta · Keltoi · Nome                    Vídeo 22:19   Editar Quitar
       └ Tarxeta · Nome · Amarela (vinculada)   Vídeo 22:19   Editar Quitar
```

La lista textual de grupos ocupa varias líneas en ASCII; en desktop se distribuyen por anchura en dos/tres filas sin cambiar orden ni separar botones de su label. Detalle y pitch son subregiones de captura, no una tercera columna global. El ejemplo de tiro mantiene todos sus campos aunque cambie su agrupación.

### 20.5 Tagging desktop sin vídeo

```text
Gaeliza   Inicio   Nova análise
        GB Lorchos           0-06 — 1-03           Keltoi
Marcador analítico                                  En curso · 43 eventos
Convocatoria   Vídeo e sincronización   [Tagging]              Finalizar
Tempo do evento [2ª parte v] [18:42]                  Gardado · Mostrar vídeo

Principais [Tiro* Pase Recuperación Perda]  Xogo [Duelo Regate Bloqueo]
Reinicios [Saque de porta Reinicio]  Disciplina [Falta Tarxeta]
Cambios [Substitución Cambio de porteiro]

Tiro · Equipo [GB Lorchos v]                POSICIÓN DO TIRO
Resultado [    v] Tirador [          v]     ┌─────────────────────────────┐
Asistencia [   v] Técnica [          v]     │                             │
Situación [    v]                          │                ●            │
                                           │                             │
                                           └─────────────────────────────┘
                                           X [ ] Y [ ] Limpar · opcional
[Gardar tiro]
──────────────────────────────────────────────────────────────────────────
Eventos recentes · 8 de 43                              Mostrar anteriores
18:31  Pase ...                                          Editar / Quitar
```

Se recupera espacio de verdad, pero el pitch no crece ilimitadamente ni los campos se estiran. No conservar una columna vacía donde estaba el player.

### 20.6 Tagging mobile

```text
Gaeliza                  Tema / sesión
Inicio    Nova análise

GB Lorchos          Keltoi
     0-06  —  1-03
     6 pts     6 pts
Marcador analítico · En curso
Convocatoria  Vídeo  [Tagging]

Tempo do evento
[2ª parte v] [18:42]
Acción [Tiro                    v]
(el selector contiene los 13 tipos)

Equipo [GB Lorchos              v]
Resultado [                    v]
Tirador   [                    v]
Asistencia [                   v]
Técnica [       v] Situación [  v]
(si no caben, apilar)

Posición do tiro · opcional
┌──────────────────────────────┐
│                  ●           │
│           campo              │
└──────────────────────────────┘
X [        ] Y [        ] Limpar
[Gardar tiro                   ]
Gardado / erro contextual

Vídeo                    Mostrar
(si abierto: fuente + player)

Eventos recentes · 8 de 43
Mostrar anteriores
2ª parte · 18:31  Pase
GB Lorchos · Nome · resultado
Vídeo 22:13         Editar Quitar
```

No todos los elementos caben en un viewport móvil: la aceptación es orden y acceso, no una pantalla sin scroll. No acortar «Vídeo e sincronización» a un nombre ambiguo sin nombre accesible completo; el wireframe lo abrevia solo por ancho.

### 20.7 Timeline y vínculo disciplinario

```text
Eventos recentes · 8 de 43                  Mostrar 35 anteriores
2ª parte
18:31  Pase     GB Lorchos · #4 Nome · resultado
       Vídeo 22:13 · Principal                        Editar   Quitar

18:37  Falta    Keltoi · #8 Nome · resultado
       Vídeo 22:19 · Principal                        Editar   Quitar
   │
   └ 18:37 Tarxeta · #8 Nome · Amarela
       Vinculada á falta de 18:37
       Vídeo 22:19 · Principal                        Editar   Quitar

18:42  Tiro     GB Lorchos · #2 Nome · Punto
       Vídeo 22:24 · Principal                        Editar   Quitar
       Abrir orixinal · Outra fonte (sen salto exacto)
```

No línea temporal a escala, ni cards ni iconos de cada acción. «Quitar» de falta no implica quitar tarjeta. Si la relación desaparece, la tarjeta continúa como fila independiente y cronológica.

## 21. Anti-slop red-team review

Crítica aplicada a la propuesta, no una lista de intenciones:

| Riesgo | Revisión / corrección incorporada |
| --- | --- |
| Cards como layout universal | Ningún nuevo wrapper visual de partido, roster o timeline. El player ya es su superficie. |
| Layout SaaS de tres columnas | Rechazado: solo captura + vídeo externos. Campo pertenece al evento; si estrecha campos, baja de fila. Sin sidebar nueva. |
| Gradients / glow / glass | Ninguno; no sirven al reconocimiento de una jugada. |
| Green everywhere | Score/equipos/tiempos neutros. El campo apagado no autoriza verde en todas las superficies. |
| Fake sport HUD | Eliminado el concepto de reloj que corre y scoreboard a extremos con decoración; referencia manual explícita. |
| Chips innecesarios | Estado textual, conteos adyacentes y categorías sin pills. Mantener control semántico de selección. |
| Hero metrics | Dashboard no añade score gigante ni tarjetas de métricas; la cifra grande pertenece al contexto del partido en tagging. |
| Simetría artificial | Rival corto queda corto; no altura común ni tarjetas vacías; sin vídeo no hay panel fantasma. |
| Giant headings | Ningún H1 de marketing en workstation; score domina por función, no por tamaño de póster. |
| Dashboard genérico | Filas de encuentros, recencia y reentrada real; sin widgets/analytics nuevos. |
| Iconografía decorativa | Nombres de acción siguen siendo texto. No trece pictogramas ni icono en cada evento. |
| Animación sin sentido | Ninguna transición obligatoria, auto-scroll o reproducción. Respeto a reduced motion existente. |
| Trucos «premium» | No fuente nueva, sombras, bordes luminosos, números inventados ni superficies translúcidas. |
| Mockup Dribbble impracticable | Se acepta scroll a 768 px alto, formularios largos, errores y nombres que envuelven. No esconder campos para cumplir un encuadre. |
| Minimalismo que elimina utilidad | Coordenadas, todas las fuentes, quitar/editar y estados siguen accesibles sin hover; no borrar affordances de inputs. |

Riesgo residual principal: el campo y el vídeo juntos pueden dejar demasiado poco espacio para roles largos. Criterio de salida: apilar pitch antes que reducir tipografía o esconder campos. Segundo riesgo: el select móvil reduce descubribilidad; validarlo con cambio entre tipos de grupos distintos, no solo tiro/pase.

## 22. Plan de implementación futuro por PR

Ninguno de estos PR se inicia en esta tarea. Todos excluyen DB, RPC, dominio, analytics, nuevas features y dependencias. Ajustar presentación/interacción existente no permite cambiar defaults, contratos de guardado o datos que el Dashboard consulta. Si un criterio necesita nueva persistencia, se descarta de este rediseño y se discute aparte.

| PR | Alcance | No toca | Riesgo | Screenshot acceptance criteria |
| --- | --- | --- | --- | --- |
| A — Jerarquía y shell | Formalizar roles aprobados, compactar shell/navegación y quitar duplicación de contexto en tagging; estados de lifecycle | Formularios de eventos, payloads, reloj/datos, nueva navegación | Ocultar estado o confundir tiempo manual; duplicar encabezados entre setup/tagging | Comparativas dark/light, editable/completed/error, nombres largos; a 1440×900 contexto+nav consumen objetivo 180–210 px sin cortar contenido; 390 px sin sticky apilados |
| B — Estación de tagging | Tipos, formulario/campo, vídeo lateral ocultable y timeline compacta; selector móvil equivalente | Semántica de tipos, coordenadas, atomicidad, links/sync derivados, inferencia de posesiones | Accesibilidad, pérdida de draft/foco al cambiar layout, relación falta/tarjeta mal entendida | 1366×768 y 1440×900 con/sin vídeo, tiro y falta+sanción, edición, unknown/null, 0/0, ocho eventos, múltiples fuentes; móvil 390/320, texto ampliado; ningún campo eliminado |
| C — Preparación | Jerarquía de Nova, disclosures locales, roster filas/saltos a equipos, relación visual de relojes en vídeo | Crear equipos/jugadores/match, RLS, defaults, convocar automáticamente, nuevos controles deportivos | Esconder draft/error; confundir temporal/persistente; fuente vs sync | Vacío, existente/nuevo, crear ambos equipos, un plantel abierto, rival vacío, 30 locales/2 visitantes, sync vacío/configurado/error; desktop y móvil; CTA y error de cada tarea visibles |
| D — Reentrada y Landing | Jerarquía de filas de análisis, acciones secundarias, condensar copy repetido | Orden/timestamp, paginación, tracking de último paso, nuevos datos, marketing o assets | Reducir descubribilidad de continuar o aviso invitado | Dashboard vacío/mixto/paginado y nombres iguales con fechas distintas; lectura de fecha de partido vs actualización; Landing dark/light desktop/móvil con CTA y aviso invitado |

Orden A → B → C → D. A y B se revisan con las mismas fixtures para comprobar que ahorrar espacio de cabecera beneficia la captura. No incluir «limpieza de código aprovechando el rediseño». Cada PR entrega diff visual por estado y pruebas de interacción existentes, con nuevas regresiones de presentación solo cuando hagan falta. La revisión humana decide aprobación antes de pasar al siguiente bloque.

## 23. Acceptance criteria visuales y de interacción

Son criterios para el futuro rediseño, **no resultados ya obtenidos**. Capturas actuales sirven como baseline. No certificar rapidez, contraste o accesibilidad solo con una imagen.

| ID | Criterio verificable | Evidencia requerida |
| --- | --- | --- |
| V01 | En tagging, equipos y score se leen como una unidad; no hay dos títulos equivalentes del partido | Captura 1440 y 1366 con nombres cortos/largos; versión completed sin reloj editable |
| V02 | Período/tiempo del evento inequívocos; no se confunden con vídeo o reloj vivo | Captura de captura/edición y walkthrough: cambiar tiempo no reproduce ni crea datos |
| V03 | Los trece tipos son visibles en desktop; selección y foco distinguibles | Captura de todos los grupos a 1366; recorrido teclado completo; seleccionar tipo no borra más datos que el comportamiento actual |
| V04 | Tiro simple permite ver Guardar y comienzo de timeline a 1440×900 con texto normal; errores no quedan recortados | Capturas con y sin vídeo y con error; a 768 de alto se acepta scroll de página |
| V05 | Ocultar vídeo recupera ancho, detiene reproducción y deja el campo proporcional | Pareja de capturas mismo evento/datos, inspección de reproducción/foco; sin columna vacía |
| V06 | Campo, marcador y X/Y legibles en dark/light; null y 0/0 se distinguen | Capturas posición vacía, extremo 0/0, origen/destino aplicables y saque solo destino; revisión de contraste y teclado |
| V07 | Timeline comunica secuencia antes que operaciones; mantiene ocho iniciales y todos los anteriores alcanzables | Ocho eventos simples más expansión; vínculos y múltiples fuentes; ninguna altura fija corta texto |
| V08 | Falta/tarjeta relacionadas visualmente pero independientes al editar/quitar | Capturas antes/después de borrar falta en fixture local; tarjeta sigue presente, sin indentación de relación inexistente |
| V09 | Móvil sin overflow, controles de 44 px objetivo y lectura a 200% sin oclusiones | 390×844, 320×568, tablet 768/1024; navegador con teclado virtual/zoom y foco, no solo full-page screenshot |
| V10 | Roster conserva lectura dorsal → nombre → posición; rival accesible con 30 locales | Captura desktop/móvil, acceso teclado a salto al rival y regreso; drafts independientes sin montaje destructivo |
| V11 | Nova conduce de vacío a encuentro sin hacer obligatorio el plantel | Capturas vacío/selección/crear equipo/error/plantel; comparar existentes; ambos drafts intactos |
| V12 | Sync expresa fuente/período y pareja de relojes, no automatismo supuesto | Capturas vacío, varias fuentes y error; precisión actual conservada y continuar en directo accesible |
| V13 | Dashboard permite identificar encuentro, fecha, contexto disponible, recencia y continuar | Prueba de lectura de 2 segundos con revisión humana y preguntas; no afirmar éxito sin observarla; cero campos inferidos de última pestaña |
| V14 | Color es redundante con texto/forma; foco y texto cumplen contraste | Medición de colores calculados AA en ambos temas; revisión sin color; estado selected distinto de hover/focus |
| V15 | Todos los estados operativos tienen jerarquía coherente | Loading, vacío, pendiente, guardado, error de escritura, fallo de recarga tras commit, edición, completed/reapertura; sin salto vertical evitable |
| V16 | No se sacrifica rendimiento de una sesión larga por limpieza inicial | Walkthrough de 60 minutos con varias acciones, corrección y vídeo; registrar desplazamientos, errores de foco y fatiga reportada. Hasta entonces ergonomía prolongada es hipótesis |

La revisión de dos segundos es un objetivo de legibilidad, no un KPI inventado. No exigir analítica de uso ni instrumentación para medirlo. Las metas de altura ceden ante traducciones, nombres largos, errores y accesibilidad. No pedir todos los eventos o todo el formulario complejo dentro de una pantalla.

## 24. Cosas que NO debemos hacer

- No implementar este documento antes de revisión humana ni modificar DESIGN.md en este PR.
- No convertir la propuesta en un rediseño de arquitectura, dominio, DB, RLS, RPC o datos.
- No añadir fonts, dependencias, assets de deporte, escudos, fotos, logos o ilustraciones para suplir jerarquía.
- No añadir dashboards de métricas, analytics, heatmaps, realtime, automatismos de reloj o nuevas funcionalidades.
- No copiar marca/layout de Linear, Strava, Fey, Fitness u Oura.
- No resolver «Excel» con cards, gradients, glow, glass, sombras, pills indiscriminadas o animación.
- No transformar score analítico en oficial, total de puntos en sustituto de score gaélico o tiempo del borrador en reloj vivo.
- No normalizar/girar coordenadas ni restaurar origen de saque de porta para mejorar un dibujo.
- No ocultar errores, acciones esenciales, fuentes de vídeo, coordenadas o tipos solo para cumplir una captura.
- No auto-guardar formularios, cambiar defaults, autoconvocar, fusionar falta/tarjeta ni alterar cascadas.
- No crear un panel flotante por herramienta, tres scrolls internos, bottom nav o shortcuts nuevos por estética de workstation.
- No hacer del rival una columna de igual altura por obligación ni usar player cards.
- No inventar «último paso»/progreso en Dashboard ni cambiar su orden real por prominencia editorial.
- No borrar confirmaciones, evidencia de commit, aviso invitado o restricciones completed por minimalismo.
- No tratar la evidencia sintética como un estudio de usuarios ni afirmar que una propuesta ASCII ya está validada.

**Límite de esta entrega:** un documento de auditoría y especificación. No cambia React, TypeScript, CSS, SQL, tests, componentes, dependencias, screenshots existentes ni Supabase. El PR queda abierto para revisión, sin merge ni auto-merge.
