"use client";

import { useCallback, useEffect, useRef } from "react";
import gsap from "gsap";

export type CubesProps = {
  gridSize?: number;
  cubeSize?: number;
  maxAngle?: number;
  radius?: number;
  cellGap?: number;
  borderStyle?: string;
  faceColor?: string;
  accentColor?: string;
  shadow?: boolean | string;
  autoAnimate?: boolean;
  rippleOnClick?: boolean;
  className?: string;
};

export function Cubes({
  gridSize = 8,
  cubeSize,
  maxAngle = 42,
  radius = 2.5,
  cellGap = 3,
  borderStyle = "1px solid rgba(194, 106, 58, 0.35)",
  faceColor = "#151311",
  accentColor = "#c26a3a",
  shadow = "0 0 8px rgba(194, 106, 58, 0.15)",
  autoAnimate = true,
  rippleOnClick = true,
  className,
}: CubesProps) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const simRAFRef = useRef<number | null>(null);
  const userActiveRef = useRef(false);
  const simPosRef = useRef({ x: 0, y: 0 });
  const simTargetRef = useRef({ x: 0, y: 0 });

  const tiltAt = useCallback(
    (rowCenter: number, colCenter: number) => {
      if (!sceneRef.current) return;
      sceneRef.current.querySelectorAll<HTMLElement>(".daemon-cube").forEach((cube) => {
        const r = Number(cube.dataset.row);
        const c = Number(cube.dataset.col);
        const dist = Math.hypot(r - rowCenter, c - colCenter);
        if (dist <= radius) {
          const pct = 1 - dist / radius;
          const angle = pct * maxAngle;
          gsap.to(cube, { duration: 0.28, ease: "power3.out", overwrite: true, rotateX: -angle, rotateY: angle });
        } else {
          gsap.to(cube, { duration: 0.5, ease: "power3.out", overwrite: true, rotateX: 0, rotateY: 0 });
        }
      });
    },
    [maxAngle, radius],
  );

  const resetAll = useCallback(() => {
    if (!sceneRef.current) return;
    sceneRef.current.querySelectorAll<HTMLElement>(".daemon-cube").forEach((cube) => {
      gsap.to(cube, { duration: 0.5, rotateX: 0, rotateY: 0, ease: "power3.out" });
    });
  }, []);

  useEffect(() => {
    if (!autoAnimate || !sceneRef.current) return;
    simPosRef.current = { x: Math.random() * gridSize, y: Math.random() * gridSize };
    simTargetRef.current = { x: Math.random() * gridSize, y: Math.random() * gridSize };
    const loop = () => {
      if (!userActiveRef.current) {
        const pos = simPosRef.current;
        const tgt = simTargetRef.current;
        pos.x += (tgt.x - pos.x) * 0.02;
        pos.y += (tgt.y - pos.y) * 0.02;
        tiltAt(pos.y, pos.x);
        if (Math.hypot(pos.x - tgt.x, pos.y - tgt.y) < 0.1) {
          simTargetRef.current = { x: Math.random() * gridSize, y: Math.random() * gridSize };
        }
      }
      simRAFRef.current = requestAnimationFrame(loop);
    };
    simRAFRef.current = requestAnimationFrame(loop);
    return () => {
      if (simRAFRef.current) cancelAnimationFrame(simRAFRef.current);
    };
  }, [autoAnimate, gridSize, tiltAt]);

  useEffect(() => {
    const el = sceneRef.current;
    if (!el) return;

    const onPointerMove = (e: PointerEvent) => {
      userActiveRef.current = true;
      const rect = el.getBoundingClientRect();
      const cellW = rect.width / gridSize;
      const cellH = rect.height / gridSize;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        tiltAt((e.clientY - rect.top) / cellH, (e.clientX - rect.left) / cellW);
      });
      window.setTimeout(() => {
        userActiveRef.current = false;
      }, 2000);
    };

    const onClick = (e: MouseEvent) => {
      if (!rippleOnClick) return;
      const rect = el.getBoundingClientRect();
      const cellW = rect.width / gridSize;
      const cellH = rect.height / gridSize;
      const colHit = Math.floor((e.clientX - rect.left) / cellW);
      const rowHit = Math.floor((e.clientY - rect.top) / cellH);
      el.querySelectorAll<HTMLElement>(".daemon-cube-face").forEach((face) => {
        const cube = face.parentElement;
        if (!cube) return;
        const r = Number(cube.dataset.row);
        const c = Number(cube.dataset.col);
        const dist = Math.hypot(r - rowHit, c - colHit);
        gsap.to(face, {
          backgroundColor: accentColor,
          duration: 0.2,
          delay: dist * 0.05,
          yoyo: true,
          repeat: 1,
        });
      });
    };

    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerleave", resetAll);
    el.addEventListener("click", onClick);
    return () => {
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerleave", resetAll);
      el.removeEventListener("click", onClick);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [accentColor, gridSize, resetAll, rippleOnClick, tiltAt]);

  const sceneStyle: React.CSSProperties = {
    display: "grid",
    width: "100%",
    height: "100%",
    gridTemplateColumns: cubeSize ? `repeat(${gridSize}, ${cubeSize}px)` : `repeat(${gridSize}, 1fr)`,
    gridTemplateRows: cubeSize ? `repeat(${gridSize}, ${cubeSize}px)` : `repeat(${gridSize}, 1fr)`,
    columnGap: `${cellGap}px`,
    rowGap: `${cellGap}px`,
    perspective: "1200px",
  };

  const faceStyle = {
    background: faceColor,
    border: borderStyle,
    boxShadow: typeof shadow === "string" ? shadow : shadow ? "0 0 6px rgba(0,0,0,0.4)" : "none",
  };

  const cells = Array.from({ length: gridSize });

  return (
    <div className={className} style={cubeSize ? { width: gridSize * cubeSize, height: gridSize * cubeSize } : undefined}>
      <div ref={sceneRef} style={sceneStyle}>
        {cells.map((_, r) =>
          cells.map((__, c) => (
            <div
              key={`${r}-${c}`}
              className="daemon-cube relative aspect-square w-full [transform-style:preserve-3d]"
              data-row={r}
              data-col={c}
            >
              <div className="daemon-cube-face absolute inset-0" style={{ ...faceStyle, transform: "translateY(-50%) rotateX(90deg)" }} />
              <div className="daemon-cube-face absolute inset-0" style={{ ...faceStyle, transform: "translateY(50%) rotateX(-90deg)" }} />
              <div className="daemon-cube-face absolute inset-0" style={{ ...faceStyle, transform: "translateX(-50%) rotateY(-90deg)" }} />
              <div className="daemon-cube-face absolute inset-0" style={{ ...faceStyle, transform: "translateX(50%) rotateY(90deg)" }} />
              <div className="daemon-cube-face absolute inset-0" style={{ ...faceStyle, transform: "rotateY(-90deg) translateX(50%) rotateY(90deg)" }} />
              <div className="daemon-cube-face absolute inset-0" style={{ ...faceStyle, transform: "rotateY(90deg) translateX(-50%) rotateY(-90deg)" }} />
            </div>
          )),
        )}
      </div>
    </div>
  );
}
