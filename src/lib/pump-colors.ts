/**
 * Returns a visually distinct color for a pump at the given index.
 * Uses the golden-ratio method to spread hues evenly regardless of pump count.
 * Both the discharge chart and the NPSH chart import this to guarantee matching colors.
 */
export function getPumpColor(index: number): string {
  const goldenRatio = 0.618033988749895;
  let hue = (index * goldenRatio * 360) % 360;

  // Shift yellow-ish hues (hard to see on white) slightly toward orange
  if (hue >= 45 && hue <= 65) {
    hue = (hue + 30) % 360;
  }

  const saturation = 65 + (index % 3) * 10;
  const lightness = 50 + (index % 2) * 10;

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}
