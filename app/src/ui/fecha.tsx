// Elegir un día (calendario del mes, siempre abierto) y una hora. En el teléfono son los de iOS;
// en la web, los de fecha.web.tsx.

import DateTimePicker from '@react-native-community/datetimepicker';
import { aFecha, fechaISO, horaTexto } from '@/lib/formato';
import { useTema } from './tema';

export function CalendarioFecha({ valor, alCambiar, minimo }: { valor: string; alCambiar: (iso: string) => void; minimo?: string }) {
  const { c, oscuro } = useTema();
  return (
    <DateTimePicker value={aFecha(valor)} mode="date" display="inline" locale="es-PA" accentColor={c.acento} themeVariant={oscuro ? 'dark' : 'light'}
      minimumDate={minimo ? aFecha(minimo) : undefined} onChange={(_, d) => d && alCambiar(fechaISO(d))} />
  );
}

/** `valor` es «HH:MM». */
export function SelectorHora({ valor, alCambiar }: { valor: string; alCambiar: (hora: string) => void }) {
  const { c, oscuro } = useTema();
  const d = new Date();
  const [h, m] = valor.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return (
    <DateTimePicker value={d} mode="time" display="compact" locale="es-PA" accentColor={c.acento} themeVariant={oscuro ? 'dark' : 'light'}
      onChange={(_, x) => x && alCambiar(horaTexto(x))} />
  );
}
