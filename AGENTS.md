# AGENTS.md

## What this app is

`Lumina` (`mi-app`): a single-page React 19 + TypeScript + Vite app, styled with
Tailwind CSS 4. There is **no backend service in this repo** — data and auth go
directly to Firebase from the browser (`src/firebase.ts`). A Capacitor Android
shell lives in `android/` but is not part of the sandbox setup.

## Running it in the Base44 sandbox

- `docker compose -f docker-compose.base44.yml up -d --build`
- Only one service (`web`): `node:22-alpine`, repo bind-mounted at `/app`, deps
  installed into a named `node_modules` volume on startup (`npm ci`), Vite dev
  server on container port 5173 mapped to host **3000**.
- `node_modules` is a Docker volume, not the host bind mount — do not expect
  host `node_modules` to be populated, and never delete the volume to refresh
  deps (a container restart re-runs `npm ci`).
- HMR needs polling on the bind mount: `CHOKIDAR_USEPOLLING=true` is set in
  `docker-compose.base44.yml`.

## Configuration / secrets

Firebase web config (api key, project id, etc.) is **committed in
`src/firebase.ts`** — it is a public client config and needs no app secret. No
`/run/base44/app.env` entries are required; `.base44/environment.json` lists no
secrets. There are no `import.meta.env.*` reads anywhere in `src/`.

## Cabecera de sección (UI)

- Todas las secciones usan `src/components/ui/SectionHeader.tsx`, con exactamente
  la misma posición/márgenes que la cabecera de Tasks (safe-area top + `px-3` sin
  `pt`, y `TopBar` con `px-1 py-1.5`). Para mover el título, cámbialo ahí y no en
  cada sección. El color de fondo es propio de cada sección y llega por la prop
  `background` (Tasks, Tracker, Timer y Calendario usan blanco; el resto `#f7f6f9`).
- La cabecera va **fuera** de la zona scrolleable en todas las secciones
  (`flex flex-col` + contenedor interno `overflow-y-auto`), por eso queda fija.
- Tracker y Timer comparten estilo de tarjetas: contenedor `px-2` (mismo ancho que
  las listas de Tasks), tarjetas `rounded-[16px]`, padding interno `p-4` y filas
  `px-4`. Para nuevas tarjetas de esas secciones, usa esas mismas clases.

## Tipografía y jerarquía

- La fuente es **Inter** (variable, cargada en `index.html` desde Google Fonts) con
  la pila del sistema como respaldo en `src/index.css`. El `body` lleva
  `letter-spacing: -0.011em`: no añadas tracking positivo al texto normal.
- Escala de referencia (mantén estos valores para que las secciones se vean igual):
  - Título de sección: `text-[25px] font-bold tracking-[-0.03em]` en `TopBar`
    (centrado entre el botón de menú y el avatar). No lo cambies por sección.
  - Títulos de pantalla completa y de lista: 22px y 21px, `font-bold`,
    `tracking-[-0.03em]` / `tracking-[-0.025em]`.
  - Etiquetas de sección ("Hoy", "Historial", "Actividades"…): clase `.eyebrow`
    de `src/index.css` (11px, 600, mayúsculas, `0.09em`). No repitas clases
    `text-[12px] font-bold uppercase tracking-wider` a mano.
  - Texto principal de filas y tarjetas: 15px `font-medium`
    `tracking-[-0.01em]`; texto secundario 13px; metadatos 12px.
  - Números destacados (tiempo total, día del calendario): 32px `font-bold`
    `tabular-nums tracking-[-0.04em]`.
- Colores de tinta: principal `#1c1c23`, cuerpo `#333`, secundario `#777`,
  apagado `#8b8b98`/`#a0a0a0`.

## Barra de estado en Android (Capacitor)

- `android/app/src/main/java/com/lumina/app/MainActivity.java` activa edge-to-edge
  (`WindowCompat.setDecorFitsSystemWindows(false)`), deja transparentes la barra de
  estado y la de navegación, y fuerza iconos oscuros: así el color superior de la
  app se ve detrás de la barra de estado (fusión tipo app nativa).
  Las cabeceras reservan ese espacio con `env(safe-area-inset-top)`.
- `res/values/styles.xml` usa el mismo color como respaldo para la pantalla de
  arranque. `res/values/colors.xml` se añadió porque `styles.xml` referenciaba
  `@color/colorPrimary` y no estaba definido.
- El proyecto Android **no** se compila en el sandbox (`@capacitor/android` no está
  instalado): los cambios nativos requieren `npx cap sync android` + Gradle local.

## Teclado en pantalla (Android)

- `src/hooks/useKeyboardVisible()` indica si el teclado está abierto: compara la
  altura del `visualViewport` con la mayor observada, así funciona tanto con
  `interactive-widget=resizes-content` como con `overlays-content` (meta viewport
  en `index.html`). Devuelve `false` en escritorio, donde no hay teclado.
- Con el teclado abierto se ocultan los controles que quedarían encima de él:
  la barra inferior (papelera + Completada) en `TaskDetailView` y los botones
  principales de `FocusScreen`, añadiendo la clase `hidden`. Se restauran al
  cerrar el teclado y su comportamiento sin el flag es el de siempre.
- Para no cerrar y reabrir el teclado al pasar del título a las notas (y al
  revés) el foco se aplica en el mismo frame: `useLayoutEffect` + `el.focus()`
  (sin `setTimeout`) y `onMouseDown={preventDefault}` en la cabecera de notas de
  `TaskDetailView`.
- En `NuevaTareaModal` el panel de notas se cierra al tocar cualquier zona
  interior del modal o el botón Notas cuando la nota está vacía (con contenido
  solo lo cierra el botón); el editor de notas y la barra de formato hacen
  `stopPropagation` para no cerrarlo al escribir.
- `NuevaTareaModal` entra deslizándose desde abajo (`y: '100%' → 0`, 200 ms) y
  enfoca el título en `onAnimationComplete`, justo al terminar de entrar: el
  teclado empieza a subir en ese frame y empuja el modal, sin espera fija (un
  `setTimeout` dejaba un hueco visible entre la llegada y el teclado). No vuelvas
  a usar `autoFocus`: enfoca antes de entrar y el modal parpadea.
- El panel solo compensa `bottom` con el `visualViewport` cuando el layout **no**
  cambia (teclado superpuesto, p. ej. iOS) y tras dos lecturas estables. Con
  `resizes-content` el navegador ya arrastra el panel; compensar además duplicaba
  el desplazamiento y lo lanzaba arriba durante la animación del teclado.
- En `ListaTareasCard` la pulsación larga solo activa el modo reordenar: ninguna
  tarea entra en arrastre sin tomarla de sus barras (`onDragPointerDown` del asa).

## Botón atrás de Android

- `src/utils/backButton.ts` mantiene una pila de manejadores y escucha el evento
  `backButton` de `@capacitor/app`: cierra la pantalla/modal más reciente y, si no
  hay nada abierto, sale de la app (`App.exitApp()`). `initBackButton()` se llama
  una vez desde `App.tsx` y es idempotente.
- Cada pantalla o modal llama a `useBackHandler(active, onBack)` (`src/hooks/useBackHandler.ts`).
  El que se registra último es el que está más arriba en pantalla, así que se
  cierra en orden correcto. **Al crear una pantalla o modal nuevo, añade esa línea**
  para que el botón atrás no salga de la app.
- `@capacitor/app` es una dependencia nueva; queda registrada a mano en
  `android/capacitor.settings.gradle` y `android/app/capacitor.build.gradle`
  (es lo que genera `npx cap sync android`).

## Sección Timer (pantalla Focus)

- Modos en `src/hooks/useCountdownTimer.ts` (`TimerMode`): `rastreador`,
  `temporizador`, `pomodoro` e `intervalos`. El modo elegido se guarda en
  `timer-mode` (`useUserStorage`).
- La configuración propia de la sección vive en `timer-settings`
  (`src/hooks/useTimerSettings.ts`: duraciones del pomodoro, cada cuántas sesiones
  toca el descanso largo, últimas duraciones del temporizador e intervalos).
  La leen tanto `FocusScreen` como `TimerSettingsScreen`, así que se sincroniza
  entre dispositivos como el resto del documento `users/{uid}`.
- `TimerSettingsScreen` es la pantalla de configuración exclusiva de la sección:
  se abre con el engranaje de `FocusScreen` y con el botón "Configurar pomodoro".
  Está ordenada por modo (Rastreador, Temporizador, Pomodoro, Intervalos) y luego
  Concentración y Avisos. Temporizador: sonido de alarma (hoja que suena cada
  opción al tocarla) y vibración. Pomodoro: las tres duraciones (abren
  `CustomDurationModal`, que acepta `title` e `initialMinutes`) y el stepper del
  descanso largo. Intervalos: la lista (`IntervalFormModal`). Concentración: tema,
  arranque automático y pantalla encendida. Avisos: sonidos y notificaciones.
- Temporizador: antes de empezar se muestra el selector de horas y minutos
  (`WheelPicker` con `variant="flat"`, sin recuadro) y las duraciones recientes
  (máximo 4 distintas; si no hay, 5/10/30/60). Al tocar una duración reciente la
  rueda rueda hasta ese tiempo (`scrollTo({ behavior: 'smooth' })` en
  `WheelPicker`). El selector y el anillo se intercambian con
  `AnimatePresence mode="wait"` (el reloj entra con muelle), no con un cambio
  plano. Los botones − / + **solo** existen con el temporizador en marcha, van
  debajo del anillo, muestran solo el signo y suman/restan
  `timerAdjustMinutes` (1, 2, 5 o 10 min, ajustable en la configuración); usan
  `countdown.addTime`, que mueve `remaining` y `targetSeconds` sin reiniciar. Las
  duraciones usadas se guardan al guardar la sesión.
- Anillo (`FocusRing`): se llena al empezar y se vacía con la cuenta. El
  desplazamiento del trazo es **negativo** (`-circunferencia * (1 - progreso)`)
  para que el hueco crezca en sentido horario, el mismo en el que gira el brillo.
  El brillo blanco va dentro de una máscara con el arco que queda lleno, así que
  se ve sobre la línea de color y se recorta a medida que el anillo se vacía.
- Alarma del temporizador: al llegar a cero no se cierra la sesión. Se abre
  `TimerCompleteScreen` y suena en bucle el sonido elegido (`src/utils/alarm.ts`
  sintetiza cuatro alarmas con WebAudio; no hay archivos de audio) con la
  vibración configurada. Al silenciar se guarda la sesión con
  `targetSeconds + espera hasta silenciar`: ese tiempo extra es parte del
  registro. `primeAlarmAudio()` se llama en el gesto de iniciar porque los
  móviles bloquean el audio sin interacción.
- Modo concentración (`FocusModeScreen`): pantalla completa con el reloj, la
  descripción y botones descoloridos (salir, pausa, saltar y terminar). Se entra
  con el botón de la cabecera de `FocusScreen` mientras hay sesión activa, y
  automáticamente al iniciar si `startInFocusMode` está activo. Dos temas
  (`focusTheme`: `anillo` y `numeros`) y fondo claro u oscuro
  (`focusAppearance`); el tema retirado `onda` se normaliza a `anillo` en
  `useTimerSettings`. El anillo mide 280 y el tiempo se muestra compacto
  (`MM:SS` sin horas, `H:MM:SS` con horas) igual en ambos temas; el tema de
  números pinta cada grupo en un panel tipo flip. Con pomodoro en marcha se ven
  debajo las sesiones como barritas separadas por puntos. El título no va en
  mayúsculas. `keepScreenOn` usa Screen Wake Lock (`useWakeLock`).
- El registro manual (botón del calendario con +) solo existe en Rastreador.
- Pomodoro: debajo del anillo va una línea con la configuración actual
  (`25 min · 5 min · 15 min · 4/4`) y el botón "Configurar pomodoro", que abre
  `TimerSettingsScreen` desplazada a su sección (`initialSection`). Secuencia:
  enfoque → descanso → … → último enfoque → descanso largo → alarma final
  (`PomodoroCompleteScreen`, suena hasta silenciarla y entonces se guarda el
  enfoque acumulado). `pomodoroElapsed` acumula el enfoque de cada sesión (al
  completar o al saltar), así que guardar a medias también registra lo hecho.
  Con `pomodoroAutoStart` la siguiente sesión arranca sola y suena un aviso corto
  distinto para enfoque, descanso y descanso largo (`playPhaseSound`); apagado,
  deja el contador preparado y el usuario lo pone en marcha.
- Registros: cada sesión se guarda con su modo (`stopwatch`, `timer`, `pomodoro`,
  `interval`) y la lista de historial lo muestra como etiqueta
  (`src/utils/sessionMode.ts`).
- Barra inferior de `FocusScreen`: flota en absoluto sobre el contenido, con un
  velo en degradado (sin franja sólida) y `pointer-events-none` fuera de los
  botones. El contenido lleva `pb-44` para no quedar debajo.
- Con pomodoro o intervalos en marcha la barra inferior tiene cuatro botones:
  X, play/pausa, saltar fase y check (pulsación larga = completar tarea).
- Intervalos: cada intervalo propio tiene nombre, minutos de enfoque, minutos de
  descanso, número de rondas y hasta 5 intervalos extra propios
  (`MAX_INTERVAL_EXTRAS`, nombre y minutos editables). La fase alterna enfoque →
  descanso → intervalos extra → siguiente ronda; al acabar el último enfoque el
  contador se queda en 00:00 para guardar.

## Sección Calendario

- `src/hooks/useCalendarData.ts` es la única fuente de datos del calendario: cruza
  tareas (`useTasks`), registros (`timeSessions`), actividades y eventos
  (`calendarEvents`) en una lista de `CalendarItem` con `kind`
  (`pending | completed | session | event`), fecha, minutos de inicio/fin y color.
  Las tareas y los registros se **derivan** de sus colecciones (no se copian); los
  eventos son la única fuente propia. Al añadir información al calendario, añade
  una capa ahí y usa `LAYER_META` para su color/etiqueta.
- Vistas: `MonthGrid` (mes), `TimeGrid` (rejilla horaria; con 7 días es semana y
  con 1 día es día), `DaySummary` (resumen) y `DayAgenda` (agenda cronológica).
  `CalendarToolbar` cambia de vista y filtra capas; los filtros se guardan en
  `users/{uid}` con la clave `calendar-layers` (`useUserStorage`).
- Los eventos ya **no** se siembran para usuarios nuevos (`useCalendarEvents`):
  el calendario arranca vacío y solo muestra lo que el usuario crea.
- La agenda se queda oculta (`visibility: hidden`) hasta que el día de hoy está
  anclado arriba. Ese anclaje reintenta en el siguiente frame si el contenedor con
  scroll todavía no está enganchado (el orden del commit cambia entre
  dispositivos), y hay un temporizador de seguridad que la muestra igualmente: sin
  eso, en algunos móviles la sección abría en blanco hasta pulsar "Hoy".
- `NuevaTareaModal` acepta `initialDate` para crear una tarea fechada desde el
  calendario; se guarda con `addTaskWithData` de `useTasks`, así que aparece igual
  en la sección de Tasks. El botón + de la barra de navegación abre
  `CalendarQuickAdd` (elegir tarea o evento).
- Detalles: los eventos usan `EventDetail`/`EventForm`, las tareas
  `TaskDetailView`, los registros `SessionDetailModal` (con
  `incrementTaskTime` al vincular/desvincular, igual que en `TimeTracker`).

## Safe areas (edge-to-edge)

- Las pantallas de pantalla completa que NO usan `SectionHeader` usan
  `DETAIL_HEADER_TOP` (`max(env(safe-area-inset-top), 20px)`) de
  `src/components/ui/DetailScreen.tsx` en su cabecera —el mismo nivel que el
  detalle de actividad del Tracker— y `paddingBottom: 'max(env(safe-area-inset-bottom), ...)'`
  en su barra inferior. El botón de atrás es `BackButton` del mismo archivo
  (`w-10 h-10`): no lo reimplementes. Lo usan `TaskDetailView`, `SettingsPage`,
  `AccountPage`, `FocusScreen`, `SessionDetailModal`, `ActivityDetailModal`,
  `CalendarSearch`, `GoogleCalendarModal` y `ActivitiesPage`.
- `NavegacionBar` usa `height: calc(70px + env(safe-area-inset-bottom))` con
  `paddingBottom: env(safe-area-inset-bottom)` para no chocar con los botones
  del sistema en dispositivos con navegación por botones (no gestos).
- `SectionHeader` usa `max(env(safe-area-inset-top), 8px)` sin `pt` extra: la
  cabecera principal va arriba y pegada a los bordes (`px-3` + `px-1` del `TopBar`).

## Foto de perfil

- `TopBar` y `AccountPage` (vía `ProfileAvatar`) manejan `onError` en la imagen
  de perfil: si la URL de Firebase falla, se muestra el avatar SVG morado en
  su lugar. El estado `photoError` se resetea al cambiar de usuario.

## Links en tareas

- `Task.links?: string[]` guarda URLs asociadas a una tarea.
- `LinkPreview` muestra cada link como una tarjeta con favicon (vía Google
  favicon service), dominio y título de la página (obtenido vía proxy CORS
  `corsproxy.io`; si falla, solo muestra el dominio).
- En `TaskDetailView`, la sección Links va debajo de Notas. Se oculta para
  tareas vinculadas (`isLinked`) y de actividad pura (`isActivityOnly`).

## Crear avance

- `TaskDetailView` acepta `onCreateAdvance?: (listId, taskTitle) => void`.
  Al pulsar "Crear avance" (antes de "Añadir a Timer") se abre un dropdown
  con las listas disponibles; al elegir una, se crea una tarea vinculada
  (`linkedTaskId`) con título `Avanzar en: <título>` vía `addTaskWithData`.
- Solo aparece en tareas no completadas, no vinculadas y no de actividad pura.

## Sincronización multidispositivo

- Toda la sincronización la resuelve Firestore; **no hay motor propio**. `src/firebase.ts`
  usa `initializeFirestore` con `persistentLocalCache` +
  `persistentMultipleTabManager`: caché persistente en IndexedDB, lecturas
  instantáneas sin red y multi-pestaña sin el aviso `failed-precondition`.
- `src/hooks/collectionStore.ts` mantiene **una sola suscripción por usuario y
  colección**, compartida por todos los componentes que la usan. Al reabrir la
  app cada listener reanuda desde su último punto, así que solo se descargan los
  documentos que cambiaron (nunca la colección completa).
- `useFirestoreCollection(uid, coleccion)` es la única vía de lectura/escritura de
  las subcolecciones (`tasks`, `taskLists`, `activities`, `timeSessions`,
  `calendarEvents`). Devuelve `items`, `loading` (primer snapshot, normalmente de
  caché) y `ready` (primer snapshot **del servidor**: úsalo para sembrar datos).
- Escrituras: directas a Firestore (`add`/`set`/`update`/`remove`/`batchSet`/
  `batchRemove`). Sin conexión quedan en cola y se suben solas al recuperar la
  señal, en orden: **el último cambio gana**. `update()` omite escrituras sin
  cambios y, si el documento se borró en otro dispositivo, **no lo resucita**.
- Los borrados se propagan solos: al desaparecer del servidor desaparecen de la
  caché local de todos los dispositivos (no quedan tareas fantasma).
- `incrementTaskTime()` usa `increment()` (atómico): dos dispositivos que suman
  tiempo a la vez no se pisan.
- `useUserStorage` (documento raíz `users/{uid}`: ajustes, cronómetro en curso,
  calendarios vinculados…) escucha con `onSnapshot` en tiempo real y escribe solo
  las claves cambiadas con `merge`.
- Siembra de datos de ejemplo: solo cuando `ready` llega vacío y una vez por
  cuenta/dispositivo (claves `lumina-seeded:{uid}` y `lumina-activities-seeded:{uid}`
  en localStorage).
- `SyncStatusPill` muestra "Sincronizando…" o "Sin conexión" solo cuando hay
  escrituras pendientes o no hay red; alimentado por `src/hooks/syncStatus.ts`.
- Al cerrar sesión `resetCollectionStores()` cierra todas las suscripciones. Si
  añades una colección nueva, no crees listeners propios: usa el hook.

## Quirks

- `vite.config.ts` sets `server.allowedHosts: true`; the compose file also
  passes `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS` through for robustness.
- La caché persistente de Firestore se comparte entre pestañas
  (`persistentMultipleTabManager`), así que abrir la app en varias pestañas ya no
  rompe la persistencia.
- El check de una tarea-actividad en curso lleva a la pantalla **Focus**
  (`requestFocusView()` en `src/shared/focusRequest.ts`), no a la vista de Timer.
- Firebase Auth sign-in is required for most screens; signed-out previews show
  the login screen only.

## How to verify it works

- `curl -s http://localhost:3000/ | head` must return the HTML shell **with**
  `<script type="module" src="/@vite/client">` — that proves the live Vite dev
  server (not a prebuilt bundle) is serving the page.
- `docker compose -f docker-compose.base44.yml ps` should show `web` as healthy.
