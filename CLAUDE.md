# Libro de Gastos — contexto del proyecto

App personal de gastos e ingresos para el iPhone del usuario. Es una **app nativa (Expo)** que
guarda todo en un **servidor que corre en la PC**; el teléfono llega a la PC por **Tailscale**, en
casa y afuera. Todo gratis, sin servicios externos. Es un proyecto independiente: tiene su propio
servidor, puerto, base, datos y repo, y se organiza como mejor le sirva a esta app.

El repo es **público** (github.com/serso2601/libro-de-gastos, rama `master`): nada de datos, tokens
ni montos reales en el repo.

## Al iniciar cada chat (hazlo primero)

Antes de contestar o hacer cualquier otra cosa, lee `PENDIENTES.md` y dile al usuario, en pocas líneas, qué quedó
por probar, revisar o retomar, y si en la última sesión se dejó algo a medias, empieza por eso. Pregúntale si
arrancan por ahí o si va a otra cosa. Al cerrar una sesión, actualiza `PENDIENTES.md`: quita lo que ya se probó y
anota lo que quedó pendiente. Los cambios de la app se mezclan a `master` y se hace `git pull` en la carpeta
principal sin preguntar (el usuario es el único que la usa y quiere verlos al instante).

## Dónde está cada cosa

```
Documents\PROYECTO APP DE GASTOS\      ← el repo
├── app\                     ← la app del iPhone y la web (la misma): Expo SDK 58, expo-router, TS
│   └── src\app\             ← rutas: (pestanias)\ (Inicio · Movimientos · Presupuesto · Cuentas),
│                                cuenta\[id] y ajustes (abiertas encima, con «‹ volver»), conectar
│       src\pantallas\       ← las pantallas; inicio\ (saldo elegible + vistas Tarjetas y
│                                Calendario); Movimientos lleva Lista y Gráficos; Tutorial.tsx
│       src\lib\             ← datos (almacén + cola offline), api, acciones, calculos, formato, tipos
│       src\dialogos\        ← las hojas: anotar, regla que se repite, cuenta, categoría, topes
│       src\ui\              ← estilo (uno), tema (claro/oscuro/color), componentes, gráficos, marco
│       public\index.html    ← la página de la web (pantalla completa en el iPad, ícono)
├── servidor\                ← FastAPI + SQLite (uv). Paquete `gastos`. `uv run pytest`
├── scripts\iniciar.ps1      ← arranca el servidor (8766) y Metro (8082) y compila la web si cambió;
│                                lo corre el inicio de Windows
├── scripts\instalar-inicio.ps1 · abrir-firewall.ps1
└── .github\workflows\ios.yml ← compila el .ipa sin firmar en una Mac de GitHub (etiqueta ios-*)
```

La app vieja (PWA en `docs/`) se retiró el 19/oct/2026: sus datos eran de prueba. Si GitHub Pages
sigue activo en el repo, apagarlo en Settings → Pages.

Dentro de la carpeta pero **ignorado por git** (nunca sube al repo público):
- **`datos\`** — `gastos.db`, `token.txt`, `respaldos\` (una copia por día, se guardan 30) y
  `registros\` (servidor, Metro, inicio).
- **`app-iphone\`** — los .ipa compilados (`gastos-dev-N.ipa`), para arrastrar a Sideloadly.

## Cómo corre

- **Servidor** en `0.0.0.0:8766`, pero solo atiende a la PC misma y a la tailnet (100.64.0.0/10):
  lo demás recibe 403 antes de mirar el token. Entra con `Authorization: Bearer <token.txt>`.
- **Página de estado** http://127.0.0.1:8766 (acceso directo en el escritorio). Abierta en la PC
  muestra los **QR para conectar**: el de la web (`http://<ip>:8766/app/conectar?d=...&t=<token>`)
  y el de la app del iPhone (`librogastos://conectar?d=<ip>:8766&t=<token>`); la cámara lo lee y la
  app se conecta sola.
- **La web** en `http://<ip tailscale>:8766/app`: el servidor sirve `app\dist` (el export web de
  Expo, ignorado por git) y cualquier ruta de /app da la página. En el iPad: Safari → Compartir →
  «Agregar a pantalla de inicio». Tras cambiar la app: `npx expo export --platform web` en `app\`
  (o `iniciar.ps1`, que la recompila si el código es más nuevo) y recargar en el iPad.
- **Metro** en el 8082 (anuncia la IP de Tailscale) para el build de desarrollo.
- Arranque automático: `Libro de Gastos.lnk` en `shell:startup` → `scripts\iniciar.ps1`.
- Tras cambiar el servidor: matar el proceso `python -m gastos` y correr `iniciar.ps1`. Los cambios
  de la app (JS) llegan al teléfono recargando, si es build de desarrollo.

## Poner la app en el iPhone

1. `git tag ios-dev-N && git push origin ios-dev-N` → GitHub compila (~8 min) → `gh run download
   --name gastos-development` baja `gastos.ipa`. Se guarda en **`app-iphone\`** del proyecto
   como `gastos-dev-N.ipa` (git lo ignora). El primero que funcionó es `ios-dev-2`.
2. **Sideloadly** lo firma con el Apple ID del usuario y lo instala **por cable**.
3. La firma con Apple ID gratis dura **7 días**: se vuelve a firmar el mismo .ipa (no hace falta
   recompilar salvo que cambie algo nativo). Máximo 3 apps instaladas así a la vez.
- `development`: carga el código desde Metro de la PC (cambios al instante). `release`
  (`ios-release-N`): lleva el código adentro y abre sola; para cuando la app deje de cambiar tanto.
- Variable del repo `DEV_SERVER_URL` = `http://<ip tailscale>:8082` (no va en el repo).
- **23/oct/2026: Apple está bloqueando el acceso de Sideloadly** a las cuentas, así que no se puede
  volver a firmar. Mientras tanto el usuario usa **la web** (ver «Cómo corre») para el día a día y
  **Expo Go** para ver la app nativa (animaciones, vibraciones).
- **Expo Go** (25/oct/2026): gratis en la App Store, sin firmar nada. Carga el mismo código desde
  Metro (8082; el `--dev-client` de `iniciar.ps1` no estorba: Metro le sirve a los dos). La página de
  estado tiene su QR: `exp://<ip>:8082/--/conectar?d=<ip>:8766&t=<token>` abre Expo Go ya conectado.
  Difiere del .ipa en que va dentro de Expo Go (su ícono), `librogastos://` no lo abre, sus datos
  locales van aparte y en modo desarrollo va algo más lento. Solo corre con el SDK que trae el Expo Go
  de la App Store (hoy el 58) y con módulos nativos incluidos en Expo Go: antes de agregar uno, verlo.

## Decisiones tomadas (no repreguntarlas)

- **App nativa con Expo**, y la **web es la misma app** (react-native-web), hecha el 23/oct/2026
  porque Apple bloqueó Sideloadly. Lo que no existe en el navegador va en archivos `.web.ts(x)`:
  `lib/almacen` (localStorage), `lib/compartir` (descarga), `ui/fecha` (calendario dibujado); los
  avisos de confirmar van por `ui/aviso.avisar` (Alert no hace nada en la web).
- **La web se acomoda al ancho** (24/oct/2026, el usuario dejó la distribución a criterio de Claude;
  las animaciones no se tocan). Todo sale de `ui/disposicion.useDisposicion()`. Menos de 700 px
  (teléfono): igual que la app. Desde 700: la barra va al costado (riel de íconos; con nombres y
  «Anotar» desde 1100), sin botón de Ajustes arriba (está en la barra), y las hojas, el tutorial y
  el selector de mes salen como ventana al centro. Con contenido de 760 o más, dos columnas:
  Inicio (pila o calendario | Recientes o el día; el Inicio se parte ya desde 640, porque estiradas
  las tarjetas pierden su forma), Movimientos (lista | Gráficos, sin el selector), Presupuesto
  (periodo y resumen | vasos), una cuenta (su color y datos | su historia). Las grillas toman las
  columnas que caben (`columnasPara`); listas y Ajustes no pasan de 640 (`angosto` en `Marco`).
  Para probar tamaños: marcos (`iframe`) de 390, 820, 1180 y 1440 en una página del servidor de
  prueba, porque la ventana de Chrome de Claude se abre maximizada y no se deja achicar.
  En el iPhone desde el ícono (iOS 26), `viewport-fit=cover` y las etiquetas `apple-mobile-web-app-*` hacían que
  iOS dibujara la página detrás de la hora con el alto de la pantalla menos esa barra (franja vacía abajo): la
  página **no las lleva** (24/oct), como la web de la app universitaria, que en el mismo iPhone llega hasta abajo.
  De respaldo, `index.html` mide el alto real (`alto-real`/`--alto`) si iOS informa un margen arriba. Los
  márgenes salen de `ui/zonaSegura` (nunca `useSafeAreaInsets` directo; la versión web deja 14 px más arriba si
  hay margen). Las hojas en la web empiezan debajo de ese margen.
  Por http (Tailscale) Safari no da `crypto.randomUUID`: `formato.nuevoId` arma el UUID a mano.
  La web va en **un solo archivo** (`asyncRoutes.web: false`: por pantallas sueltas, la de inicio
  del iPad se quedaba en negro) y el servidor la manda **comprimida** (gzip). Si la letra no carga,
  sigue con la del sistema; si algo falla al abrir, `public/index.html` muestra el error y «Recargar».
- **Montos en centavos (enteros)** en base y API. Fechas ISO. Formato de pantalla $1,234.56.
- **Recurrencias = reglas**, no copias por adelantado: el servidor anota cada movimiento cuando
  llega su fecha (`recurrencias.materializar`, al pedir datos y cada 30 min) y guarda
  `generada_hasta`; no duplica y lo borrado no vuelve. La app vieja creaba 12 copias de una vez:
  ese era el bug.
- **Lo que viene** (lo que se repite y todavía no llega) sale **arriba de la lista de Movimientos,
  solo lo que falta del mes actual** («Por venir en octubre», borde punteado); cuando llega su día
  pasa a la lista y el mes siguiente trae los suyos (`calculos.porVenirDelMes`). El usuario NO
  quiere una pestaña aparte de Próximos ni de recurrentes; las reglas se editan tocándolas o en
  Ajustes → Se repiten.
- **Offline**: cada cambio se ve al instante, queda en una cola (expo-sqlite/kv-store) y se manda
  en orden; ids UUID del teléfono y PUT idempotentes, así un reintento no duplica.
- **Un solo estilo** (19/oct/2026), basado en Billetera: barra abajo (Inicio · Movimientos · + ·
  Presupuesto · Cuentas), cuentas como tarjetas apiladas, letra Onest en todo (montos con cifras
  tabulares), escala de tamaños 11·12·13·14·15·17·20·22·24·28·34. De Mosaico toma el presupuesto
  en vasos/cuadros. Los otros 4 estilos se borraron. Claro/oscuro/Automático y color principal
  siguen; todo sale de `useTema()`, nada de colores fijos.
- **Verde = ingreso, rojo = gasto en toda la app** (`c.ingreso`, `c.gasto`); `bien`/`alerta` son para
  estados. Sobre el color de una cuenta se usa la tinta de contraste, no rojo/verde.
- **Inicio**: arriba el saldo que el usuario elige (total, libre después de lo que viene, balance,
  gastado o entró del mes: `calculos.saldos`), **solo** tocándolo o en Ajustes. Dos vistas:
  Tarjetas y Calendario (cada día con lo que entró en verde y salió en rojo). En Tarjetas, la
  **«pila de estado»** (elegida el 20/oct/2026), al estilo de Wallet (21/oct): la cuenta elegida queda
  **sola arriba**, con su estado dentro (saldo o deuda y corte, el mes +/−) y sus botones Anotar /
  Transferir (y Pagar si es de crédito con pago sugerido); las demás quedan **apiñadas debajo, cada
  una en su lugar fijo** (el orden de las cuentas nunca cambia) y todas tienen la misma vista, solo
  tapada. **Tocar la pila la abre** («Wallet normal», elegido el 23/oct; el usuario descartó
  arrastrar): cada tarjeta se pone casi de pie, vista desde arriba (58°), con canto y una cartera
  con sombra detrás, y se despliegan en cascada; tocar una abierta la pasa arriba con un salto por
  encima de las demás y la que estaba arriba vuelve a su lugar. Todo es de resortes
  (`ui/resorte.ts`, respuesta .5 y amortiguación 1, sin rebote: con .6 vibraba al llegar; separación 88,
  grosor 6, apiñado 40, arco 46: los valores que eligió en la maqueta). El cuadro de la pila recorta
  recto (con esquinas redondeadas iOS redibuja todo cada cuadro), se coloca con `translateY` y las
  sombras cambian por pasos, para que tocar rápido varias veces no se trabe. Abajo, **«Recientes» de TODAS las cuentas** y «Ver todo»
  va a Movimientos. Lo de abajo NO se filtra por la tarjeta de arriba: eso duplicaba la pantalla de
  la cuenta. Nada de barras sin rótulo. **Nada de lo que viene en el Inicio**: va arriba en Movimientos.
- **Cada pantalla tiene su trabajo, sin repetir**: Inicio = qué está pasando (saldos, lo último,
  atajos); una cuenta = qué pasó en ella (lo que viene en ella, en qué se gastó, su historial con
  buscador); Movimientos = todo el historial con filtros y gráficos; Cuentas = análisis.
- **Pestaña Cuentas** = el resumen de todas: cada forma de saldo con una estadística corta (reparto
  por cuenta, qué se descuenta, 6 meses de balance, promedio por día, de dónde entró) y las cuentas
  en cuadros. NO se elige ahí el saldo del Inicio (el usuario lo vio como desperdicio).
- **Tarjeta de crédito** = interruptor «Es tarjeta de crédito» en la cuenta (no hay tipos de cuenta):
  día de corte obligatorio; día de pago y pago mínimo opcionales (el usuario los copia, no se
  calculan). Su saldo es deuda. Se ve «Debes», «Gastado en este corte» (`calculos.cicloTarjeta`,
  `gastadoEnCorte`, `deudaTarjeta`). El pago es una transferencia que la app **sugiere**
  (`pagoSugerido`: en la tarjeta, su pantalla y «Por venir» de Movimientos) y el usuario confirma;
  nunca se anota sola.
- **Borrar una cuenta** siempre se puede (salvo la única): si tiene historia, avisa cuántos
  movimientos y reglas se van con ella (`DELETE ?con_todo=true`).
- **Categorías con símbolo** (`ui/simbolos.tsx`, ~39 íconos de línea) o emoji; `categoria.emoji` guarda
  `i:<clave>`, un emoji, o '💰' = sin elegir (se ve la inicial).
- **Presupuesto**: tocar una categoría abre su detalle (lo gastado, el tope, por día, las compras del
  periodo); editar el tope es la opción secundaria de ahí, no lo primero.
- **Periodo del presupuesto** (uno para todo; ajuste `presupuesto_periodo`/`presupuesto_inicio`):
  cada semana (día en que empieza), cada 2 semanas (desde una fecha), cada quincena (1–15 y 16–fin)
  o cada mes (día 1–28). Por defecto mensual desde el 1: nada obligatorio, hay quien no cobra en
  fechas fijas. Los topes son por periodo; al cambiarlo la app ofrece convertirlos
  (`calculos.convertirTope`). Todo sale de `calculos.periodoDe/periodoVecino/nombrePeriodo`.
- **Pasar lo que sobra** por categoría (`acumula`, `acumula_desde`): suma (tope − gastado) de los
  periodos desde `acumula_desde` (`calculos.arrastre`; usa el tope de hoy, no hay historial de
  topes). Al cambiar el periodo, el arrastre empieza de nuevo.
- Vasos de presupuesto: un solo color, sin raya en el borde. Nada del concepto "libro contable".
- Ideas sueltas para después: `IDEAS.md`.
- **Tutorial** único (`pantallas/Tutorial.tsx`) la primera vez; se repite desde Ajustes → «Ver cómo
  funciona». Si el manejo cambia, el tutorial se actualiza.
- **Recurrencias**: semanal, cada 2 semanas (`catorcenal`, 26 al año), cada quincena (`quincenal`,
  dos veces al mes: el día de inicio y 15 días después), mensual, anual.

## Estado (20/oct/2026)

- Servidor con 39 pruebas (esquema v4). App con un solo estilo, modo oscuro, color principal,
  tutorial, anotar/editar, reglas que se repiten, lo que viene del mes arriba de Movimientos,
  buscador, gráficos, presupuesto por periodo (semana/2 semanas/quincena/mes) con topes, pasar lo
  que sobra y detalle por categoría, tarjeta de crédito,
  símbolos de categoría, borrar cuentas, exportar, QR para conectar.
- `app.json` pasó a `userInterfaceStyle: automatic`, compilado en `ios-dev-3`
  (`app-iphone\gastos-dev-3.ipa`). Con `ios-dev-2`, «Automático» se ve oscuro; Claro y Oscuro
  funcionan con cualquier build.
- El usuario ya instaló la app con Sideloadly, está conectada y la usa (19/oct). Está probando los
  diseños y anotando lo que quiere cambiar; los ve algo genéricos. No migró datos: los de la app
  vieja eran de prueba.

## Qué sigue (ideas acordadas)

1. Usar la app y pulir lo que salga (el usuario va anotando cambios de diseño).
1b. **Funciones acordadas tras investigar** (Money Manager, Buddy, Copilot, YNAB…). Hechas: la
   tarjeta de crédito y los presupuestos por periodo. Siguen: favoritos/plantillas, subcategorías,
   metas y fondos (ver `IDEAS.md`).
2. **Gasto por voz** (en veremos: el usuario la usa poco; si se hace, que use las categorías ya
   creadas): grabar en la app → Whisper en la PC → `claude -p --model sonnet` lo vuelve
   movimiento → bandeja «Por revisar» (nada entra solo).
3. **Foto del recibo** → monto, comercio y categoría → la misma bandeja.
4. Resumen semanal/mensual con IA.
5. **Captura automática** de gastos e ingresos (p. ej. Atajos de iPhone disparados por la
   notificación del banco, o una extensión nativa). En veremos: necesita la cuenta de pago de
   Apple (99 USD/año), que el usuario aún no tiene.

## Convenciones

- Un commit = un cambio que se describe en una línea. Pushear el mismo día. Los commits y el push
  los hace Claude (el usuario no usa git).
- Antes de dar por terminado algo de la app: `npx tsc --noEmit`, `npx expo export --platform ios
  --output-dir <scratchpad>` (sin `--output-dir` pisa la web de `dist\`) y `npx expo export --platform web`
  (que el paquete compile). Del servidor: `uv run pytest`.
- Expo cambia mucho entre versiones: antes de usar una API, leer la doc de la versión del
  `package.json` (ver `app\AGENTS.md`). Dependencias siempre con `npx expo install`.
- Si cambia el esquema: subir `VERSION` en `db.py` y agregar el paso en `MIGRACIONES`.
