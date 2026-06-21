import { SectionShell } from "@/components/layout/SectionShell";
import { SwarmFlowVisual } from "@/components/media/SwarmFlowVisual";

export function HiveSection() {
  return (
    <SectionShell
      id="hive"
      label="Hive"
      title="A swarm of private agents."
      description="Daemon connects you to the Hive - a peer network where phones share spare compute and discover each other without a central server."
      bullets={[
        "Find peers over Hyperswarm.",
        "Offload heavy inference when you opt in.",
        "Share capability manifests - not private files.",
      ]}
      reverse
    >
      <SwarmFlowVisual />
    </SectionShell>
  );
}
