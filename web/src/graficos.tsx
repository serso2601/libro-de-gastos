import { ArcElement, BarController, BarElement, CategoryScale, Chart, DoughnutController, LinearScale, Tooltip } from 'chart.js';
import { useEffect, useRef } from 'react';
import { dinero } from './formato';
import { C } from './ui';

Chart.register(DoughnutController, ArcElement, BarController, BarElement, CategoryScale, LinearScale, Tooltip);

export function Dona({ datos, moneda }: { datos: { nombre: string; total: number; color: string }[]; moneda: string }) {
  const lienzo = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!lienzo.current) return;
    const g = new Chart(lienzo.current, {
      type: 'doughnut',
      data: {
        labels: datos.map((c) => c.nombre),
        datasets: [{ data: datos.map((c) => c.total), backgroundColor: datos.map((c) => c.color), borderColor: C.tarjeta, borderWidth: 2 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '62%',
        plugins: { tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${dinero(ctx.parsed, moneda)}` } } },
      },
    });
    return () => g.destroy();
  }, [datos, moneda]);
  return <div style={{ width: '100%', height: 180 }}><canvas ref={lienzo} /></div>;
}

export function Barras({ datos, moneda }: { datos: { etiqueta: string; ingresos: number; gastos: number }[]; moneda: string }) {
  const lienzo = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!lienzo.current) return;
    const g = new Chart(lienzo.current, {
      type: 'bar',
      data: {
        labels: datos.map((m) => m.etiqueta),
        datasets: [
          { label: 'Ingresos', data: datos.map((m) => m.ingresos / 100), backgroundColor: C.bien, borderRadius: 4 },
          { label: 'Gastos', data: datos.map((m) => m.gastos / 100), backgroundColor: C.alerta, borderRadius: 4 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { tooltip: { callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${dinero(Math.round((ctx.parsed.y ?? 0) * 100), moneda)}` } } },
        scales: {
          x: { grid: { display: false }, ticks: { color: C.tenue, font: { size: 11 } } },
          y: { ticks: { color: C.tenue, font: { size: 10 } }, grid: { color: C.linea } },
        },
      },
    });
    return () => g.destroy();
  }, [datos, moneda]);
  return <div style={{ width: '100%', height: 170 }}><canvas ref={lienzo} /></div>;
}
