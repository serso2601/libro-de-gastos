# Libro de Gastos — contexto del proyecto

App personal de gastos e ingresos para el iPhone del usuario. Es una **app nativa (Expo)** que
guarda todo en un **servidor que corre en la PC**; el teléfono llega a la PC por **Tailscale**, en
casa y afuera. Todo gratis, sin servicios externos. Es un proyecto independiente: tiene su propio
servidor, puerto, base, datos y repo, y se organiza como mejor le sirva a esta app.

El repo es **público** (github.com/serso2601/libro-de-gastos, rama `master`): nada de datos, tokens
ni montos reales en el repo.

## Dónde está cada cosa

```
Documents\PROYECTO APP DE GASTOS\      ← el repo
├── app\                     ← la app del iPhone: Expo SDK 58, expo-router, TypeScript
│   └── src\app\             ← rutas: (pestanias)\ (Inicio + 4 secciones), ver\[pantalla] (secciones
│                                abiertas encima, con «‹ volver»), cuenta\[id], ajustes, conectar
│       src\pantallas\       ← las pantallas; inicio\ trae un Inicio por estilo; Tutorial.tsx
│       src\lib\             ← datos (almacén + cola offline), api, acciones, calculos, formato, tipos
│       src\dialogos\        ← las hojas: anotar, regla que se repite, cuenta, categoría, topes
│       src\ui\              ← estilos (los 5), tema (claro/oscuro/color), componentes, gráficos, marco
├── servidor\                ← FastAPI + SQLite (uv). Paquete `gastos`. `uv run pytest`
├── scripts\iniciar.ps1      ← arranca el servidor (8766) y Metro (8082); lo corre el inicio de Windows
├── scripts\instalar-inicio.ps1 · abrir-firewall.ps1
├── .github\workflows\ios.yml ← compila el .ipa sin firmar en una Mac de GitHub (etiqueta ios-*)
└── docs\                    ← LA APP VIEJA (PWA). GitHub Pages la sirve desde docs/ en la misma
                               dirección de siempre: los datos del usuario viven en el localStorage
                               de esa dirección. Se retira cuando el usuario haya pasado sus datos.
```

Dentro de la carpeta pero **ignorado por git** (nunca sube al repo público):
- **`datos\`** — `gastos.db`, `token.txt`, `respaldos\` (una copia por día, se guardan 30) y
  `registros\` (servidor, Metro, inicio).
- **`app-iphone\`** — los .ipa compilados (`gastos-dev-N.ipa`), para arrastrar a Sideloadly.

## Cómo corre

- **Servidor** en `0.0.0.0:8766`, pero solo atiende a la PC misma y a la tailnet (100.64.0.0/10):
  lo demás recibe 403 antes de mirar el token. Entra con `Authorization: Bearer <token.txt>`.
- **Página de estado** http://127.0.0.1:8766 (acceso directo en el escritorio). Abierta en la PC
  muestra el **QR para conectar el iPhone** (`librogastos://conectar?d=<ip>:8766&t=<token>`): la
  cámara del iPhone lo lee y la app se conecta sola.
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

## Decisiones tomadas (no repreguntarlas)

- **App nativa con Expo**, no web. La web se hará cuando la app esté armada y se vea bien.
- **Montos en centavos (enteros)** en base y API. Fechas ISO. Formato de pantalla $1,234.56.
- **Recurrencias = reglas**, no copias por adelantado: el servidor anota cada movimiento cuando
  llega su fecha (`recurrencias.materializar`, al pedir datos y cada 30 min) y guarda
  `generada_hasta`; no duplica y lo borrado no vuelve. Lo que viene sale en «Próximos». La app
  vieja creaba 12 copias de una vez: ese era el bug.
- **Offline**: cada cambio se ve al instante, queda en una cola (expo-sqlite/kv-store) y se manda
  en orden; ids UUID del teléfono y PUT idempotentes, así un reintento no duplica.
- **Sistema visual: 5 estilos** que el usuario elige en Ajustes (`ui/estilos.ts`): Billetera
  (tarjetas apiladas + barra abajo), Mosaico (bloques de colores, sin barra), Calendario (calendario
  de calor + barra flotante), Cartera en mosaico y Calendario en mosaico (sin barra, todo sale del
  Inicio). Cada uno con sus fuentes, medidas y colores, en claro y oscuro (Automático/Claro/Oscuro)
  y con color principal cambiable. Las pantallas son las mismas y leen el tema con `useTema()`:
  nada de colores fijos. Los diseños salen del lienzo https://claude.ai/artifact/8xnZiaBVscpofjQ4LpVJtL.
  Dentro de un estilo, mismas medidas en todas las pantallas. Vasos de presupuesto: un solo color,
  sin raya en el borde. Nada del concepto "libro contable" que el usuario descartó.
- **Tutorial** la primera vez que se usa cada estilo (`pantallas/Tutorial.tsx`); se repite desde
  Ajustes → «Ver cómo funciona». Si un estilo cambia cómo se maneja algo, su tutorial lo explica.

## Estado (17/oct/2026)

- Servidor con 25 pruebas. App con los 5 estilos, modo oscuro, color principal, tutoriales,
  anotar/editar, reglas que se repiten, Próximos, buscador, presupuesto con topes, importar el
  respaldo de la app vieja, exportar, QR para conectar. App vieja: botón «Exportar mis datos».
- `app.json` pasó a `userInterfaceStyle: automatic`: hasta instalar un build nuevo, «Automático»
  se ve oscuro; Claro y Oscuro funcionan con cualquier build.
- **Pendiente del usuario:** correr `scripts\abrir-firewall.ps1` (admin), instalar el primer .ipa
  con Sideloadly, conectar con el QR, exportar de la app vieja e importar en la nueva.

## Qué sigue (ideas acordadas)

1. Usar la app y pulir lo que salga. Retirar la app vieja de Pages cuando ya no haga falta.
2. **Gasto por voz:** grabar en la app → Whisper en la PC → `claude -p --model sonnet` lo vuelve
   movimiento → bandeja «Por revisar» (nada entra solo).
3. **Foto del recibo** → monto, comercio y categoría → la misma bandeja.
4. Resumen semanal/mensual con IA.

## Convenciones

- Un commit = un cambio que se describe en una línea. Pushear el mismo día. Los commits y el push
  los hace Claude (el usuario no usa git).
- Antes de dar por terminado algo de la app: `npx tsc --noEmit` y `npx expo export --platform ios`
  (que el paquete compile). Del servidor: `uv run pytest`.
- Expo cambia mucho entre versiones: antes de usar una API, leer la doc de la versión del
  `package.json` (ver `app\AGENTS.md`). Dependencias siempre con `npx expo install`.
- Si cambia el esquema: subir `VERSION` en `db.py` y agregar el paso en `MIGRACIONES`.
