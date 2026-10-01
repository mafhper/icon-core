import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { findFreePort } from '../../scripts/dev-port.mjs';

const base = process.env.VITE_BASE_PATH || '/icon-core/';

export default defineConfig(async () => {
  const preferred = Number(process.env.PORT) || 5174;
  const port = await findFreePort(preferred, { label: 'landing page' });

  if (port !== preferred) {
    console.warn(
      `\n  Port ${preferred} is already serving something on 127.0.0.1 ` +
        `(another project, or the web app falling back?).\n` +
        `  The landing page will use ${port} instead — open the URL printed below.\n`
    );
  }

  return {
    base,
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port,
      strictPort: true
    }
  };
});