import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const promoDist = path.join(rootDir, 'apps', 'promo', 'dist');
const webDist = path.join(rootDir, 'apps', 'web', 'dist');
const pagesDist = path.join(rootDir, 'dist-pages');

const removeDir = (target) => {
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
  }
};

const copyDir = (source, destination) => {
  if (!fs.existsSync(source)) {
    throw new Error(`Source directory does not exist: ${source}`);
  }
  fs.mkdirSync(destination, { recursive: true });
  fs.cpSync(source, destination, { recursive: true, force: true });
};

const writeApp404 = (destination) => {
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>IconCore Redirect</title>
    <script>
      const root = '/icon-core/app/';
      const search = window.location.search || '';
      const hash = window.location.hash || '';
      window.location.replace(root + search + hash);
    </script>
  </head>
  <body></body>
</html>`;

  fs.writeFileSync(path.join(destination, '404.html'), html, 'utf8');
};

removeDir(pagesDist);
copyDir(promoDist, pagesDist);
copyDir(webDist, path.join(pagesDist, 'app'));
writeApp404(path.join(pagesDist, 'app'));

console.log('GitHub Pages artifact assembled at dist-pages/.');
