"use client";

import type { Edge, Node, NodeProps } from "@xyflow/react";
import { Handle, Position, ReactFlow, Background, BackgroundVariant } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FlowNodeData } from "./DaemonFlowChart";
import { DaemonFlowChart } from "./DaemonFlowChart";

const edgeDefaults = { animated: true, style: { stroke: "var(--flow-edge)", strokeWidth: 2 } };

export function QvacStackFlow() {
  const nodes: Node<FlowNodeData>[] = [
    { id: "chat", type: "daemon", position: { x: 0, y: 40 }, data: { label: "Chat & tools", sublabel: "Talk to your agent" } },
    { id: "local", type: "daemon", position: { x: 200, y: 40 }, data: { label: "On your phone", sublabel: "Runs locally", tone: "accent" } },
    { id: "models", type: "daemon", position: { x: 400, y: 40 }, data: { label: "Your models", sublabel: "Download what you need", tone: "success" } },
  ];
  const edges: Edge[] = [
    { id: "e1", source: "chat", target: "local", ...edgeDefaults },
    { id: "e2", source: "local", target: "models", ...edgeDefaults },
  ];
  return <DaemonFlowChart nodes={nodes} edges={edges} height={180} />;
}

function FlowNode({ data }: NodeProps<Node<FlowNodeData>>) {
  const tone = data.tone ?? "default";
  return (
    <div
      className={cn(
        "min-w-[132px] border px-4 py-3 text-center shadow-[0_0_20px_rgba(0,0,0,0.25)]",
        tone === "accent" && "border-accent bg-card text-head",
        tone === "success" && "border-success bg-card text-head",
        tone === "default" && "border-line bg-depth text-main",
      )}
    >
      <Handle type="target" position={Position.Top} className="!border-line !bg-accent !size-2.5" />
      <p className="font-[family-name:var(--font-proto)] text-[11px] uppercase leading-tight tracking-wide text-glow">
        {data.label}
      </p>
      {data.sublabel ? <p className="mt-1.5 text-[11px] leading-snug text-mute">{data.sublabel}</p> : null}
      <Handle type="source" position={Position.Bottom} className="!border-line !bg-accent !size-2.5" />
    </div>
  );
}

function WalletNode({ data }: NodeProps<Node<FlowNodeData>>) {
  return (
    <div className="flex min-w-[148px] flex-col items-center gap-2.5 border border-success bg-card px-4 py-4 text-center shadow-[0_0_24px_rgba(142,240,184,0.2)]">
      <Handle type="target" position={Position.Top} className="!border-success !bg-success !size-2.5" />
      <Wallet className="size-7 text-success" strokeWidth={1.5} aria-hidden />
      <p className="font-[family-name:var(--font-proto)] text-[11px] uppercase tracking-wide text-head text-glow">
        {data.label}
      </p>
      <p className="text-[11px] text-mute">{data.sublabel}</p>
    </div>
  );
}

const nodeTypes = { daemon: FlowNode, wallet: WalletNode };

export function IncentiveLoopFlow() {
  const nodes: Node<FlowNodeData>[] = [
    { id: "opt", type: "daemon", position: { x: 24, y: 0 }, data: { label: "Opt in", sublabel: "Share data or compute" } },
    {
      id: "share",
      type: "daemon",
      position: { x: 24, y: 100 },
      data: { label: "Contribute", sublabel: "Your anonymized share", tone: "accent" },
    },
    {
      id: "val",
      type: "daemon",
      position: { x: 24, y: 200 },
      data: { label: "Validate", sublabel: "Network checks it", tone: "accent" },
    },
    {
      id: "wallet",
      type: "wallet",
      position: { x: 16, y: 310 },
      data: { label: "Agent wallet", sublabel: "USDC pending" },
    },
  ];
  const edges: Edge[] = [
    { id: "e1", source: "opt", target: "share", ...edgeDefaults },
    { id: "e2", source: "share", target: "val", ...edgeDefaults },
    { id: "e3", source: "val", target: "wallet", ...edgeDefaults },
  ];

  return (
    <div className="mx-auto h-[448px] max-w-[260px] overflow-hidden border border-line bg-card/90 backdrop-blur-sm">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="var(--flow-dot)" />
      </ReactFlow>
    </div>
  );
}
