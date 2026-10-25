# Pendientes — Libro de Gastos

Lo que quedó por probar, revisar o retomar. Claude lo lee al iniciar cada chat y se lo dice al usuario antes de
seguir con otra cosa (ver «Al iniciar cada chat» en `CLAUDE.md`). Al terminar una sesión se actualiza: lo que ya
se probó sale; lo que quedó a medias entra.

Última actualización: 25/oct/2026.

## Por probar: la app nativa en Expo Go (25/oct)

Para ver las animaciones y vibraciones de verdad (la web no las muestra igual) mientras Sideloadly siga bloqueado.
1. Instalar **Expo Go** de la App Store en el iPhone, con Tailscale prendido.
2. Abrir http://127.0.0.1:8766 en la PC y escanear el QR «App del iPhone (Expo Go)»: tiene que abrir la app ya
   conectada, con los datos. Si sale una pantalla roja, pedirle el texto y mirar `datos\registros\metro.log`.
3. Probar ahí lo de «Por probar en el iPhone» (abajo): la pila de tarjetas, la amortiguación, las vibraciones.

## Por probar en la web (iPad), hecha el 23/oct

Apple bloqueó Sideloadly, así que la app del iPhone no se puede volver a firmar por ahora. Se hizo la web: es la
misma app, servida por la PC en `http://<ip tailscale>:8766/app`. Se probó en Chrome de la PC (anotar con fecha y
hora, borrar con el aviso, las 4 pestañas, la pila, Ajustes, modo claro); **falta probarla en el iPad y el iPhone**:

1. **Abrirla desde el ícono de la pantalla de inicio del iPad.** El 23/oct en Safari abrió (lenta), pero desde el
   ícono se quedó en negro: según el registro bajó el código y pidió los datos, pero nunca la pantalla de Inicio.
   Se corrigió: un solo archivo en vez de pantallas sueltas, comprimido (de ~1.8 MB a ~0.6 MB), y la app ya no
   espera para siempre a la letra. Si vuelve a fallar, a los 20 s sale «No terminó de abrir» con el error: pedirle
   al usuario ese texto. El usuario entra con el link y la clave, sin QR.
1b. **La web en el iPhone, a pantalla completa** (24/oct, 2.º intento). El registro dio `956/894+0`: iOS 26 le daba
   a la página el alto de la pantalla menos la barra de la hora (62) pero la dibujaba desde arriba (franja vacía
   abajo, «Cancelar» escondido). El 1.er arreglo (medir el alto) no actuó: midió el margen de arriba antes de que
   iOS lo diera. Ahora la página va **sin `viewport-fit=cover` ni las etiquetas `apple-mobile-web-app-*`**, como la
   web de la app universitaria, que en el mismo iPhone llega hasta abajo; la medición queda de respaldo y vuelve a
   medir durante los primeros segundos. **Falta verlo:** borrar el ícono de la pantalla de inicio, volver a
   agregarlo desde Safari y abrirlo: barra de pestañas hasta abajo, «‹ Volver» y «Cancelar» visibles y tocables, y
   que abra sin la barra de Safari. Si no queda, buscar «Arranque web» en `datos\registros\servidor.log` (`alto` =
   pantalla/alto que dio iOS+margen de arriba, y el de abajo).
1c. **Lo que tarda en abrir.** Era la letra: el registro daba «dibujo» de 12.4–12.9 s en el iPhone y el iPad, justo
   lo que `expo-font` espera a que Safari confirme la letra antes de rendirse (12 s). Ahora en la web no se espera
   (la letra entra cuando llega) y el servidor la manda como `font/ttf` (antes `application/octet-stream`). Ver en
   el registro que «dibujo» baje a 1–2 s; si sigue alto con «pagina» grande, es la conexión al despertar Tailscale.
2. Anotar algo en el iPad (aquí el UUID se arma a mano porque Safari por http no da `randomUUID`) y verlo en el
   teléfono.
3. Que el teclado de Safari no tape el botón Guardar de las hojas, y que el campo de hora abra la rueda de iOS.
4. **La web ya se acomoda al tamaño** (24/oct): en el teléfono igual que la app; en el iPad y la computadora, barra
   al costado, hojas como ventana y dos columnas (ver `CLAUDE.md`). Probado en Chrome a 390, 820, 1180 y 1440; falta
   verlo en el iPad de verdad (vertical y horizontal) y que el usuario diga si le gusta la distribución.
   Ideas si hace falta: que Ajustes y una cuenta abran sin tapar la barra lateral; atajos de teclado en la computadora.

## Por probar en el iPhone (en Expo Go, o cuando se pueda volver a firmar)

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
