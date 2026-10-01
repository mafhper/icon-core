import { createServer } from 'node:net';

/**
 * Find a port the user can actually reach.
 *
 * Probing for "can I bind this?" is not enough, and the reason is specific to
 * this bug. Vite's `server.host` is `0.0.0.0`, and on Windows binding `0.0.0.0:P`
 * *succeeds* even when `127.0.0.1:P` is already taken by another process. Vite
 * then reports `http://localhost:P` as ready — but `localhost` resolves to
 * `127.0.0.1`, so the browser is served by the *other* project and the dev app
 * 404s. The two servers coexist and neither reports an error.
 *
 * So the probe asks the question the user cares about: can a client reach this
 * port on the loopback address? Anything already listening there means the port
 * is taken, whatever `0.0.0.0` would say.
 */
const isReachablePortFree = (port, host) =>
  new Promise((resolve) => {
    const probe = createServer();
    const done = (free) => {
      probe.removeAllListeners();
      probe.close(() => resolve(free));
    };
    probe.once('error', () => resolve(false));
    probe.once('listening', () => done(true));
    try {
      probe.listen(port, host);
    } catch {
      resolve(false);
    }
  });

/**
 * First free port at or after `preferred`, probing the loopback address.
 *
 * @param {number} preferred
 * @param {{ host?: string, attempts?: number, label?: string }} [options]
 * @returns {Promise<number>}
 */
export const findFreePort = async (preferred, options = {}) => {
  const { host = '127.0.0.1', attempts = 20, label = 'dev server' } = options;

  for (let port = preferred; port < preferred + attempts; port += 1) {
    if (await isReachablePortFree(port, host)) return port;
  }
  throw new Error(
    `No free port for the ${label} in ${preferred}..${preferred + attempts - 1} (on ${host}).`
  );
};