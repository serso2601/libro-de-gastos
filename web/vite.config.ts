// La web se sirve desde el servidor de la PC, en /web. Mientras se trabaja en ella, `npm run dev`
// la levanta aparte y le pasa al servidor lo que es de la API.

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const servidor = process.env.SERVIDOR ?? 'http://127.0.0.1:8766';

export default defineConfig({
  base: '/web/',
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174,
    proxy: { '^/(api|web/entrar|web/salir)': servidor },
  },
});
