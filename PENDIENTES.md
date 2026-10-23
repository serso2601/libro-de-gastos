# Pendientes — Libro de Gastos

Lo que quedó por probar, revisar o retomar. Claude lo lee al iniciar cada chat y se lo dice al usuario antes de
seguir con otra cosa (ver «Al iniciar cada chat» en `CLAUDE.md`). Al terminar una sesión se actualiza: lo que ya
se probó sale; lo que quedó a medias entra.

Última actualización: 23/oct/2026.

## Por probar en el iPhone (recargando la app)

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
  o AirServer, de pago), la versión web de Expo, o un simulador en la nube (Appetize; pide un build para simulador).
- **Animaciones en toda la app.** Se eligió la pila al estilo «Wallet normal». Quedaron por decidir las
  microinteracciones de la pestaña F de la maqueta (https://claude.ai/artifact/QeqGTGT8HreSfFrN4bKFBX): botones con
  resorte, saldo que rueda, giro y brillo de la tarjeta, listas que entran, hoja de «Anotar» que se arrastra.
- **Limpieza:** borrar la rama `worktree-animaciones-tarjetas` de GitHub (ya está mezclada) y su carpeta de trabajo
  en `.claude\worktrees\`.

## Ideas acordadas más adelante

Ver «Qué sigue» en `CLAUDE.md` e `IDEAS.md` (favoritos/plantillas, subcategorías, metas y fondos, gasto por voz,
foto del recibo, resumen con IA, captura automática).
