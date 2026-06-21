"use client";

import { useReducedMotion } from "framer-motion";
import { Bot, Cpu, Database, Network, Wallet } from "lucide-react";
import { FlowLine, FlowShell, MergeLines, StepCard } from "@/components/media/flow-visual-primitives";

export function IncentiveSwarmVisual() {
  const reduced = useReducedMotion();

  return (
    <FlowShell gradient="success">
      <StepCard icon={Bot} label="Your agent" sub="Share when you opt in" className="w-full max-w-[220px]" reduced={!!reduced} />

      <div className="mt-3 grid w-full max-w-[280px] grid-cols-2 gap-3">
        <StepCard icon={Cpu} label="Compute" sub="QVAC capacity" glow="rust" reduced={!!reduced} />
        <StepCard icon={Database} label="Data" sub="Anonymized signals" glow="rust" reduced={!!reduced} />
      </div>

      <MergeLines reduced={!!reduced} id="incentive-merge" />

      <StepCard
        icon={Network}
        label="Hive swarm"
        sub="Peers validate your contribution"
        glow="rust"
        pulse
        className="w-full max-w-[260px]"
        reduced={!!reduced}
      />

      <FlowLine reduced={!!reduced} delay={0.3} label="Rewards settle" />

      <StepCard
        icon={Wallet}
        label="Agent wallet"
        sub="USDC pending"
        glow="success"
        iconClassName="text-success"
        className="w-full max-w-[220px]"
        reduced={!!reduced}
      />
    </FlowShell>
  );
}
