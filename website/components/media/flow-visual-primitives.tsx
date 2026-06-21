"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type FlowGlow = "accent" | "rust" | "success" | "muted";

const glowStyles: Record<FlowGlow, string> = {
  accent: "shadow-[0_0_28px_rgba(194,106,58,0.2)] border-accent/40",
  rust: "shadow-[0_0_28px_rgba(143,63,36,0.35)] border-[#8f3f24]/60",
  success: "shadow-[0_0_28px_rgba(142,240,184,0.18)] border-success/50",
  muted: "shadow-[0_0_20px_rgba(0,0,0,0.2)] border-line",
};

type FlowShellProps = {
  children: React.ReactNode;
  className?: string;
  gradient?: "accent" | "rust" | "success";
};

export function FlowShell({ children, className, gradient = "accent" }: FlowShellProps) {
  const gradientClass =
    gradient === "rust"
      ? "from-[#8f3f24]/[0.07] via-transparent to-accent/[0.04]"
      : gradient === "success"
        ? "from-accent/[0.06] via-transparent to-success/[0.05]"
        : "from-accent/[0.06] via-transparent to-accent/[0.03]";

  return (
    <div
      className={cn(
        "relative mx-auto w-full max-w-md overflow-hidden rounded-sm border border-line bg-card/90 p-5 backdrop-blur-sm md:p-6",
        className,
      )}
    >
      <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-b", gradientClass)} aria-hidden />
      <div className="relative flex flex-col items-center">{children}</div>
    </div>
  );
}

type StepCardProps = {
  icon: LucideIcon;
  label: string;
  sub: string;
  className?: string;
  glow?: FlowGlow;
  iconClassName?: string;
  pulse?: boolean;
  reduced?: boolean;
};

export function StepCard({
  icon: Icon,
  label,
  sub,
  className,
  glow = "accent",
  iconClassName = "text-accent",
  pulse = false,
  reduced = false,
}: StepCardProps) {
  return (
    <motion.div
      className={cn(
        "relative flex flex-col items-center gap-2 rounded-sm border bg-depth/80 px-4 py-3 text-center backdrop-blur-sm",
        glowStyles[glow],
        className,
      )}
      animate={
        pulse && !reduced
          ? { boxShadow: ["0 0 24px rgba(143,63,36,0.2)", "0 0 40px rgba(194,106,58,0.35)", "0 0 24px rgba(143,63,36,0.2)"] }
          : undefined
      }
      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
    >
      {pulse && !reduced ? (
        <motion.span
          className="pointer-events-none absolute inset-0 rounded-sm border border-accent/20"
          animate={{ opacity: [0.2, 0.55, 0.2] }}
          transition={{ duration: 2.5, repeat: Infinity }}
          aria-hidden
        />
      ) : null}
      <Icon className={cn("size-5", iconClassName)} strokeWidth={1.5} />
      <p className="font-[family-name:var(--font-proto)] text-[11px] uppercase tracking-wide text-head text-glow">{label}</p>
      <p className="text-[11px] text-mute text-legible">{sub}</p>
    </motion.div>
  );
}

type FlowLineProps = {
  reduced: boolean;
  delay?: number;
  direction?: "down" | "up";
  label?: string;
  color?: "accent" | "rust";
};

export function FlowLine({ reduced, delay = 0, direction = "down", label, color = "accent" }: FlowLineProps) {
  const dotColor = color === "rust" ? "#8f3f24" : "#c26a3a";
  const lineClass =
    direction === "down"
      ? "bg-gradient-to-b from-accent/60 to-accent/10"
      : "bg-gradient-to-t from-[#8f3f24]/60 to-accent/10";

  return (
    <div className="flex flex-col items-center gap-1">
      {label ? <p className="text-[10px] uppercase tracking-widest text-accent/80">{label}</p> : null}
      <div className={cn("relative flex h-8 w-px items-center justify-center", lineClass)}>
        {!reduced ? (
          <motion.span
            className="absolute size-1.5 rounded-full shadow-[0_0_8px_rgba(194,106,58,0.8)]"
            style={{ backgroundColor: dotColor }}
            animate={{ y: direction === "down" ? [-12, 12] : [12, -12], opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.8, repeat: Infinity, delay, ease: "easeInOut" }}
          />
        ) : null}
      </div>
    </div>
  );
}

type MergeLinesProps = {
  reduced: boolean;
  id: string;
};

export function MergeLines({ reduced, id }: MergeLinesProps) {
  return (
    <svg viewBox="0 0 280 48" className="h-12 w-full max-w-[280px]" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(194,106,58,0.7)" />
          <stop offset="100%" stopColor="rgba(143,63,36,0.4)" />
        </linearGradient>
      </defs>
      <path d="M 70 0 L 70 24 L 140 24 L 140 48" fill="none" stroke={`url(#${id})`} strokeWidth="1.5" />
      <path d="M 210 0 L 210 24 L 140 24" fill="none" stroke={`url(#${id})`} strokeWidth="1.5" />
      {!reduced ? (
        <>
          <motion.circle
            r="3"
            fill="#c26a3a"
            animate={{ cx: [70, 70, 140, 140], cy: [0, 24, 24, 48] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
          />
          <motion.circle
            r="3"
            fill="#8f3f24"
            animate={{ cx: [210, 210, 140], cy: [0, 24, 24] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "linear", delay: 0.6 }}
          />
        </>
      ) : null}
    </svg>
  );
}

type RoundTripLineProps = {
  reduced: boolean;
  outboundLabel: string;
  returnLabel: string;
  delay?: number;
};

/** Outbound and return on the same vertical spine between two nodes. */
export function RoundTripLine({ reduced, outboundLabel, returnLabel, delay = 0 }: RoundTripLineProps) {
  return (
    <div className="relative flex h-14 w-full max-w-[240px] flex-col items-center justify-center">
      <div
        className="absolute left-1/2 h-full w-px -translate-x-1/2 bg-gradient-to-b from-accent/55 via-[#8f3f24]/35 to-success/45"
        aria-hidden
      />
      {!reduced ? (
        <>
          <motion.span
            className="absolute left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-accent shadow-[0_0_8px_rgba(194,106,58,0.8)]"
            animate={{ y: [-18, 18], opacity: [0.35, 1, 0.35] }}
            transition={{ duration: 2, repeat: Infinity, delay, ease: "linear" }}
          />
          <motion.span
            className="absolute left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-success shadow-[0_0_8px_rgba(142,240,184,0.6)]"
            animate={{ y: [18, -18], opacity: [0.35, 1, 0.35] }}
            transition={{ duration: 2, repeat: Infinity, delay: delay + 1, ease: "linear" }}
          />
        </>
      ) : null}
      <div className="relative z-10 flex w-full justify-between px-1 text-[10px] uppercase tracking-widest">
        <span className="text-accent/85">{outboundLabel}</span>
        <span className="text-success/85">{returnLabel}</span>
      </div>
    </div>
  );
}

type LoopReturnProps = {
  reduced: boolean;
};

/** @deprecated Use RoundTripLine for same-route return flows. */
export function LoopReturnArc({ reduced }: LoopReturnProps) {
  return (
    <svg viewBox="0 0 280 72" className="h-[72px] w-full max-w-[280px]" aria-hidden>
      <defs>
        <linearGradient id="swarm-return" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(143,63,36,0.75)" />
          <stop offset="100%" stopColor="rgba(194,106,58,0.45)" />
        </linearGradient>
      </defs>
      <path
        d="M 200 8 L 200 36 Q 200 58 140 58 L 140 72"
        fill="none"
        stroke="url(#swarm-return)"
        strokeWidth="1.5"
      />
      {!reduced ? (
        <motion.circle
          r="3"
          fill="#8f3f24"
          animate={{ cx: [200, 200, 170, 140, 140], cy: [8, 36, 52, 58, 72] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "linear", delay: 0.4 }}
        />
      ) : null}
    </svg>
  );
}
