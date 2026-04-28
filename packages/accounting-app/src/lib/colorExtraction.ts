/**
 * colorExtraction.ts
 *
 * Extract ALL unique colors from a PDF page canvas.
 * No filtering - gets every color including whites, grays, blacks, everything.
 */

export type ColorSample = {
  r: number;
  g: number;
  b: number;
  hex: string;
  brightness: number;
  count: number; // how many pixels match this color (approximately)
};

/**
 * Extract ALL colors from a canvas - no filtering.
 * Samples every Nth pixel to avoid performance issues with large canvases.
 */
export function extractColorsFromCanvas(
  canvas: HTMLCanvasElement,
  sampleRate = 3, // sample every 3rd pixel
): ColorSample[] {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];

  const { width, height } = canvas;
  let data: Uint8ClampedArray;

  try {
    data = ctx.getImageData(0, 0, width, height).data;
  } catch {
    return [];
  }

  // Map to deduplicate colors and count occurrences
  // Key: "r,g,b" → ColorSample
  const colorMap = new Map<string, ColorSample>();

  for (let y = 0; y < height; y += sampleRate) {
    for (let x = 0; x < width; x += sampleRate) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      // Skip fully transparent pixels only
      if (a < 20) continue;

      const brightness = (r + g + b) / 3;
      const key = `${r},${g},${b}`;

      if (colorMap.has(key)) {
        const existing = colorMap.get(key)!;
        existing.count++;
      } else {
        colorMap.set(key, {
          r,
          g,
          b,
          hex: `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase(),
          brightness,
          count: 1,
        });
      }
    }
  }

  // Convert to array and sort by brightness (darkest to lightest)
  return Array.from(colorMap.values()).sort((a, b) => a.brightness - b.brightness);
}
