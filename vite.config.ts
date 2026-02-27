import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import path from 'path'; // Para resolver alias escalable

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
    exclude: ['lucide-react'] // Opcional
  },
  server: {
    hmr: {
      overlay: false // Evita overlays en errors
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src') // Resuelve "@/*" -> "src/*" para imports modulares (ej. "@/components/ui/select.tsx")
    },
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json'] // Agrega para auto-resolver files sin extension (ej. select.tsx sin especificar .tsx en import)
  }
});