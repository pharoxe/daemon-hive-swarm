"use client";

import { CubeCluster } from "@/components/react-bits/CubeCluster";
import { daemonColors } from "@/lib/daemon-theme";

const nodes = [
  { id: "daemon", label: "Your Daemon", sub: "Local QVAC agent", size: 38, accentColor: daemonColors.accent },
  { id: "swarm", label: "Hyperswarm", sub: "P2P discovery", size: 32, accentColor: daemonColors.accentSecondary, faceColor: daemonColors.muted },
  { id: "peer", label: "Peer Daemon", sub: "Delegated inference", size: 38, accentColor: daemonColors.accent },
];

export function SwarmCubesVisual() {
  return (
    <CubeCluster
      nodes={nodes}
      scale={1.5}
      caption="Compute routes across the swarm when you opt in"
    />
  );
}
