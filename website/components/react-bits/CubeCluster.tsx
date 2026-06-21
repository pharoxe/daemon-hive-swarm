"use client";

import { Fragment, useEffect, useRef } from "react";
import type { DaemonCubeHandle } from "@/components/react-bits/DaemonCube";
import { FlowNodeVisual, type FlowVisualHandle, type FlowVisualVariant } from "@/components/react-bits/FlowNodeVisual";
import { daemonColors } from "@/lib/daemon-theme";
import { cn } from "@/lib/utils";

export type CubeClusterNode = {
  id: string;
  label: string;
  sub: string;
  size?: number;
  faceColor?: string;
  accentColor?: string;
  variant?: FlowVisualVariant;
};

type NodeHandle = DaemonCubeHandle | FlowVisualHandle;

function highlightNode(handle: NodeHandle | null, node: CubeClusterNode) {
  if (!handle) return;
  const color = node.accentColor ?? daemonColors.accent;
  if ("tilt" in handle) {
    handle.tilt(-28, 32);
    handle.pulse(color);
  } else {
    handle.highlight(color);
  }
}

function resetNode(handle: NodeHandle | null) {
  if (!handle) return;
  handle.reset();
}

type CubeClusterProps = {
  nodes: CubeClusterNode[];
  className?: string;
  autoAnimate?: boolean;
  caption?: string;
  framed?: boolean;
  /** Multiplier for icon slots, labels, and spacing (default 1). */
  scale?: number;
};

export function CubeCluster({
  nodes,
  className,
  autoAnimate = true,
  caption,
  framed = false,
  scale = 1,
}: CubeClusterProps) {
  const nodeRefs = useRef<(NodeHandle | null)[]>([]);
  const iconSlot = Math.round(44 * scale);
  const defaultIconSize = Math.round(38 * scale);
  const columnWidth = `${4.85 * scale}rem`;
  const arrowWidth = Math.round(28 * scale);
  const labelClass = scale >= 1.25 ? "text-xs" : "text-[10px]";
  const subClass = scale >= 1.25 ? "text-sm" : "text-[11px]";

  useEffect(() => {
    if (!autoAnimate || nodes.length === 0) return;

    let index = 0;
    const tick = () => {
      nodeRefs.current.forEach((handle, i) => {
        if (i === index) highlightNode(handle, nodes[i]!);
        else resetNode(handle);
      });
      index = (index + 1) % nodes.length;
    };

    tick();
    const interval = window.setInterval(tick, 1400);
    return () => window.clearInterval(interval);
  }, [autoAnimate, nodes]);

  return (
    <div className={cn("flex w-full flex-col items-center gap-5", className)}>
      <div
        className={cn(
          "w-full",
          framed && "rounded-sm border border-line/50 bg-card/25 px-3 py-5 backdrop-blur-sm md:px-5",
        )}
      >
        <div className="flex w-full max-w-xl flex-wrap items-start justify-center gap-x-1 gap-y-3 md:mx-auto md:gap-x-2">
          {nodes.map((node, index) => (
            <Fragment key={node.id}>
              <div className="flex shrink-0 flex-col items-center gap-2" style={{ width: columnWidth }}>
                <div
                  className="flex shrink-0 items-center justify-center"
                  style={{ width: iconSlot, height: iconSlot }}
                >
                  <FlowNodeVisual
                    ref={(el) => {
                      nodeRefs.current[index] = el;
                    }}
                    variant={node.variant ?? "cube"}
                    size={node.size ? Math.round(node.size * scale) : defaultIconSize}
                    faceColor={node.faceColor ?? daemonColors.card}
                    accentColor={node.accentColor ?? daemonColors.accent}
                  />
                </div>
                <div className="w-full text-center">
                  <p
                    className={cn(
                      "font-[family-name:var(--font-proto)] uppercase leading-tight tracking-wide text-head text-glow",
                      labelClass,
                    )}
                  >
                    {node.label}
                  </p>
                  <p className={cn("mt-1 text-mute text-legible", subClass)}>{node.sub}</p>
                </div>
              </div>
              {index < nodes.length - 1 ? (
                <div
                  className="flex shrink-0 items-center justify-center text-accent/80"
                  style={{ width: arrowWidth, height: iconSlot, fontSize: `${Math.round(14 * scale)}px` }}
                  aria-hidden
                >
                  →
                </div>
              ) : null}
            </Fragment>
          ))}
        </div>
      </div>
      {caption ? <p className="max-w-md text-center text-sm text-sub text-legible">{caption}</p> : null}
    </div>
  );
}
