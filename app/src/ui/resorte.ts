// Resortes con respuesta y amortiguación (el modelo de Apple, no una curva fija): cada valor persigue
// su meta como un resorte, se puede interrumpir en cualquier momento (`ir` cambia la meta sin cortar el
// movimiento) y recibe la velocidad del dedo al soltar. El `Motor` corre un bucle de cuadros solo
// mientras haya algo en movimiento y repinta el componente en cada uno.

import { useEffect, useRef, useState } from 'react';

export class Resorte {
  x: number;
  v = 0;
  t: number;
  /** Segundos que tarda en llegar (más bajo = más rápido). */
  resp = 0.5;
  /** 1 = sin rebote; menos de 1 rebota un poco. */
  amort = 0.82;
  /** Hasta dónde se da por llegado: distancia y velocidad. Más holgado = deja de repintar antes. */
  eps = 5e-4;
  epsV = 5e-3;
  alAcabar?: () => void;

  constructor(x: number, private motor: Motor) {
    this.x = x;
    this.t = x;
  }

  /** Va hacia `t`; `v` es la velocidad con la que arranca (la del dedo al soltar). */
  ir(t: number, v?: number) {
    this.t = t;
    if (v !== undefined) this.v = v;
    this.motor.alta(this);
  }

  /** Lo deja quieto en `x` (mientras el dedo lo arrastra). */
  fijar(x: number) {
    this.x = x;
    this.t = x;
    this.v = 0;
    this.motor.baja(this);
    this.motor.repintar();
  }

  /** Avanza `dt` segundos. Devuelve false cuando ya llegó. */
  paso(dt: number): boolean {
    const k = (2 * Math.PI / this.resp) ** 2;
    const c = 4 * Math.PI * this.amort / this.resp;
    const n = Math.max(1, Math.ceil(dt * 240));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      this.v += (k * (this.t - this.x) - c * this.v) * h;
      this.x += this.v * h;
    }
    if (Math.abs(this.t - this.x) < this.eps && Math.abs(this.v) < this.epsV) {
      this.x = this.t;
      this.v = 0;
      return false;
    }
    return true;
  }
}

export class Motor {
  private activos = new Set<Resorte>();
  private raf = 0;
  private ultimo = 0;
  private muerto = false;

  constructor(readonly repintar: () => void) {}

  alta(r: Resorte) {
    this.activos.add(r);
    if (this.raf || this.muerto) return;
    this.ultimo = performance.now();
    this.raf = requestAnimationFrame(this.cuadro);
  }

  baja(r: Resorte) {
    this.activos.delete(r);
  }

  detener() {
    this.muerto = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.activos.clear();
  }

  private cuadro = (ahora: number) => {
    this.raf = 0;
    const dt = Math.min((ahora - this.ultimo) / 1000, 1 / 30);
    this.ultimo = ahora;
    const llegaron: Resorte[] = [];
    this.activos.forEach((r) => { if (!r.paso(dt)) llegaron.push(r); });
    llegaron.forEach((r) => this.activos.delete(r));
    this.repintar();
    llegaron.forEach((r) => r.alAcabar?.());
    if (this.activos.size && !this.raf && !this.muerto) this.raf = requestAnimationFrame(this.cuadro);
  };
}

/** Un motor atado al componente: se detiene al desmontarse. */
export function useMotor(): Motor {
  const [, setCuadro] = useState(0);
  const ref = useRef<Motor | null>(null);
  if (!ref.current) ref.current = new Motor(() => setCuadro((n) => n + 1));
  useEffect(() => {
    const m = ref.current!;
    return () => m.detener();
  }, []);
  return ref.current;
}
