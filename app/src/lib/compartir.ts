// Sacar un archivo de la app (el respaldo de Exportar). En el teléfono abre la hoja de compartir de
// iOS; en la web lo descarga (compartir.web.ts).

import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export async function compartirArchivo(nombre: string, texto: string): Promise<void> {
  const archivo = new File(Paths.cache, nombre);
  if (archivo.exists) archivo.delete();
  archivo.create();
  archivo.write(texto);
  await Sharing.shareAsync(archivo.uri, { mimeType: 'application/json', UTI: 'public.json' });
}
