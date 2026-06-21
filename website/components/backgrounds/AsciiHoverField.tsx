"use client";

import { useEffect, useRef, useState } from "react";
import { buildAsciiGrid, type AsciiVariant } from "@/lib/ascii-field";
import { useTheme } from "@/components/layout/ThemeProvider";

const DARK_GLYPH_COLORS = [
  "rgba(157,146,135,0.06)",
  "rgba(143,63,36,0.18)",
  "rgba(143,63,36,0.35)",
  "rgba(194,106,58,0.55)",
  "rgba(194,106,58,0.78)",
  "rgba(231,224,212,0.92)",
];

const LIGHT_GLYPH_COLORS = [
  "rgba(107,97,88,0.08)",
  "rgba(143,63,36,0.16)",
  "rgba(143,63,36,0.28)",
  "rgba(194,106,58,0.42)",
  "rgba(194,106,58,0.58)",
  "rgba(33,29,26,0.72)",
];

type AsciiHoverFieldProps = {
  variant?: AsciiVariant;
  className?: string;
  opacity?: number;
};

export function AsciiHoverField({ variant = "calm", className, opacity = 0.55 }: AsciiHoverFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const mouseRef = useRef<{ x: number; y: number } | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const { theme } = useTheme();
  const glyphColors = theme === "dark" ? DARK_GLYPH_COLORS : LIGHT_GLYPH_COLORS;

  useEffect(() => {
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cellW = 8;
    const cellH = 14;
    let raf = 0;
    let running = true;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = () => {
      if (!running) return;
      const width = window.innerWidth;
      const height = window.innerHeight;
      const columns = Math.ceil(width / cellW);
      const rows = Math.ceil(height / cellH);

      ctx.clearRect(0, 0, width, height);
      ctx.font = "11px var(--font-proto), monospace";
      ctx.textBaseline = "top";

      const mouse = mouseRef.current
        ? { x: mouseRef.current.x, y: mouseRef.current.y, radius: 120 }
        : undefined;

      const grid = buildAsciiGrid(columns, rows, frameRef.current, variant, mouse);

      for (const point of grid) {
        if (point.char === " ") continue;
        const colorIndex = Math.min(
          glyphColors.length - 1,
          Math.floor(point.intensity * (glyphColors.length - 1)),
        );
        ctx.fillStyle = glyphColors[colorIndex];
        ctx.fillText(point.char, point.x * cellW, point.y * cellH);
      }

      if (!reducedMotion) {
        frameRef.current += 1;
      }
      raf = window.requestAnimationFrame(draw);
    };

    const onMove = (event: MouseEvent) => {
      mouseRef.current = { x: event.clientX, y: event.clientY };
    };

    const onLeave = () => {
      mouseRef.current = null;
    };

    resize();
    draw();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeave);

    return () => {
      running = false;
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
    };
  }, [glyphColors, reducedMotion, theme, variant]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={className}
      style={{ opacity }}
    />
  );
}
