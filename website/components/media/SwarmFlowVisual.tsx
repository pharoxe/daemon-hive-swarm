"use client";

import { useReducedMotion } from "framer-motion";
import { Bot, Network, Share2 } from "lucide-react";
import { FlowShell, RoundTripLine, StepCard } from "@/components/media/flow-visual-primitives";

export function SwarmFlowVisual() {
  const reduced = useReducedMotion();

  return (
    <FlowShell gradient="rust">
      <StepCard
        icon={Bot}
        label="Your Daemon"
        sub="Requests delegated inference"
        className="w-full max-w-[220px]"
        reduced={!!reduced}
      />

      <RoundTripLine reduced={!!reduced} outboundLabel="Send request" returnLabel="Receive answer" />

      <StepCard
        icon={Network}
        label="Hyperswarm"
        sub="P2P discovery & routing"
        glow="rust"
        pulse
        className="w-full max-w-[260px]"
        reduced={!!reduced}
      />

      <RoundTripLine reduced={!!reduced} delay={0.25} outboundLabel="Route to peer" returnLabel="Route home" />

      <StepCard
        icon={Share2}
        label="Peer Daemon"
        sub="Runs inference, returns result"
        className="w-full max-w-[220px]"
        reduced={!!reduced}
      />

      <p className="mt-3 max-w-[280px] text-center text-xs text-sub text-legible">
        The response travels back through Hyperswarm to your Daemon on the same path.
      </p>
    </FlowShell>
  );
}
