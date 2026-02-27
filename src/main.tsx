import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'; // Importa para caching/fetching escalable
import App from './App.tsx';
import './index.css';

const queryClient = new QueryClient(); // Crea el client para manejo global de queries (ej. en reports Nutrición/Plagas)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}> {/* Wrappea para queries seguras/escalables en módulos */}
      <App />
    </QueryClientProvider>
  </StrictMode>
);