import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const base = mode === 'desktop' ? './' : process.env.VITE_BASE_PATH || '/icon-core/app/';

  return {
    base,
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: 5173
    }
  };
});
