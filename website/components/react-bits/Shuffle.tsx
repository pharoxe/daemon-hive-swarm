"use client";

import { useEffect, useState } from "react";

const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%";

type ShuffleProps = {
  text: string;
  className?: string;
  as?: "h1" | "h2" | "h3" | "p";
  durationMs?: number;
};

export function Shuffle({ text, className, as: Tag = "h1", durationMs = 900 }: ShuffleProps) {
  const [output, setOutput] = useState(() => text.replace(/\S/g, " "));

  useEffect(() => {
    const chars = [...text];
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const revealCount = Math.floor(progress * chars.length);

      const next = chars
        .map((char, index) => {
          if (char === " ") return " ";
          if (index < revealCount) return char;
          return CHARSET[Math.floor(Math.random() * CHARSET.length)];
        })
        .join("");

      setOutput(next);
      if (progress < 1) requestAnimationFrame(tick);
      else setOutput(text);
    };

    const id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [durationMs, text]);

  return <Tag className={className}>{output}</Tag>;
}
