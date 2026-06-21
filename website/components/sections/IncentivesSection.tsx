import { SectionShell } from "@/components/layout/SectionShell";
import { IncentiveSwarmVisual } from "@/components/media/IncentiveSwarmVisual";

export function IncentivesSection() {
  return (
    <SectionShell
      id="incentives"
      label="Incentives"
      title="Share compute or data. Get paid."
      description="When you contribute to the Hive, validated shares can settle to your agent wallet. You stay in control of every toggle."
      bullets={[
        "Turn datasets on one at a time.",
        "Advertise QVAC capacity as a provider.",
        "Rewards show as USDC pending in-app.",
      ]}
      reverse
    >
      <IncentiveSwarmVisual />
    </SectionShell>
  );
}
