import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/* `npm run build:demo` builds the public preview: the app answering its own shelves out of
   demo.json, with every path relative so it lives under a folder on somebody else's host as
   easily as it lives at the root of her own machine. */
export default defineConfig(({ mode }) => {
  const DEMO = mode === 'demo' || process.env.LAHN_DEMO === '1';
  return {
    base: './',
    define: { 'import.meta.env.VITE_LAHN_DEMO': JSON.stringify(DEMO ? '1' : '') },
    plugins: [react()],
    server: {
      host: true,
      port: 5173,
      proxy: {
        '/api': { target: 'http://localhost:4780', changeOrigin: true, ws: false },
      },
    },
    build: { outDir: DEMO ? 'dist-demo' : 'dist', emptyOutDir: true },
  };
});
