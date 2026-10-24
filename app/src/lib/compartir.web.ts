// La versión web de compartir.ts: el navegador descarga el archivo (en Safari queda en Descargas).

export async function compartirArchivo(nombre: string, texto: string): Promise<void> {
  const url = URL.createObjectURL(new Blob([texto], { type: 'application/json' }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
