"use client";

import { useReducedMotion } from "framer-motion";
import { Box, MessageSquare, Smartphone } from "lucide-react";
import { FlowLine, FlowShell, StepCard } from "@/components/media/flow-visual-primitives";

export function LocalAgentFlowVisual() {
  const reduced = useReducedMotion();

  return (
    <FlowShell>
      <StepCard
        icon={Box}
        label="Load models"
        sub="Download QVAC models on-device"
        glow="success"
        iconClassName="text-success"
        className="w-full max-w-[240px]"
        reduced={!!reduced}
      />

      <FlowLine reduced={!!reduced} label="Ready to run" />

      <StepCard
        icon={MessageSquare}
        label="Chat & tools"
        sub="Talk to your agent"
        className="w-full max-w-[220px]"
        reduced={!!reduced}
      />

      <FlowLine reduced={!!reduced} delay={0.3} label="Runs on device" color="rust" />

      <StepCard
        icon={Smartphone}
        label="On your phone"
        sub="Private, local inference on your device"
        glow="rust"
        pulse
        className="w-full max-w-[260px]"
        reduced={!!reduced}
      />
    </FlowShell>
  );
}
