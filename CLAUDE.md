# Libro de Gastos — contexto del proyecto

App personal de gastos/ingresos para uso propio en iPhone (no multiusuario, no hay backend, no hay servidor que mantener). Nace de una conversación en Claude.ai donde se armó primero como artifact de React y después se portó a una PWA estática para poder instalarla de verdad en el teléfono.

## Objetivo de esta sesión

1. Inicializar git en esta carpeta y subir el proyecto a un repo nuevo en GitHub.
2. Activar GitHub Pages para que quede accesible en `https://<usuario>.github.io/<repo>/`.
3. A partir de ahí, seguir iterando la app (nuevas features, ajustes de diseño, bugs) como me pida el usuario.

No asumas que hay que migrar a un framework con build step (React+Vite, etc.) salvo que el usuario lo pida explícitamente — la decisión de que sea un sitio estático sin build fue intencional (ver más abajo).

## Stack técnico (intencional, no lo cambies sin que te lo pidan)

- **Un solo archivo `index.html`** con toda la app adentro. React 18 y Babel Standalone se cargan por CDN (`<script type="text/babel">`), así que el JSX se transpila en el propio navegador — no hay paso de build ni `npm install`.
- **Tailwind vía Play CDN** (`cdn.tailwindcss.com`) — da el JIT completo en el navegador, así que cualquier clase de Tailwind funciona sin configuración.
- **Chart.js** (CDN) para los gráficos — se eligió por sobre `recharts` porque tiene build UMD simple y confiable vía CDN.
- **Sin librería de íconos externa** (se sacó `lucide-react` porque no tiene build CDN práctico): hay un componente `Icon` casero que devuelve SVGs simples para los íconos geométricos (flechas, chevrons, +, x) y emoji para el resto (🗑️ ✏️ ⚙️ ⚠️ 🔁 etc). Las categorías también usan emoji elegido por el usuario.
- **Persistencia:** `localStorage` del navegador, clave `"finance-data"`, un solo blob JSON con todo (cuentas, categorías, transacciones, presupuestos, moneda). 100% local al dispositivo, no depende de ninguna cuenta ni servicio externo.
- **PWA real:** `manifest.json` + `sw.js` (service worker, cache-first para los assets propios) + `apple-touch-icon.png` para que "Añadir a inicio" en iOS instale un ícono propio y funcione offline.

## Archivos

```
index.html          — toda la app (componentes React inline, ver abajo)
manifest.json        — metadata de la PWA
sw.js                 — service worker (cache-first)
icon-192.png          — ícono PWA
icon-512.png          — ícono PWA
apple-touch-icon.png  — ícono específico de iOS (180x180, sin bordes redondeados; iOS los redondea solo)
```

Si agregás o renombrás archivos que la app deba cachear offline, actualizá el array `CORE_ASSETS` en `sw.js`.

## Modelo de datos (todo vive en un solo objeto guardado en localStorage)

```js
{
  accounts: [{ id, name, color, initialBalance }],
  categories: [{ id, name, type: "expense" | "income", color, emoji }],
  transactions: [
    // gasto o ingreso
    { id, kind: "expense" | "income", amount, date, time, accountId, categoryId, note,
      recurrence: null | "weekly" | "monthly", recurrenceGroupId: string | null },
    // transferencia entre cuentas
    { id, kind: "transfer", amount, date, time, fromAccountId, toAccountId, note }
  ],
  budgets: { [categoryId]: montoMensual },
  currency: "$" // símbolo, editable en Configuración
}
```

Notas importantes:
- El saldo de una cuenta **no se guarda**, se calcula siempre a partir de `initialBalance` + las transacciones que la afectan (función `accountBalance`).
- Las recurrencias **no son infinitas**: al crear una transacción recurrente se generan de una vez 12 ocurrencias (12 semanas si es semanal, 12 meses si es mensual), todas con el mismo `recurrenceGroupId`. Si el usuario pide recurrencia infinita o "renovar" automáticamente, hay que pensar esa lógica (por ejemplo, generar más ocurrencias cuando queden pocas).
- Borrar una cuenta o categoría está bloqueado si tiene transacciones asociadas (o si es la única cuenta que queda) — ver `deleteAccountSafe` / `deleteCategorySafe`.
- El orden de cuentas y categorías en sus arrays importa: se puede reordenar desde "Configuración" (flechas arriba/abajo) y ese orden se refleja en toda la app.

## Diseño / sistema visual

Estética "fintech oscuro" moderna, tipo apps de finanzas personales (referencia visual que dio el usuario: fondo casi negro, tarjetas sólidas redondeadas sin bordes decorativos, verde menta para positivo/ingresos, rojo para gastos, azul como acento de acción). Se descartó un rediseño anterior tipo "libro contable" (rayado de papel, margen rojo de libreta, bordes dobles, insignia circular, tipografía serif) porque al usuario no le gustó ese concepto — **no lo reintroduzcas** salvo pedido explícito.

- Tipografías: `IBM Plex Sans` (todo el texto, incluidos títulos en negrita vía `.font-display`), `IBM Plex Mono` (montos vía `.font-mono`). No hay fuente serif.
- Paleta (objeto `COLORS` en el código):
  - `paper` #0B0E13 (fondo general, casi negro), `card` #171B22 (tarjetas/modales), `cardAlt` #20252E (superficie anidada dentro de una tarjeta, p. ej. los mini-stats de gastos/ingresos), `ink` #F5F6F7 (texto principal), `inkMuted` rgba(245,246,247,0.5) (texto secundario), `rule` / `ruleStrong` (líneas divisorias sutiles, translúcidas), `good` #34D8A6 (verde menta, ingresos y montos positivos), `alert` #F16565 (rojo, gastos), `gold` #3B82F6 / `goldBright` #60A5FA (azul, acento de acción: CTAs, FAB, tabs activos, chips seleccionados — el nombre de la variable quedó de una iteración anterior pero ahora es azul, no dorado), `goldInk` #FFFFFF (texto claro sobre fondos de acento).
  - Paleta de categorías (`PALETTE`): 10 colores saturados (azul, verde menta, rojo, ámbar, violeta, rosa, etc.) para que el usuario elija al crear categorías/cuentas.
- Patrón visual: todo vive en tarjetas `rounded-2xl` con fondo `COLORS.card` flotando sobre el fondo casi negro, sin bordes visibles (la separación es por contraste de superficie, no por líneas). Dentro de una lista dentro de una tarjeta, los ítems se separan con un hairline sutil (`COLORS.rule`), nunca doble ni punteado.
- Los íconos de categoría/cuenta se muestran como placas cuadradas redondeadas (`rounded-xl`, ~40px) con fondo del color de la categoría/cuenta al ~15% de opacidad y el emoji (categorías) o la inicial del nombre (cuentas) adentro — no puntos de color, no numeración tipo libro contable.
- El botón "+" central es un círculo sólido azul (`COLORS.gold`) con sombra de color, no un gradiente radial dorado.
- Nada de: rayado de fondo, márgenes rojos verticales, bordes dobles/triples, bordes punteados, insignias circulares tipo sello. Si el usuario pide "más distintivo" de nuevo, proponé variaciones dentro de esta línea fintech-oscura (no volver al concepto de libreta) salvo que lo pida explícitamente.

## Funcionalidad ya implementada

5 secciones con navegación inferior (Resumen, Cuentas, Presupuesto, Movimientos, Gráficos) + botón "+" central con hoja de acciones (Gasto / Ingreso / Transferencia) + botón de Configuración (⚙️) en el header.

- **Resumen:** balance total, ingresos/gastos/neto del mes (con navegación de mes), últimos movimientos.
- **Cuentas:** lista con saldo calculado; tocar una entra al detalle con sus movimientos.
- **Presupuesto:** barra de progreso por categoría de gasto (se recalcula sola con cada gasto cargado), enlace a Configuración para gestionar categorías.
- **Movimientos:** lista completa (gastos/ingresos/transferencias) con filtro por tipo, agrupada por día; tocar una abre editar/borrar.
- **Gráficos:** torta de gastos por categoría (mes actual) + barras agrupadas ingresos vs. gastos (últimos 6 meses).
- **Configuración:** símbolo de moneda, y CRUD + reordenar de cuentas y categorías (gasto/ingreso separadas).
- **Transacciones:** monto, cuenta, categoría (filtrada según sea gasto/ingreso, con opción de crear categoría al vuelo), nota, fecha, hora opcional, recurrencia (no repetir / cada semana / cada mes).
- **Transferencias:** monto + cuenta origen/destino + nota + fecha.

## Cómo seguir

- El usuario va a seguir pidiendo cambios de features o de diseño en este mismo estilo — mantené la paleta, tipografías y el patrón de componentes (Modal genérico, TransactionRow reutilizable, etc.) al agregar cosas nuevas.
- Si el usuario pide algo que requiera sincronizar entre dispositivos (no solo local), avisale que eso cambia la arquitectura (necesitaría backend) antes de asumir que hay que agregarlo.
- Después de cualquier cambio, recordá probar que `index.html` siga abriendo bien como archivo estático (sin build) y hacer commit + push.
