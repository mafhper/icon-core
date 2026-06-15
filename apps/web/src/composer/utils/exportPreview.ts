import type { IconCoreProject } from '@iconcore/shared';

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (ch) =>
    ch === '&' ? '&amp;' : ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : ch === '"' ? '&quot;' : '&#39;'
  );

/**
 * A standalone HTML contact sheet for visually testing an exported icon pack.
 * References the rendered image files by relative path, so it works once the
 * archive is extracted (or written straight to a folder on desktop). Shows each
 * icon over light and dark backgrounds to spot transparency / contrast issues.
 */
export const generatePreviewHtml = (project: IconCoreProject, imagePaths: string[]): string => {
  const cards = imagePaths
    .map((path) => {
      const safe = escapeHtml(path);
      return `      <figure class="card">
        <div class="swatches">
          <span class="swatch light"><img src="${safe}" alt="${safe}" loading="lazy"></span>
          <span class="swatch dark"><img src="${safe}" alt="" loading="lazy"></span>
        </div>
        <figcaption>${safe}</figcaption>
      </figure>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(project.metadata.name)} — Icon Pack Preview</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, system-ui, "Segoe UI", Roboto, sans-serif; background: #0f1115; color: #f4f6fb; padding: 32px; }
  header { margin-bottom: 24px; }
  h1 { margin: 0 0 4px; font-size: 1.4rem; }
  p { margin: 0; color: #9aa3b2; font-size: 0.9rem; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 16px; }
  .card { margin: 0; border: 1px solid #23262d; border-radius: 14px; overflow: hidden; background: #15181e; }
  .swatches { display: grid; grid-template-columns: 1fr 1fr; }
  .swatch { display: grid; place-items: center; aspect-ratio: 1; padding: 14px; }
  .swatch.light { background: #f8fafc; }
  .swatch.dark { background: #11141a; }
  .swatch img { max-width: 100%; max-height: 100%; image-rendering: auto; }
  figcaption { padding: 8px 10px; font-size: 0.72rem; color: #9aa3b2; word-break: break-all; border-top: 1px solid #23262d; }
</style>
</head>
<body>
  <header>
    <h1>${escapeHtml(project.metadata.name)}</h1>
    <p>Icon pack preview — ${imagePaths.length} rendered file(s). Each icon is shown over light and dark backgrounds.</p>
  </header>
  <div class="grid">
${cards}
  </div>
</body>
</html>`;
};
