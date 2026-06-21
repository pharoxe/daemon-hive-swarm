export type AsciiVariant = "calm" | "spiral";

const GLYPHS: Record<AsciiVariant, string> = {
  calm: "..::--==++**##%%@@",
  spiral: "  .,:;irsXA253hMH#@",
};

export type AsciiPoint = { x: number; y: number; char: string; intensity: number };

export function buildAsciiGrid(
  columns: number,
  rows: number,
  frame: number,
  variant: AsciiVariant,
  mouse?: { x: number; y: number; radius: number },
): AsciiPoint[] {
  const glyphs = GLYPHS[variant];
  const cx = variant === "calm" ? columns / 2 : columns * 0.52;
  const cy = variant === "calm" ? rows / 2 : rows * 0.44;
  const points: AsciiPoint[] = [];

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < columns; x += 1) {
      const dx = x - cx;
      const dy = (y - cy) * (variant === "calm" ? 1.45 : 1.32);
      const radius = Math.sqrt(dx * dx + dy * dy);
      let value: number;

      if (variant === "calm") {
        const wave =
          Math.sin(radius * 0.46 - frame * 0.18) +
          Math.cos(x * 0.38 + y * 0.18 + frame * 0.24) * 0.55;
        const falloff = Math.max(0, 1 - radius / Math.max(columns * 0.52, rows * 0.62));
        value = Math.max(0, Math.min(glyphs.length - 1, Math.floor((wave * 0.5 + falloff) * (glyphs.length - 1))));
      } else {
        const angle = Math.atan2(dy, dx);
        const spiral = Math.sin(radius * 0.34 - angle * 3.2 - frame * 0.16);
        const current = Math.cos((x - frame * 0.42) * 0.14 + y * 0.38) * 0.42;
        const wake = Math.sin((x + y) * 0.12 + frame * 0.22) * 0.3;
        const falloff = Math.max(0, 1 - radius / Math.max(columns * 0.58, rows * 0.68));
        value = Math.max(
          0,
          Math.min(glyphs.length - 1, Math.floor((spiral * 0.34 + current + wake + falloff) * (glyphs.length - 1))),
        );
      }

      if (mouse) {
        const mdx = x * 8 - mouse.x;
        const mdy = y * 14 - mouse.y;
        const dist = Math.sqrt(mdx * mdx + mdy * mdy);
        if (dist < mouse.radius) {
          const boost = (1 - dist / mouse.radius) * 4;
          value = Math.min(glyphs.length - 1, value + Math.floor(boost));
        }
      }

      const char = glyphs[value] ?? " ";
      const intensity = value / Math.max(1, glyphs.length - 1);
      points.push({ x, y, char, intensity });
    }
  }

  return points;
}
