"use client";

import { CubeCluster } from "@/components/react-bits/CubeCluster";
import { daemonColors } from "@/lib/daemon-theme";

const steps = [
  { id: "signal", label: "On-device signal", sub: "Stays local", variant: "cube" as const },
  { id: "anonymize", label: "Anonymize", sub: "Strip identifiers", variant: "anonymize" as const },
  {
    id: "hypercore",
    label: "Hypercore",
    sub: "Append log",
    faceColor: daemonColors.muted,
    accentColor: daemonColors.accentTertiary,
    variant: "ledger" as const,
  },
  {
    id: "hive",
    label: "Hive dataset",
    sub: "Shared aggregate",
    accentColor: daemonColors.onlineGreen,
    variant: "hive-dataset" as const,
  },
];

export function DatasetFlowCubes() {
  return <CubeCluster nodes={steps} framed />;
}
