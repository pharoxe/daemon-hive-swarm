"use client";

import { forwardRef, useImperativeHandle, useRef, type Ref } from "react";
import gsap from "gsap";
import { Database, ScanEye, type LucideIcon } from "lucide-react";
import { DaemonCube, type DaemonCubeHandle } from "@/components/react-bits/DaemonCube";
import { daemonColors } from "@/lib/daemon-theme";
import { cn } from "@/lib/utils";

export type FlowVisualHandle = {
  highlight: (color: string) => void;
  reset: () => void;
};

type FlowVisualProps = {
  size?: number;
  faceColor?: string;
  accentColor?: string;
  className?: string;
};

const border = "1px solid rgba(194, 106, 58, 0.35)";

export const IconVisual = forwardRef<FlowVisualHandle, FlowVisualProps & { icon: LucideIcon }>(function IconVisual(
  { size = 38, faceColor = daemonColors.card, accentColor = daemonColors.accent, icon: Icon, className },
  ref,
) {
  const rootRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    highlight(color) {
      if (!rootRef.current) return;
      gsap.to(rootRef.current, { scale: 1.08, duration: 0.2, yoyo: true, repeat: 1 });
      rootRef.current.style.borderColor = color;
      rootRef.current.style.boxShadow = `0 0 14px ${color}55`;
      window.setTimeout(() => {
        if (!rootRef.current) return;
        rootRef.current.style.borderColor = "";
        rootRef.current.style.boxShadow = "0 0 8px rgba(194, 106, 58, 0.12)";
      }, 450);
    },
    reset() {
      if (!rootRef.current) return;
      gsap.to(rootRef.current, { scale: 1, duration: 0.3 });
    },
  }));

  const iconSize = Math.round(size * 0.46);

  return (
    <div
      ref={rootRef}
      className={cn("flex items-center justify-center rounded-sm border", className)}
      style={{
        width: size,
        height: size,
        background: faceColor,
        border,
        boxShadow: "0 0 8px rgba(194, 106, 58, 0.12)",
      }}
    >
      <Icon size={iconSize} color={accentColor} strokeWidth={1.5} aria-hidden />
    </div>
  );
});

export const AnonymizeIconVisual = forwardRef<FlowVisualHandle, FlowVisualProps>(function AnonymizeIconVisual(props, ref) {
  return <IconVisual ref={ref} icon={ScanEye} {...props} />;
});

export const HiveDatasetIconVisual = forwardRef<FlowVisualHandle, FlowVisualProps>(function HiveDatasetIconVisual(
  props,
  ref,
) {
  return <IconVisual ref={ref} icon={Database} accentColor={props.accentColor ?? daemonColors.onlineGreen} {...props} />;
});

export const LedgerVisual = forwardRef<FlowVisualHandle, FlowVisualProps>(function LedgerVisual(
  { size = 38, faceColor = daemonColors.muted, accentColor = daemonColors.accentTertiary, className },
  ref,
) {
  const rootRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    highlight(color) {
      if (lineRef.current) {
        gsap.fromTo(lineRef.current, { scaleX: 0, opacity: 0.4 }, { scaleX: 1, opacity: 1, duration: 0.35, ease: "power2.out" });
      }
      if (rootRef.current) {
        gsap.to(rootRef.current, { y: -2, duration: 0.2, yoyo: true, repeat: 1 });
        rootRef.current.style.boxShadow = `0 0 14px ${color}`;
        window.setTimeout(() => {
          if (rootRef.current) rootRef.current.style.boxShadow = "none";
        }, 400);
      }
    },
    reset() {
      if (rootRef.current) gsap.to(rootRef.current, { y: 0, duration: 0.3 });
    },
  }));

  const slabH = Math.round(size * 0.18);
  return (
    <div ref={rootRef} className={cn("relative flex flex-col items-center justify-end gap-0.5 overflow-hidden", className)} style={{ width: size, height: size }}>
      {[0, 1, 2].map((layer) => (
        <div
          key={layer}
          className="w-full rounded-[2px] border"
          style={{
            height: slabH,
            background: faceColor,
            border,
            opacity: 1 - layer * 0.12,
            transform: `translateY(${layer * -2}px)`,
          }}
        />
      ))}
      <div
        ref={lineRef}
        className="absolute left-1 right-1 top-[42%] h-0.5 origin-left rounded-full"
        style={{ background: accentColor, transform: "scaleX(0.65)" }}
        aria-hidden
      />
      <div className="absolute bottom-0 left-1/2 h-1 w-3/4 -translate-x-1/2 rounded-full bg-accent/30 blur-[2px]" aria-hidden />
    </div>
  );
});

export const StorageVisual = forwardRef<FlowVisualHandle, FlowVisualProps>(function StorageVisual(
  { size = 36, faceColor = daemonColors.card, accentColor = daemonColors.onlineGreen, className },
  ref,
) {
  const rootRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    highlight(color) {
      if (!rootRef.current) return;
      rootRef.current.querySelectorAll<HTMLElement>(".storage-tier").forEach((tier, i) => {
        gsap.to(tier, { backgroundColor: color, duration: 0.15, delay: i * 0.06, yoyo: true, repeat: 1 });
      });
      gsap.to(rootRef.current, { scale: 1.05, duration: 0.2, yoyo: true, repeat: 1 });
    },
    reset() {
      if (!rootRef.current) gsap.to(rootRef.current, { scale: 1, duration: 0.3 });
    },
  }));

  const w = size;
  const h = Math.round(size * 1.05);
  return (
    <div ref={rootRef} className={cn("relative", className)} style={{ width: w, height: h, perspective: "500px" }}>
      <div className="absolute inset-x-1 bottom-0 top-2 rounded-md border" style={{ background: faceColor, border }} />
      {[0, 1, 2, 3].map((tier) => (
        <div
          key={tier}
          className="storage-tier absolute left-2 right-2 rounded-[1px] border border-line/60"
          style={{
            top: 10 + tier * 7,
            height: 5,
            background: tier === 3 ? `${accentColor}33` : `${faceColor}`,
          }}
        />
      ))}
      <div
        className="absolute -bottom-0.5 left-1/2 size-2 -translate-x-1/2 rounded-full"
        style={{ background: accentColor, boxShadow: `0 0 8px ${accentColor}` }}
        aria-hidden
      />
    </div>
  );
});

export type FlowVisualVariant = "cube" | "anonymize" | "ledger" | "storage" | "hive-dataset";

type FlowNodeVisualProps = FlowVisualProps & {
  variant?: FlowVisualVariant;
};

export const FlowNodeVisual = forwardRef<FlowVisualHandle | DaemonCubeHandle, FlowNodeVisualProps>(
  function FlowNodeVisual({ variant = "cube", ...props }, ref) {
    if (variant === "anonymize") return <AnonymizeIconVisual ref={ref as Ref<FlowVisualHandle>} {...props} />;
    if (variant === "hive-dataset") return <HiveDatasetIconVisual ref={ref as Ref<FlowVisualHandle>} {...props} />;
    if (variant === "ledger") return <LedgerVisual ref={ref as Ref<FlowVisualHandle>} {...props} />;
    if (variant === "storage") return <StorageVisual ref={ref as Ref<FlowVisualHandle>} {...props} />;
    return <DaemonCube ref={ref as Ref<DaemonCubeHandle>} {...props} />;
  },
);
