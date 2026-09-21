/**
 * Intrinsic sizing for standalone SVG documents.
 *
 * Shared by the importer (`apps/web`) and the SVG exporter so both agree on the
 * size a document renders at. When they disagreed, the PNG export drew an inline
 * SVG inside the layer rectangle while the SVG export embedded it at its own
 * size, so the same project produced two different images.
 */

/** CSS px per SVG length unit. */
const CSS_PX_PER_UNIT: Record<string, number> = {
  px: 1,
  pt: 96 / 72,
  pc: 16,
  mm: 96 / 25.4,
  cm: 96 / 2.54,
  in: 96,
  q: 96 / 101.6
};

const ROOT_TAG = /<svg\b[^>]*>/i;

/**
 * Convert an SVG length (`24`, `24px`, `2.5cm`) to CSS px. Percentages and
 * relative units have no intrinsic size and return `null`.
 *
 * Scanned character by character instead of with a regular expression: an
 * unambiguous-length pattern (`[0-9]*\.?[0-9]+`) is a polynomial-ReDoS finding
 * (`js/polynomial-redos`) because both quantifiers consume digits.
 */
const parseSvgLength = (raw: string | undefined): number | null => {
  if (!raw) return null;
  const text = raw.trim();
  if (text === '' || text.endsWith('%')) return null;

  let end = 0;
  let seenDot = false;
  while (end < text.length) {
    const char = text[end];
    if (char >= '0' && char <= '9') {
      end += 1;
      continue;
    }
    if (char === '.' && !seenDot) {
      seenDot = true;
      end += 1;
      continue;
    }
    break;
  }

  const numberText = text.slice(0, end);
  if (numberText === '' || numberText === '.') return null;
  const value = Number(numberText);
  if (!Number.isFinite(value) || value <= 0) return null;

  const perUnit = CSS_PX_PER_UNIT[text.slice(end).toLowerCase() || 'px'];
  if (perUnit === undefined) return null;
  return value * perUnit;
};

const parseViewBoxSize = (tag: string): { width: number; height: number } | null => {
  const match = /viewBox\s*=\s*["']([^"']*)["']/i.exec(tag);
  if (!match) return null;
  const parts = match[1].trim().split(/[\s,]+/).map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) return null;
  const [, , width, height] = parts;
  if (width <= 0 || height <= 0) return null;
  return { width, height };
};

/**
 * Intrinsic size of an SVG document, in CSS px.
 *
 * Reads the **root `<svg>` tag only** — a nested `<rect width="2">` must not
 * win. Declared `width`/`height` take precedence; when only one is present the
 * `viewBox` ratio derives the other; with neither, the `viewBox` size is used.
 * Returns `null` when the document declares no usable intrinsic size (e.g.
 * `width="100%"`), so callers can fall back to rasterising or embed as-is.
 *
 * Deterministic by design: the importer must not depend on async decoding to
 * size a layer, otherwise the same file can land with different dimensions.
 */
export const parseSvgIntrinsicSize = (svgText: string): { width: number; height: number } | null => {
  const tag = ROOT_TAG.exec(svgText)?.[0];
  if (!tag) return null;

  const viewBox = parseViewBoxSize(tag);
  let width = parseSvgLength(/\bwidth\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1]);
  let height = parseSvgLength(/\bheight\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1]);

  if (viewBox) {
    if (width != null && height == null) height = (width * viewBox.height) / viewBox.width;
    else if (height != null && width == null) width = (height * viewBox.width) / viewBox.height;
    else if (width == null && height == null) {
      width = viewBox.width;
      height = viewBox.height;
    }
  }

  if (width == null || height == null) return null;
  return { width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)) };
};

/**
 * Pin the viewport of an SVG document to `width`×`height` CSS px.
 *
 * A nested `<svg>` is laid out by its own `x`/`y`/`width`/`height`, so rewriting
 * them on the root tag makes the document fill exactly that box (its `viewBox`
 * keeps mapping the inner coordinates). Existing geometry is dropped so the
 * pinned viewport always wins; documents without a root `<svg>` are returned
 * untouched.
 */
export const setSvgViewport = (svgText: string, width: number, height: number): string => {
  const match = ROOT_TAG.exec(svgText);
  if (!match) return svgText;

  const tag = match[0];
  const cleaned = tag
    .replace(/\s(?:width|height|x|y)\s*=\s*["'][^"']*["']/gi, '')
    .replace(/\s*\/>$/, '>');
  const pinned = `${cleaned.slice(0, -1)} x="0" y="0" width="${width}" height="${height}">`;

  return svgText.slice(0, match.index) + pinned + svgText.slice(match.index + tag.length);
};
