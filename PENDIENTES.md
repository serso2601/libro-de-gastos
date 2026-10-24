# Pendientes — Libro de Gastos

Lo que quedó por probar, revisar o retomar. Claude lo lee al iniciar cada chat y se lo dice al usuario antes de
seguir con otra cosa (ver «Al iniciar cada chat» en `CLAUDE.md`). Al terminar una sesión se actualiza: lo que ya
se probó sale; lo que quedó a medias entra.

Última actualización: 23/oct/2026.

## Por probar en la web (iPad), hecha el 23/oct

Apple bloqueó Sideloadly, así que la app del iPhone no se puede volver a firmar por ahora. Se hizo la web: es la
misma app, servida por la PC en `http://<ip tailscale>:8766/app`. Se probó en Chrome de la PC (anotar con fecha y
hora, borrar con el aviso, las 4 pestañas, la pila, Ajustes, modo claro); **falta probarla en el iPad y el iPhone**:

1. **Abrirla desde el ícono de la pantalla de inicio del iPad.** El 23/oct en Safari abrió (lenta), pero desde el
   ícono se quedó en negro: según el registro bajó el código y pidió los datos, pero nunca la pantalla de Inicio.
   Se corrigió: un solo archivo en vez de pantallas sueltas, comprimido (de ~1.8 MB a ~0.6 MB), y la app ya no
   espera para siempre a la letra. Si vuelve a fallar, a los 20 s sale «No terminó de abrir» con el error: pedirle
   al usuario ese texto. El usuario entra con el link y la clave, sin QR.
1b. **Que llegue hasta abajo en el iPhone** (desde el ícono quedaba una franja negra bajo la barra de pestañas). Se
   pasó la barra de estado a sólida (`black`): con `black-translucent` iOS calcula mal el alto. Si sigue la franja,
   borrar el ícono y volver a agregarlo (iOS puede guardar la barra al agregarlo).
1c. **Lo que tarda en abrir** (4–5 s en el iPhone; en la PC dibuja en 0.14 s y el teléfono ya no vuelve a bajar el
   código). Cada vez que abre, la web le manda a la PC sus tiempos: buscar «Arranque web» en
   `datos\registros\servidor.log` (pagina = llegó la página, dibujo = se vio algo, en ms). Si «pagina» es grande, es
   la conexión al despertar Tailscale; si es «dibujo», es el teléfono procesando. Lo que no aparece ahí (antes de
   que empiece la página) es lo que tarda iOS en abrir la web desde el ícono.
2. Anotar algo en el iPad (aquí el UUID se arma a mano porque Safari por http no da `randomUUID`) y verlo en el
   teléfono.
3. Que el teclado de Safari no tape el botón Guardar de las hojas, y que el campo de hora abra la rueda de iOS.
4. En el iPad la app va en una columna del ancho de un teléfono, al centro. Si el usuario la quiere a lo ancho de
   la tableta, es un trabajo aparte de diseño.

## Por probar en el iPhone (cuando se pueda volver a firmar)

1. **Tocar muy rápido la pila de tarjetas, con varias cuentas** (PR #11). Antes se cargaba y se ponía lenta hasta que
   el usuario descansaba. Se limitaron las vibraciones (`ui/vibrar.ts`: una cada 120 ms; la de aterrizaje solo si no
   hubo otra en 350 ms) y los colores se calculan una vez. **Si aún se pone lenta:** probar dibujar solo las tarjetas
   que se mueven, o pasar las animaciones a Reanimated + Gesture Handler (pide un `.ipa` nuevo: etiqueta `ios-dev-N`
   y volver a firmar con Sideloadly).
2. **Amortiguación 1 (sin rebote)** en la pila. Ver si se siente muy seca; el rango útil es 0.8–1 (`AMORTIGUACION` en
   `pantallas/inicio/Tarjetas.tsx`).
3. **Que nada se dibuje fuera del cuadro de la pila** (abrir, elegir, cerrar): ya se vio bien en el teléfono el 23/oct;
   confirmar con varias cuentas y con el tema claro.

## Retomar

- **Ver el iPhone en la PC en tiempo real.** El usuario lo preguntó; se contestó de memoria y quedó ofrecido
  investigarlo a fondo e instalar la opción más fácil: reflejar la pantalla por AirPlay en Windows (UxPlay, gratis,
  o AirServer, de pago) o un simulador en la nube (Appetize; pide un build para simulador). La web ya se puede
  abrir en la PC misma: http://127.0.0.1:8766/app.
- **Animaciones en toda la app.** Se eligió la pila al estilo «Wallet normal». Quedaron por decidir las
  microinteracciones de la pestaña F de la maqueta (https://claude.ai/artifact/QeqGTGT8HreSfFrN4bKFBX): botones con
  resorte, saldo que rueda, giro y brillo de la tarjeta, listas que entran, hoja de «Anotar» que se arrastra.
- **Limpieza:** borrar la rama `worktree-animaciones-tarjetas` de GitHub (ya está mezclada) y su carpeta de trabajo
  en `.claude\worktrees\`.

## Ideas acordadas más adelante

Ver «Qué sigue» en `CLAUDE.md` e `IDEAS.md` (favoritos/plantillas, subcategorías, metas y fondos, gasto por voz,
foto del recibo, resumen con IA, captura automática).
