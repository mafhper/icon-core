/**
 * Smooth rounded-rectangle outline — the second corner level
 * (`cornerSmoothing`, 0–1) the reference exposes next to the radius.
 *
 * Ported from the algorithm OpenPencil carries (`smoothCornerPathParams` in its
 * canvas shapes), which is itself the well-known figma-squircle construction:
 *
 *   p = (1 + s) · radius      where the curve leaves the straight edge
 *   arcMeasure = 90° · (1 − s)
 *   c / d                     the β-transition offsets of the two edge cubics
 *   b = (p − arcSectionLength − c − d) / 3, a = 2b
 *
 * The connecting arc is emitted as two cubic segments (radial error below
 * 0.03% of the radius) instead of an `A` command, so the canvas tracer and the
 * SVG `d` are built from the SAME segment list — the two pipelines agree by
 * construction, which is the rule this repository already paid for once.
 */
export interface Point {
  x: number;
  y: number;
}

export type SmoothRectSegment =
  | { kind: 'line'; to: Point }
  | { kind: 'cubic'; c1: Point; c2: Point; to: Point };

const DEG = Math.PI / 180;

const round3 = (value: number): number => Number(value.toFixed(3));

/** Effective corner parameters after clamping `p` to the available half-side. */
export const smoothCornerParams = (
  radius: number,
  smoothing: number,
  maxP: number
): { radius: number; smoothing: number; p: number; a: number; b: number; c: number; d: number } => {
  const r = Math.max(0, radius);
  let s = Math.max(0, Math.min(1, smoothing));
  if (r > 0 && (1 + s) * r > maxP) {
    s = Math.max(0, Math.min(1, maxP / r - 1));
  }
  const p = (1 + s) * r;
  const arcMeasure = 90 * (1 - s);
  const arcSectionLength = Math.sin((arcMeasure / 2) * DEG) * r * Math.SQRT2;
  const angleAlpha = (90 - arcMeasure) / 2;
  const p3ToP4Distance = r * Math.tan((angleAlpha / 2) * DEG);
  const angleBeta = 45 * s;
  const c = p3ToP4Distance * Math.cos(angleBeta * DEG);
  const d = c * Math.tan(angleBeta * DEG);
  const b = (p - arcSectionLength - c - d) / 3;
  return { radius: r, smoothing: s, p, a: 2 * b, b, c, d };
};

/**
 * A circular arc between two points, as two cubic segments. The centre is the
 * candidate farther from the corner tip (the arc bulges toward it), which is
 * what makes the same routine serve all four corners.
 */
const arcCubics = (from: Point, to: Point, r: number, bulge: Point): SmoothRectSegment[] => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  if (dist === 0 || r === 0) return [{ kind: 'line', to }];

  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const h = Math.sqrt(Math.max(0, r * r - (dist / 2) ** 2));
  const nx = -dy / dist;
  const ny = dx / dist;
  const c1 = { x: mx + nx * h, y: my + ny * h };
  const c2 = { x: mx - nx * h, y: my - ny * h };
  const center =
    Math.hypot(c1.x - bulge.x, c1.y - bulge.y) >= Math.hypot(c2.x - bulge.x, c2.y - bulge.y) ? c1 : c2;

  const a0 = Math.atan2(from.y - center.y, from.x - center.x);
  const a1 = Math.atan2(to.y - center.y, to.x - center.x);
  let delta = a1 - a0;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  const am = a0 + delta / 2;

  const cubic = (p0: Point, p1: Point, phi0: number, phi1: number): SmoothRectSegment => {
    const k = (4 / 3) * Math.tan((phi1 - phi0) / 4) * r;
    return {
      kind: 'cubic',
      c1: { x: p0.x - Math.sin(phi0) * k, y: p0.y + Math.cos(phi0) * k },
      c2: { x: p1.x + Math.sin(phi1) * k, y: p1.y - Math.cos(phi1) * k },
      to: p1
    };
  };

  const mid = { x: center.x + Math.cos(am) * r, y: center.y + Math.sin(am) * r };
  return [cubic(from, mid, a0, am), cubic(mid, to, am, a1)];
};

/**
 * The clockwise outline (y down) starting at the top edge's first curve point.
 * `radius` 0 (or a degenerate box) falls back to a plain rectangle.
 */
export const smoothRectOutline = (
  width: number,
  height: number,
  radius: number,
  smoothing: number
): { start: Point; segments: SmoothRectSegment[] } => {
  if (width <= 0 || height <= 0) {
    return { start: { x: 0, y: 0 }, segments: [] };
  }
  const maxP = Math.min(width, height) / 2;
  const { p, a, b, c, d, radius: r } = smoothCornerParams(radius, smoothing, maxP);

  if (r === 0 || p === 0) {
    return {
      start: { x: 0, y: 0 },
      segments: [
        { kind: 'line', to: { x: width, y: 0 } },
        { kind: 'line', to: { x: width, y: height } },
        { kind: 'line', to: { x: 0, y: height } },
        { kind: 'line', to: { x: 0, y: 0 } }
      ]
    };
  }

  const segments: SmoothRectSegment[] = [];
  const line = (x: number, y: number) => segments.push({ kind: 'line', to: { x, y } });
  const cubic = (c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number) =>
    segments.push({ kind: 'cubic', c1: { x: c1x, y: c1y }, c2: { x: c2x, y: c2y }, to: { x, y } });
  const arc = (from: Point, to: Point, bulge: Point) => segments.push(...arcCubics(from, to, r, bulge));

  // ── Top-right (entry (width − p, 0), tip (width, p)) ──
  cubic(width - p + a, 0, width - p + a + b, 0, width - p + a + b + c, d);
  arc({ x: width - p + a + b + c, y: d }, { x: width - d, y: p - a - b - c }, { x: width, y: p });
  cubic(width, p - a - b, width, p - a, width, p);

  // ── Bottom-right (entry (width, height − p), tip (width − p, height)) ──
  line(width, height - p);
  cubic(width, height - p + a, width, height - p + a + b, width - d, height - p + a + b + c);
  arc(
    { x: width - d, y: height - p + a + b + c },
    { x: width - p + a + b + c, y: height - d },
    { x: width - p, y: height }
  );
  cubic(width - p + a + b, height, width - p + a, height, width - p, height);

  // ── Bottom-left (entry (p, height), tip (0, height − p)) ──
  line(p, height);
  cubic(p - a, height, p - a - b, height, p - a - b - c, height - d);
  arc({ x: p - a - b - c, y: height - d }, { x: d, y: height - p + a + b + c }, { x: 0, y: height - p });
  cubic(0, height - p + a + b, 0, height - p + a, 0, height - p);

  // ── Top-left (entry (0, p), tip (p, 0)) ──
  line(0, p);
  cubic(0, p - a, 0, p - a - b, d, p - a - b - c);
  arc({ x: d, y: p - a - b - c }, { x: p - a - b - c, y: d }, { x: p, y: 0 });
  cubic(p - a - b, 0, p - a, 0, p, 0);

  return { start: { x: p, y: 0 }, segments };
};

/** Trace the outline onto a 2D context at `(x, y)` (top-left of the box). */
export const traceSmoothRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  smoothing: number
): void => {
  const { start, segments } = smoothRectOutline(width, height, radius, smoothing);
  ctx.moveTo(x + start.x, y + start.y);
  for (const segment of segments) {
    if (segment.kind === 'line') ctx.lineTo(x + segment.to.x, y + segment.to.y);
    else {
      ctx.bezierCurveTo(
        x + segment.c1.x,
        y + segment.c1.y,
        x + segment.c2.x,
        y + segment.c2.y,
        x + segment.to.x,
        y + segment.to.y
      );
    }
  }
};

/** The same outline as an SVG path `d`. */
export const smoothRectPathD = (width: number, height: number, radius: number, smoothing: number): string => {
  const { start, segments } = smoothRectOutline(width, height, radius, smoothing);
  let out = `M${round3(start.x)} ${round3(start.y)}`;
  for (const segment of segments) {
    if (segment.kind === 'line') out += ` L${round3(segment.to.x)} ${round3(segment.to.y)}`;
    else {
      out +=
        ` C${round3(segment.c1.x)} ${round3(segment.c1.y)}` +
        ` ${round3(segment.c2.x)} ${round3(segment.c2.y)}` +
        ` ${round3(segment.to.x)} ${round3(segment.to.y)}`;
    }
  }
  return `${out}Z`;
};
