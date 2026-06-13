// Alignment snapping for dragging layers on the canvas.
//
// A layer's transform.x/y is an offset from the canvas center. We snap the
// layer's center/left/right (and top/middle/bottom) to meaningful reference
// lines — canvas center, canvas edges, the safe-area inset, and other layers'
// center/edges — and report the lines that snapped so the UI can draw guides.

export interface SnapBox {
  /** transform offset from canvas center */
  x: number;
  y: number;
  /** effective on-canvas size (shape size × scale) */
  width: number;
  height: number;
}

export interface SnapGuide {
  axis: 'x' | 'y';
  /** canvas-space position (0..canvasSize) */
  pos: number;
}

export interface SnapResult {
  x: number;
  y: number;
  guides: SnapGuide[];
}

interface AxisInput {
  value: number;        // current offset (x or y)
  size: number;         // effective size on this axis
  canvasSize: number;
  safeInset: number;    // px inset; 0 when no safe area
  otherCenters: number[]; // other layers' offset on this axis
  otherSizes: number[];   // matching effective sizes
  threshold: number;    // canvas units
}

const snapAxis = ({ value, size, canvasSize, safeInset, otherCenters, otherSizes, threshold }: AxisInput) => {
  const half = canvasSize / 2;

  // Candidate reference lines in canvas space.
  const lines: number[] = [half, 0, canvasSize];
  if (safeInset > 0) lines.push(safeInset, canvasSize - safeInset);
  otherCenters.forEach((c, i) => {
    const center = half + c;
    const s = otherSizes[i] ?? 0;
    lines.push(center, center - s / 2, center + s / 2);
  });

  // The dragged box's reference points, expressed as offsets added to `value`.
  const refOffsets = [half, half - size / 2, half + size / 2]; // center, near edge, far edge

  let best: { value: number; pos: number; dist: number } | null = null;
  for (const line of lines) {
    for (const off of refOffsets) {
      const current = value + off; // where this ref point currently sits
      const dist = Math.abs(current - line);
      if (dist <= threshold && (!best || dist < best.dist)) {
        best = { value: line - off, pos: line, dist };
      }
    }
  }

  return best ? { value: best.value, guide: best.pos } : { value, guide: null };
};

export const computeSnap = (
  box: SnapBox,
  others: SnapBox[],
  canvasSize: number,
  safeInset: number,
  threshold: number
): SnapResult => {
  const x = snapAxis({
    value: box.x,
    size: box.width,
    canvasSize,
    safeInset,
    otherCenters: others.map((o) => o.x),
    otherSizes: others.map((o) => o.width),
    threshold
  });
  const y = snapAxis({
    value: box.y,
    size: box.height,
    canvasSize,
    safeInset,
    otherCenters: others.map((o) => o.y),
    otherSizes: others.map((o) => o.height),
    threshold
  });

  const guides: SnapGuide[] = [];
  if (x.guide !== null) guides.push({ axis: 'x', pos: x.guide });
  if (y.guide !== null) guides.push({ axis: 'y', pos: y.guide });

  return { x: x.value, y: y.value, guides };
};
