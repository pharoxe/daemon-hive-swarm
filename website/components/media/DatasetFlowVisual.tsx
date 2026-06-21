"use client";

import { useReducedMotion } from "framer-motion";
import { Database, Layers, ScanEye, Smartphone } from "lucide-react";
import { FlowLine, FlowShell, StepCard } from "@/components/media/flow-visual-primitives";

export function DatasetFlowVisual() {
  const reduced = useReducedMotion();

  return (
    <FlowShell gradient="accent">
      <StepCard
        icon={Smartphone}
        label="On-device signal"
        sub="Stays local"
        className="w-full max-w-[220px]"
        reduced={!!reduced}
      />

      <FlowLine reduced={!!reduced} label="Process locally" />

      <StepCard
        icon={ScanEye}
        label="Anonymize"
        sub="Strip identifiers"
        glow="rust"
        className="w-full max-w-[220px]"
        reduced={!!reduced}
      />

      <FlowLine reduced={!!reduced} delay={0.25} label="Append record" color="rust" />

      <StepCard
        icon={Layers}
        label="Hypercore"
        sub="Append-only log"
        glow="muted"
        iconClassName="text-[#c6b19b]"
        className="w-full max-w-[240px]"
        reduced={!!reduced}
      />

      <FlowLine reduced={!!reduced} delay={0.5} label="Share aggregate" />

      <StepCard
        icon={Database}
        label="Hive dataset"
        sub="Open contribution"
        glow="success"
        iconClassName="text-success"
        className="w-full max-w-[220px]"
        reduced={!!reduced}
      />
    </FlowShell>
  );
}
