import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/react-data-grid/lib/styles.css',
          dest: 'styles'
        }
      ]
    })
  ],
  optimizeDeps: {
    exclude: ['lucide-react'] // Opcional, si no usas Lucide puedes quitar esta línea
  },
  server: {
    hmr: {
      overlay: false // Evita que errores de hot reload bloqueen el preview
    }
  }
});