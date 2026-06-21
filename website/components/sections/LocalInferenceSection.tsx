import { SectionShell } from "@/components/layout/SectionShell";
import { TrueFocus } from "@/components/react-bits/TrueFocus";
import { LocalAgentFlowVisual } from "@/components/media/LocalAgentFlowVisual";

export function LocalInferenceSection() {
  return (
    <SectionShell
      id="agent"
      label="Daemon Agent"
      title="Your agent stays on your device."
      description="Daemon runs through QVAC on your phone."
      copyExtra={
        <TrueFocus
          sentence="Choose what runs on your device and what leaves it."
          className="max-w-xl text-lg leading-relaxed text-sub text-legible"
          wordClassName="text-legible"
          borderColor="#c26a3a"
          glowColor="rgba(194, 106, 58, 0.5)"
          blurAmount={3.5}
          animationDuration={0.225}
          pauseBetweenAnimations={0.425}
        />
      }
      bullets={[
        "Chat, voice, OCR, and tools run locally.",
        "Cloud models only if you add your own keys.",
        "Works on capable Android devices today.",
      ]}
    >
      <LocalAgentFlowVisual />
    </SectionShell>
  );
}
