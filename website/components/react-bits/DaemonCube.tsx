"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import gsap from "gsap";

export type DaemonCubeHandle = {
  tilt: (rotateX: number, rotateY: number) => void;
  reset: () => void;
  pulse: (color: string) => void;
};

export type DaemonCubeProps = {
  size?: number;
  depth?: number;
  borderStyle?: string;
  faceColor?: string;
  accentColor?: string;
  shadow?: boolean | string;
  className?: string;
};

export const DaemonCube = forwardRef<DaemonCubeHandle, DaemonCubeProps>(function DaemonCube(
  {
    size = 36,
    depth,
    borderStyle = "1px solid rgba(194, 106, 58, 0.35)",
    faceColor = "#151311",
    accentColor = "#c26a3a",
    shadow = "0 0 8px rgba(194, 106, 58, 0.15)",
    className,
  },
  ref,
) {
  const cubeRef = useRef<HTMLDivElement>(null);
  const half = (depth ?? size * 0.42) / 2;

  const faceStyle = {
    background: faceColor,
    border: borderStyle,
    boxShadow: typeof shadow === "string" ? shadow : shadow ? "0 0 6px rgba(0,0,0,0.4)" : "none",
  };

  useImperativeHandle(ref, () => ({
    tilt(rotateX, rotateY) {
      if (!cubeRef.current) return;
      gsap.to(cubeRef.current, { duration: 0.28, ease: "power3.out", overwrite: true, rotateX, rotateY });
    },
    reset() {
      if (!cubeRef.current) return;
      gsap.to(cubeRef.current, { duration: 0.5, ease: "power3.out", rotateX: 0, rotateY: 0 });
    },
    pulse(color) {
      if (!cubeRef.current) return;
      cubeRef.current.querySelectorAll<HTMLElement>(".daemon-cube-face").forEach((face) => {
        gsap.to(face, {
          backgroundColor: color,
          duration: 0.2,
          yoyo: true,
          repeat: 1,
        });
      });
    },
  }));

  return (
    <div
      className={className}
      style={{ width: size, height: size, perspective: "600px" }}
      data-accent={accentColor}
    >
      <div
        ref={cubeRef}
        className="relative h-full w-full [transform-style:preserve-3d]"
        style={{ transform: "rotateX(-18deg) rotateY(22deg)" }}
      >
        <div className="daemon-cube-face absolute inset-0" style={{ ...faceStyle, transform: `rotateX(90deg) translateZ(${half}px)` }} />
        <div className="daemon-cube-face absolute inset-0" style={{ ...faceStyle, transform: `rotateX(-90deg) translateZ(${half}px)` }} />
        <div className="daemon-cube-face absolute inset-0" style={{ ...faceStyle, transform: `rotateY(90deg) translateZ(${half}px)` }} />
        <div className="daemon-cube-face absolute inset-0" style={{ ...faceStyle, transform: `rotateY(-90deg) translateZ(${half}px)` }} />
        <div className="daemon-cube-face absolute inset-0" style={{ ...faceStyle, transform: `translateZ(${half}px)` }} />
        <div className="daemon-cube-face absolute inset-0" style={{ ...faceStyle, transform: `rotateY(180deg) translateZ(${half}px)` }} />
      </div>
    </div>
  );
});
