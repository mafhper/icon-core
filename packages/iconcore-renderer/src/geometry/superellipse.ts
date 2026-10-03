/**
 * The superellipse ("squircle") outline, defined once.
 *
 * There were **four** copies of this curve in the product, and they disagreed:
 *
 * 1. `composeLayers.ts` drew the shape with `min(w, h) * 0.22` on both axes and
 *    control points at the midpoints.
 * 2. `backends/canvas.ts` drew the mask with `width * (1 - 0.6) / 2` used for
 *    **both** axes, so it stretched on a non-square mask.
 * 3. `renderToSvg.ts` wrote the SVG mask as a square-only path.
 * 4. `renderToSvg.ts` wrote the SVG *shape* as `<rect rx="width * 0.25">` — not a
 *    superellipse at all, just a rounded rectangle.
 *
 * Four definitions of "squircle" is exactly how the canvas and the SVG export
 * drifted apart: measured against the browser backend, a squircle exported to
 * SVG put 10,2% of pixels outside tolerance and was visible side by side as a
 * rounded rect where the editor showed the real curve. Fixing the SVG against a
 * canvas that itself had two variants would have moved the goalposts, so the
 * curve lives here and every consumer asks for it.
 *
 * `n = 0.6` is the value the mask already used, and it is what the SVG path in
 * this file has always emitted — so this preserves the mask exactly as it
 * rendered, and makes the shape match the mask it is supposed to resemble.
 */
export const SUPERELLIPSE_N = 0.6;

/**
 * Control-point offsets for a `width × height` box, as fractions of each axis.
 *
 * Per axis on purpose: one shared offset is what made the mask stretch, and it
 * is why a non-square squircle is worth a fixture of its own.
 */
export const superellipseOffsets = (
  width: number,
  height: number
): { ox: number; oy: number } => ({
  ox: (width * (1 - SUPERELLIPSE_N)) / 2,
  oy: (height * (1 - SUPERELLIPSE_N)) / 2
});

/**
 * Trace the outline onto a 2D context.
 *
 * `x`/`y` place the box's top-left corner, because callers draw into a shared
 * context at different origins (a layer at its transform, a mask at the canvas
 * inset) and translating the context instead would leave the caller's transform
 * changed. Mirrors {@link superellipsePathD} segment for segment — the two must
 * describe the same curve, which is what the parity fixtures check.
 */
export const traceSuperellipse = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number
): void => {
  const { ox, oy } = superellipseOffsets(width, height);

  ctx.moveTo(x + ox, y);
  ctx.bezierCurveTo(x + width - ox, y, x + width, y + oy, x + width, y + height - oy);
  ctx.bezierCurveTo(x + width, y + height - oy, x + width - ox, y + height, x + ox, y + height);
  ctx.bezierCurveTo(x + ox, y + height, x, y + height - oy, x, y + oy);
  ctx.bezierCurveTo(x, y + oy, x + ox, y, x + ox, y);
};

/** The same outline as an SVG path `d`, for the vector pipeline. */
export const superellipsePathD = (width: number, height: number): string => {
  const { ox, oy } = superellipseOffsets(width, height);

  return (
    `M${ox} 0 ` +
    `C${width - ox} 0 ${width} ${oy} ${width} ${height - oy} ` +
    `C${width} ${height - oy} ${width - ox} ${height} ${ox} ${height} ` +
    `C${ox} ${height} 0 ${height - oy} 0 ${oy} ` +
    `C0 ${oy} ${ox} 0 ${ox} 0Z`
  );
};
