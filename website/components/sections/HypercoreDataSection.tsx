import { SectionShell } from "@/components/layout/SectionShell";
import { DatasetFlowVisual } from "@/components/media/DatasetFlowVisual";

export function HypercoreDataSection() {
  return (
    <SectionShell
      id="datasets"
      label="Datasets"
      title="Contribute to open datasets"
      description="Local inference lets Daemon anonymize signals on your phone. Then it shares these data points with Hypercore for the Hive."
      bullets={[
        "Seven dataset types, each opt-in.",
        "No raw prompts or documents leave the device.",
        "Medical reports de-identified before any share.",
      ]}
    >
      <DatasetFlowVisual />
    </SectionShell>
  );
}
