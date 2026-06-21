"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

type TrueFocusProps = {
  sentence: string;
  separator?: string;
  className?: string;
  wordClassName?: string;
  blurAmount?: number;
  borderColor?: string;
  glowColor?: string;
  animationDuration?: number;
  pauseBetweenAnimations?: number;
};

export function TrueFocus({
  sentence,
  separator = " ",
  className,
  wordClassName,
  blurAmount = 4,
  borderColor = "#c26a3a",
  glowColor = "rgba(194, 106, 58, 0.55)",
  animationDuration = 0.45,
  pauseBetweenAnimations = 0.85,
}: TrueFocusProps) {
  const words = sentence.split(separator).filter(Boolean);
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [focusRect, setFocusRect] = useState({ x: 0, y: 0, width: 0, height: 0 });

  useEffect(() => {
    const interval = window.setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % words.length);
    }, (animationDuration + pauseBetweenAnimations) * 1000);
    return () => window.clearInterval(interval);
  }, [animationDuration, pauseBetweenAnimations, words.length]);

  useEffect(() => {
    const active = wordRefs.current[currentIndex];
    const container = containerRef.current;
    if (!active || !container) return;
    const parentRect = container.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    setFocusRect({
      x: activeRect.left - parentRect.left,
      y: activeRect.top - parentRect.top,
      width: activeRect.width,
      height: activeRect.height,
    });
  }, [currentIndex, words.length]);

  return (
    <div ref={containerRef} className={`relative flex flex-wrap gap-x-2 gap-y-1 ${className ?? ""}`}>
      {words.map((word, index) => {
        const isActive = index === currentIndex;
        return (
          <span
            key={`${word}-${index}`}
            ref={(el) => {
              wordRefs.current[index] = el;
            }}
            className={wordClassName}
            style={{
              filter: isActive ? "blur(0px)" : `blur(${blurAmount}px)`,
              transition: `filter ${animationDuration}s ease`,
            }}
          >
            {word}
          </span>
        );
      })}
      <motion.div
        className="pointer-events-none absolute left-0 top-0 box-border"
        animate={{
          x: focusRect.x,
          y: focusRect.y,
          width: focusRect.width,
          height: focusRect.height,
          opacity: currentIndex >= 0 ? 1 : 0,
        }}
        transition={{ duration: animationDuration }}
      >
        <span
          className="absolute -left-2 -top-2 size-3 rounded-sm border-[2px] border-r-0 border-b-0"
          style={{ borderColor, filter: `drop-shadow(0 0 4px ${glowColor})` }}
        />
        <span
          className="absolute -right-2 -top-2 size-3 rounded-sm border-[2px] border-b-0 border-l-0"
          style={{ borderColor, filter: `drop-shadow(0 0 4px ${glowColor})` }}
        />
        <span
          className="absolute -bottom-2 -left-2 size-3 rounded-sm border-[2px] border-r-0 border-t-0"
          style={{ borderColor, filter: `drop-shadow(0 0 4px ${glowColor})` }}
        />
        <span
          className="absolute -bottom-2 -right-2 size-3 rounded-sm border-[2px] border-l-0 border-t-0"
          style={{ borderColor, filter: `drop-shadow(0 0 4px ${glowColor})` }}
        />
      </motion.div>
    </div>
  );
}
