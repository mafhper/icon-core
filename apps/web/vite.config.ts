import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { findFreePort } from '../../scripts/dev-port.mjs';

export default defineConfig(async ({ mode }) => {
  const base = mode === 'desktop' ? './' : process.env.VITE_BASE_PATH || '/icon-core/app/';

  const preferred = Number(process.env.PORT) || 5173;
  const port = await findFreePort(preferred, { label: 'web app' });

  if (port !== preferred) {
    console.warn(
      `\n  Port ${preferred} is already serving something on 127.0.0.1 ` +
        `(another project on this machine?).\n` +
        `  The web app will use ${port} instead — open the URL printed below.\n` +
        `  Pin it with PORT=5173 npm run dev:web, or pass --port.\n`
    );
  }

  return {
    base,
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port,
      // Fail loudly if the port is taken between the probe and the bind. The
      // default (false) is what let Vite bind 0.0.0.0 next to someone else's
      // 127.0.0.1 and then print a URL that reached the wrong server.
      strictPort: true
    }
  };
});