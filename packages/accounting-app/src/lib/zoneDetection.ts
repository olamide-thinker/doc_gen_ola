/**
 * zoneDetection.ts
 *
 * Strategy:
 *  1. Sample the colour at the click point.
 *  2. Global colour scan — find EVERY pixel on the page with that colour.
 *     Walls / dimension lines that cross the zone are a different colour and
 *     are ignored, so the whole zone is captured regardless of interruptions.
 *  3. Exact corner extraction — scan every row, record the leftmost and
 *     rightmost matching pixel, inject right-angle corner points whenever the
 *     boundary steps, then strip collinear runs.  No D-P approximation.
 *  4. Convert canvas pixels → 0-100 percentage coords (Zone format).
 */

export type Point = { x: number; y: number };

// ─── 1. Global colour scan ────────────────────────────────────────────────────

function globalColorMask(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  tr: number,
  tg: number,
  tb: number,
  tolerance: number,
): Uint8Array {
  const mask = new Uint8Array(width * height);
  // Use Euclidean color distance (more perceptually accurate than axis-aligned)
  // This prevents matching colors that are far apart overall, even if close on one channel
  const toleranceSq = tolerance * tolerance;

  for (let i = 0; i < width * height; i++) {
    const pi = i * 4;
    if (data[pi + 3] > 20) {
      const dr = data[pi]     - tr;
      const dg = data[pi + 1] - tg;
      const db = data[pi + 2] - tb;
      const distSq = dr * dr + dg * dg + db * db;

      if (distSq <= toleranceSq) {
        mask[i] = 1;
      }
    }
  }
  return mask;
}

// ─── 2. Exact contour extraction ─────────────────────────────────────────────
//
// For every row: record the leftmost (lx) and rightmost (rx) matching pixel.
//
// When lx or rx changes by ≥ STEP_THRESH pixels from one row to the next,
// a right-angle corner exists.  We inject the corner point explicitly so the
// polygon edge stays perfectly axis-aligned instead of cutting diagonally.
//
// After that, strip collinear points (consecutive same-x runs become just
// two endpoints) to get the minimal exact polygon.

const STEP_THRESH = 2; // px — anything smaller is anti-alias noise

function extractExactContour(mask: Uint8Array, width: number, height: number): Point[] {
  const left: Point[]  = [];
  const right: Point[] = [];

  for (let y = 0; y < height; y++) {
    let lx = -1, rx = -1;
    const row = y * width;
    for (let x = 0; x < width; x++) {
      if (mask[row + x]) {
        if (lx === -1) lx = x;
        rx = x;
      }
    }
    if (lx === -1) continue;

    // Left boundary ── inject corner when x steps
    if (left.length > 0 && Math.abs(lx - left[left.length - 1].x) >= STEP_THRESH) {
      left.push({ x: left[left.length - 1].x, y }); // end of old vertical run
    }
    left.push({ x: lx, y });

    // Right boundary ── inject corner when x steps
    if (right.length > 0 && Math.abs(rx - right[right.length - 1].x) >= STEP_THRESH) {
      right.push({ x: right[right.length - 1].x, y }); // end of old vertical run
    }
    right.push({ x: rx, y });
  }

  if (left.length === 0) return [];

  // Remove collinear points: keep a point only if its x differs from either
  // its predecessor (in the result so far) or its immediate successor.
  const pruneCollinear = (pts: Point[]): Point[] => {
    if (pts.length <= 2) return pts;
    const out: Point[] = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++) {
      const prev = out[out.length - 1];
      const curr = pts[i];
      const next = pts[i + 1];
      // Collinear = all three on the same vertical line
      if (curr.x === prev.x && curr.x === next.x) continue;
      out.push(curr);
    }
    out.push(pts[pts.length - 1]);
    return out;
  };

  const simplLeft  = pruneCollinear(left);
  const simplRight = pruneCollinear(right);

  // Left boundary top→bottom + right boundary bottom→top = closed polygon
  return [...simplLeft, ...simplRight.reverse()];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getCtx(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  return (
    canvas.getContext('2d', { willReadFrequently: true }) ??
    canvas.getContext('2d')
  ) as CanvasRenderingContext2D | null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Click a point on a PDF page canvas → exact polygon in 0-100 % coords.
 *
 * Uses a global colour scan so walls crossing the zone are ignored.
 * Corner extraction is exact (axis-aligned right-angle corners, no D-P
 * approximation), so the polygon fits the zone edge-for-edge.
 *
 * Returns null if the pixel is white / black / transparent, the matched
 * region is too small, or the canvas is cross-origin tainted.
 */
export function detectZoneAtPoint(
  canvas: HTMLCanvasElement,
  clickPctX: number,
  clickPctY: number,
  tolerance = 22,
): Point[] | null {
  const ctx = getCtx(canvas);
  if (!ctx) {
    console.warn('[zoneDetection] Could not obtain 2D context');
    return null;
  }

  const { width, height } = canvas;
  const px = Math.round((clickPctX / 100) * width);
  const py = Math.round((clickPctY / 100) * height);

  if (px < 0 || px >= width || py < 0 || py >= height) return null;

  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, width, height).data;
  } catch (e) {
    console.warn('[zoneDetection] getImageData failed — canvas may be cross-origin tainted:', e);
    return null;
  }

  // Sample colour at click point
  const si = (py * width + px) * 4;
  const tr = data[si], tg = data[si + 1], tb = data[si + 2], ta = data[si + 3];

  if (ta < 20) {
    console.debug('[zoneDetection] Transparent pixel — skipping');
    return null;
  }

  // Allow any colour (light or dark) as long as it's not grayscale (white/gray/black)
  // Saturation = max RGB difference. Grayscale has near-zero saturation.
  const maxChannel = Math.max(tr, tg, tb);
  const minChannel = Math.min(tr, tg, tb);
  const saturation = maxChannel - minChannel;
  const brightness = (tr + tg + tb) / 3;

  // Very light colors (near white) need stronger color saturation to be valid zones
  // Otherwise we match pale/washed-out backgrounds
  let minSaturation = 15;
  if (brightness > 200) minSaturation = 40; // Very light: need strong color
  else if (brightness > 180) minSaturation = 30; // Light: need moderate color
  else if (brightness > 150) minSaturation = 20; // Medium-light: need some color

  if (saturation < minSaturation) {
    console.debug(`[zoneDetection] Insufficient saturation: ${saturation} (required: ${minSaturation}) at brightness ${brightness.toFixed(0)}`);
    return null;
  }

  // Calculate tolerance based on brightness
  // Using Euclidean distance, so we can use slightly higher values while being stricter overall
  let effectiveTolerance = tolerance;

  if (brightness > 200) {
    effectiveTolerance = 6; // Very light: very tight matching only
  } else if (brightness > 180) {
    effectiveTolerance = 8; // Light: tight matching
  } else if (brightness > 150) {
    effectiveTolerance = 10; // Medium-light: moderate matching
  } else if (brightness > 100) {
    effectiveTolerance = 14; // Medium: normal matching
  } else {
    effectiveTolerance = tolerance; // Dark: use default
  }

  console.debug(`[zoneDetection] Colour RGB(${tr},${tg},${tb}) brightness=${brightness.toFixed(0)} tolerance=${effectiveTolerance} at ${clickPctX.toFixed(1)}%, ${clickPctY.toFixed(1)}%`);

  const mask = globalColorMask(data, width, height, tr, tg, tb, effectiveTolerance);

  let count = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i]) count++;

  if (count < 400) {
    console.debug(`[zoneDetection] Region too small: ${count}px`);
    return null;
  }

  const contour = extractExactContour(mask, width, height);
  if (contour.length < 3) return null;

  console.debug(`[zoneDetection] ✅ ${count}px → ${contour.length} vertices`);

  // Canvas pixels → percentage coordinates
  return contour.map(p => ({
    x: (p.x / width)  * 100,
    y: (p.y / height) * 100,
  }));
}

/**
 * Detect zone by exact RGB color (used by color palette selection).
 * Takes an RGB color and finds the shape on the canvas with that color.
 * Returns null if color not found or region too small.
 */
export function detectZoneByColor(
  canvas: HTMLCanvasElement,
  r: number,
  g: number,
  b: number,
): Point[] | null {
  const ctx = getCtx(canvas);
  if (!ctx) {
    console.warn('[zoneDetection] Could not obtain 2D context');
    return null;
  }

  const { width, height } = canvas;

  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, width, height).data;
  } catch (e) {
    console.warn('[zoneDetection] getImageData failed — canvas may be cross-origin tainted:', e);
    return null;
  }

  // Calculate brightness to determine tolerance
  const brightness = (r + g + b) / 3;
  let effectiveTolerance = 22; // default

  if (brightness > 200) {
    effectiveTolerance = 6; // Very light: very tight matching only
  } else if (brightness > 180) {
    effectiveTolerance = 8; // Light: tight matching
  } else if (brightness > 150) {
    effectiveTolerance = 10; // Medium-light: moderate matching
  } else if (brightness > 100) {
    effectiveTolerance = 14; // Medium: normal matching
  }

  console.debug(`[zoneDetection] Detecting color RGB(${r},${g},${b}) brightness=${brightness.toFixed(0)} tolerance=${effectiveTolerance}`);

  const mask = globalColorMask(data, width, height, r, g, b, effectiveTolerance);

  let count = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i]) count++;

  if (count < 400) {
    console.debug(`[zoneDetection] Region too small: ${count}px`);
    return null;
  }

  const contour = extractExactContour(mask, width, height);
  if (contour.length < 3) return null;

  console.debug(`[zoneDetection] ✅ ${count}px → ${contour.length} vertices`);

  // Canvas pixels → percentage coordinates
  return contour.map(p => ({
    x: (p.x / width)  * 100,
    y: (p.y / height) * 100,
  }));
}
