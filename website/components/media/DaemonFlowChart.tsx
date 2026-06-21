"use client";

import { useMemo } from "react";
import {
  Background,
  BackgroundVariant,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { cn } from "@/lib/utils";

export type FlowNodeData = {
  label: string;
  sublabel?: string;
  tone?: "default" | "accent" | "success";
};

function FlowNode({ data }: NodeProps<Node<FlowNodeData>>) {
  const tone = data.tone ?? "default";
  return (
    <div
      className={cn(
        "min-w-[120px] max-w-[160px] border px-3 py-2 text-center shadow-[0_0_20px_rgba(0,0,0,0.25)]",
        tone === "accent" && "border-accent bg-card text-head",
        tone === "success" && "border-success bg-card text-head",
        tone === "default" && "border-line bg-depth text-main",
      )}
    >
      <Handle type="target" position={Position.Left} className="!border-line !bg-accent !size-2" />
      <p className="font-[family-name:var(--font-proto)] text-[11px] uppercase leading-tight tracking-wide text-glow">
        {data.label}
      </p>
      {data.sublabel ? <p className="mt-1 text-[10px] leading-snug text-mute">{data.sublabel}</p> : null}
      <Handle type="source" position={Position.Right} className="!border-line !bg-accent !size-2" />
    </div>
  );
}

const nodeTypes = { daemon: FlowNode };

type DaemonFlowChartProps = {
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  className?: string;
  height?: number;
};

export function DaemonFlowChart({ nodes, edges, className, height = 220 }: DaemonFlowChartProps) {
  const flowNodes = useMemo(() => nodes, [nodes]);
  const flowEdges = useMemo(() => edges, [edges]);

  return (
    <div
      className={cn("overflow-hidden border border-line bg-card/90 backdrop-blur-sm", className)}
      style={{ height }}
    >
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        preventScrolling={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="var(--flow-dot)" />
      </ReactFlow>
    </div>
  );
}
