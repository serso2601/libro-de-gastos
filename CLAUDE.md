# Libro de Gastos — contexto del proyecto

App personal de gastos/ingresos para uso propio en el iPhone. Desde el **16/oct/2026** sigue el
mismo modelo que la App Universitaria (`Documents\APP UNIVERSITARIA`): **la PC es el servidor**,
el teléfono entra por **Tailscale**, todo gratis y sin servicios externos. Las bases de datos de las
dos apps no tienen nada que ver; lo que se comparte es la forma de trabajar y los accesos.

El repo es **público** (github.com/serso2601/libro-de-gastos, rama `master`): nada de datos, tokens
ni montos reales en el repo.

## Dónde está cada cosa

```
Desktop\PROYECTO APP DE GASTOS\        ← el repo
├── CLAUDE.md                          ← este archivo
├── backend\servidor\                  ← FastAPI + SQLite (uv). `uv run pytest` corre las pruebas
│   └── servidor\  api.py · db.py · esquema.sql · recurrencias.py · importar.py · web.py · pagina.py · config.py
├── web\                               ← la app nueva: Vite 8 + React 19 + TS + Tailwind 4. Se compila a web\dist
│                                        (no va al repo) y el servidor la sirve en /web
├── scripts\iniciar.ps1                ← arranca el servidor (8766) y publica con Tailscale Serve
├── scripts\instalar-inicio.ps1        ← acceso directo en shell:startup + "Estado Libro de Gastos.url" en el escritorio
└── index.html · sw.js · manifest.json · icon-*.png   ← LA APP VIEJA (GitHub Pages). Sigue viva hasta
                                          que el usuario pase sus datos; después se retira
```

Fuera del repo: **`~\LibroDeGastos\datos\`** — `gastos.db`, `token.txt`, `respaldos\` (una copia
por día, se guardan 30) y `registros\` (logs del servidor y del arranque). Nunca al repo.

## Cómo corre en esta PC

- **Arranca solo** al iniciar sesión (acceso directo `Libro de Gastos.lnk` en `shell:startup` que
  corre `scripts\iniciar.ps1`). Servidor en `127.0.0.1:8766` (el 8765 es de la universitaria).
  Estado en http://127.0.0.1:8766 (página pública, sin token).
- **Acceso desde el iPhone: Tailscale Serve con HTTPS** → `https://sersopc.tail8d7613.ts.net/web/`.
  Safari necesita HTTPS para instalar la app de verdad (service worker, offline) y para el micrófono
  (gastos por voz, más adelante). `iniciar.ps1` corre `tailscale serve --bg 8766` (idempotente).
- **Entrar:** la web pide el token una vez (`token.txt`) y deja una cookie `httponly` por un año.
  Un enlace `.../web/?t=<token>` entra solo. La app instalada en la pantalla de inicio tiene sus
  propias cookies: puede pedir el token una vez más después de instalarla.
- **Tras cambiar la web:** `cd web; npm run build` (el servidor sirve `web\dist` directamente, no
  hace falta reiniciarlo). Tras cambiar el backend: matar el proceso del 8766 y correr `iniciar.ps1`.

## Decisiones tomadas (no repreguntarlas)

- **Misma infraestructura que la universitaria**: servidor en la PC, Tailscale, arranque automático,
  todo gratis. Web PWA en vez de app nativa: no hay que firmar ni renovar cada 7 días.
- **Montos en centavos (enteros)** en la base y en la API. Fechas ISO. Formato de pantalla es-PA (1,234.56).
- **Recurrencias = reglas** (`recurrencia`), no copias por adelantado. El servidor crea cada
  movimiento cuando llega su fecha (`recurrencias.materializar`, al pedir datos y cada 30 min) y
  anota `generada_hasta`: no duplica y una ocurrencia borrada no vuelve. Lo que viene se muestra en
  «Próximos» (calculado, no guardado). Las mensuales cuentan siempre desde la fecha de inicio (31 →
  30 → 28 → 31). La app vieja creaba 12 copias de una vez: ese era el bug que se arregló.
- **Offline-first en la web**: cada cambio se ve al instante, queda en una cola en localStorage y se
  manda en orden; ids UUID del cliente y PUT idempotentes, así un reintento nunca duplica.
- **Sistema visual**: el de siempre (fintech oscuro, IBM Plex Sans/Mono, tarjetas sin bordes, menta
  para ingresos, rojo para gastos, azul de acento). Nada del concepto "libro contable" que se descartó.
- No sincronizar con otros servicios ni cuentas: todo vive en la PC.

## Estado (16/oct/2026)

- Hecho: servidor con pruebas (24 pasan), web nueva con las 5 pestañas de antes + Próximos,
  reglas que se repiten (crear/editar/terminar), buscador de movimientos, importación del respaldo
  viejo (con vista previa), exportar, respaldo diario. Íconos generados (también para la app vieja).
  App vieja: botón «Exportar mis datos» en Configuración (commit 24980fd).
- **Falta del lado del usuario:** activar Serve/HTTPS en la tailnet (el enlace sale en
  `registros\inicio.log`), exportar los datos desde la app vieja e importarlos en la nueva
  (Ajustes → Traer datos de la app vieja), e instalar la nueva en la pantalla de inicio.

## Qué sigue (ideas acordadas, en este orden)

1. Pasar los datos y usar la app nueva; retirar la vieja de GitHub Pages cuando ya no haga falta.
2. **Gasto por voz:** grabar en la web → Whisper en la PC (como la universitaria) → `claude -p
   --model sonnet` lo convierte en movimiento → bandeja «Por revisar» (nada entra solo).
3. **Foto del recibo** → el agente saca monto, comercio y categoría → misma bandeja.
4. Resumen semanal/mensual con IA (en qué se fue la plata, qué se disparó, cómo va el presupuesto).

## Convenciones

- Un commit = un cambio que se describe en una línea sin "y". Pushear el mismo día.
- El usuario no usa git: commits y push los hace Claude.
- Si cambia el esquema: subir `VERSION` en `db.py`, agregar el paso en `MIGRACIONES` y probarlo
  con una copia de `gastos.db` (hay respaldos diarios en `datos\respaldos`).
