import type { IconGlyph } from "./icons";

export type ModelAddon = {
  id: string;
  name: string;
  description: string;
  size: string;
  badge: string;
  tag: "Basic" | "Lightweight" | "Tools" | "Recommended" | "Advanced" | "Voice" | "Embedding" | "Vision" | "OCR";
  kind: "agent" | "voice" | "embedding" | "vision" | "ocr";
};

export type Integration = {
  id: string;
  name: string;
  description: string;
  status: "ready" | "placeholder" | "needs-key";
  region?: string;
  icon: IconGlyph;
};

export type ToolCard = {
  id: "device" | "files" | "calendar" | "wallet" | "memory" | "api" | "onchain" | "vision" | "websearch" | "voice";
  name: string;
  description: string;
  confirmation: string;
  icon: IconGlyph;
  defaultEnabled?: boolean;
};

export const modelAddons: ModelAddon[] = [
  {
    id: "qwen35-08b-q4km",
    name: "Qwen 3.5 Mobile (0.8B)",
    description:
      "Default mid-range phone agent. Unsloth Q4_K_M GGUF with QVAC 0.11 Qwen3.5 tool dialect + reasoning_budget support.",
    size: "~0.5 GB",
    badge: "Qwen3.5",
    tag: "Recommended",
    kind: "agent",
  },
  {
    id: "qwen35-2b-q4km",
    name: "Qwen 3.5 Tool Agent (2B)",
    description:
      "Balanced Qwen 3.5 for dynamic tool calling on wallet, device, web, onchain, file, and vision tools.",
    size: "~1.2 GB",
    badge: "Qwen3.5",
    tag: "Recommended",
    kind: "agent",
  },
  {
    id: "qwen35-4b-q4km",
    name: "Qwen 3.5 Reasoning (4B)",
    description:
      "Deeper on-device synthesis when the phone has headroom (~8 GB RAM). Same Qwen3.5/Qwen3.6 parser stack as 0.11.",
    size: "~2.6 GB",
    badge: "Qwen3.5",
    tag: "Advanced",
    kind: "agent",
  },
  {
    id: "gemma4-e2b-q4km",
    name: "Gemma 4 Multimodal (E2B)",
    description:
      "Google Gemma 4 E2B instruct with mmproj for image-aware chat. QVAC 0.11 gemma4 tool dialect and reasoning_budget.",
    size: "~3.9 GB",
    badge: "Gemma 4",
    tag: "Advanced",
    kind: "vision",
  },
  {
    id: "qwen3-1-7b-q4",
    name: "QVAC Tool Agent (legacy 1.7B)",
    description:
      "Registry Qwen3-1.7B Q4 — kept for fast QVAC DHT downloads when Hugging Face is slow. Prefer Qwen 3.5 rows above.",
    size: "~1.1 GB",
    badge: "Legacy",
    tag: "Tools",
    kind: "agent",
  },
  {
    id: "qwen3-600m-q4-registry",
    name: "QVAC CPU Baseline (Qwen 0.6B)",
    description:
      "Small QVAC registry Qwen3 Q4_0 model for CPU-only smoke tests and isolating Vulkan backend crashes from model download issues.",
    size: "~382 MB",
    badge: "CPU test",
    tag: "Lightweight",
    kind: "agent",
  },
  {
    id: "llama32-1b-q4-registry",
    name: "QVAC CPU Baseline (Llama 1B)",
    description:
      "QVAC registry Llama 3.2 1B Q4_0 reference model. Useful as a plain transformer CPU baseline before re-enabling HA.",
    size: "~773 MB",
    badge: "CPU test",
    tag: "Basic",
    kind: "agent",
  },
  {
    id: "bitnet-07b-tq2-registry",
    name: "QVAC Tiny CPU Baseline (BitNet 0.7B)",
    description:
      "Very small QVAC registry TQ2_0 LLM for fast install/load checks on constrained Android devices.",
    size: "~217 MB",
    badge: "Tiny",
    tag: "Lightweight",
    kind: "agent",
  },
  {
    id: "medpsy-17b-q4km",
    name: "QVAC MedPsy (1.7B)",
    description:
      "Private medical-analysis preset model from QVAC. Intended for sensitive document triage, symptom summaries, and local-only preparation before any clinician or data-sharing step.",
    size: "~1.3 GB",
    badge: "MedPsy",
    tag: "Advanced",
    kind: "agent",
  },
  {
    id: "llama32-3b-q4km",
    name: "Llama 3.2 Control (3B)",
    description:
      "Plain transformer GGUF control model for isolating Qwen 3.5 hybrid/recurrent GPU allocation failures.",
    size: "~2.0 GB",
    badge: "Llama",
    tag: "Basic",
    kind: "agent",
  },
  {
    id: "embeddinggemma-300m-q4",
    name: "QVAC Memory Embeddings",
    description: "QVAC registry EmbeddingGemma Q4 for private local memory and RAG.",
    size: "~190 MB",
    badge: "Memory",
    tag: "Embedding",
    kind: "embedding",
  },
  {
    id: "qvac-latin-ocr",
    name: "QVAC OCR Reader",
    description: "QVAC ONNX OCR recognizer for private image text extraction before ML Kit fallback.",
    size: "~65 MB",
    badge: "OCR",
    tag: "OCR",
    kind: "ocr",
  },
  {
    id: "whisper-tiny",
    name: "QVAC Realtime Listener",
    description: "Whisper Tiny with Silero VAD for local speech-to-text and end-of-turn voice loop detection.",
    size: "~150 MB",
    badge: "ASR",
    tag: "Voice",
    kind: "voice",
  },
  {
    id: "supertonic-tts-en",
    name: "QVAC Realtime Voice",
    description: "Supertonic ONNX TTS components for local spoken replies in Daemon voice mode.",
    size: "~220 MB",
    badge: "TTS",
    tag: "Voice",
    kind: "voice",
  },
];

export const integrations: Integration[] = [
  {
    id: "telegram",
    name: "Telegram",
    description: "Connect a bot token and route selected chats to Daemon's on-device agent loop.",
    status: "placeholder",
    icon: "MSG",
  },
  {
    id: "imessage",
    name: "iMessage",
    description: "Photon Spectrum provider for US-only iMessage access in this MVP.",
    status: "needs-key",
    region: "US",
    icon: "IM",
  },
];

export const tools: ToolCard[] = [
  {
    id: "device",
    name: "Device Information",
    description: "Let the agent read local device metadata such as model, OS, memory class, and app runtime context.",
    confirmation: "Device information stays local and is used for runtime-aware answers.",
    icon: "PH",
    defaultEnabled: true,
  },
  {
    id: "files",
    name: "Private Files",
    description: "Let the agent inspect user-picked files after an explicit file picker approval.",
    confirmation: "Each file still requires user picker confirmation before the agent can inspect it.",
    icon: "FS",
    defaultEnabled: false,
  },
  {
    id: "vision",
    name: "QVAC Vision/OCR",
    description: "Prefer QVAC OCR for user-picked images, then use Android ML Kit labels/OCR as fallback evidence.",
    confirmation: "Image inspection runs only after the user picks a local image; QVAC OCR is preferred when installed.",
    icon: "AI",
    defaultEnabled: false,
  },
  {
    id: "voice",
    name: "QVAC Voice Loop",
    description: "Use QVAC Whisper/VAD, the active local agent, and QVAC TTS for private spoken turns.",
    confirmation: "Voice turns run locally after you install the listener and voice add-ons. Live microphone streaming remains explicit.",
    icon: "AI",
    defaultEnabled: false,
  },
  {
    id: "calendar",
    name: "Calendar Access",
    description: "Read local calendar metadata and upcoming events after Android calendar permission is granted.",
    confirmation: "Calendar permission is requested by Android and edits will remain confirmation-gated.",
    icon: "CAL",
  },
  {
    id: "wallet",
    name: "Wallet",
    description: "Connect a Mantle address, read MNT balances, and inspect the agent identity/benchmark anchor.",
    confirmation: "Signing remains outside Daemon; the local agent can prepare benchmark evidence but cannot sign by itself.",
    icon: "WALLET",
    defaultEnabled: false,
  },
  {
    id: "memory",
    name: "Local Memory",
    description: "Create local memory backups for profile, enabled tools, and manual endpoint configuration.",
    confirmation: "Backups are written to the app sandbox unless the user exports them later.",
    icon: "MEM",
    defaultEnabled: true,
  },
  {
    id: "onchain",
    name: "Onchain Analysis",
    description:
      "Resolve Solana tickers, fetch holder distribution, inspect recent holder balance deltas, and enrich with public market, security, and social APIs. Instant mode routes spot-price prompts through Dex → Jupiter → web fallbacks before any local LLM.",
    confirmation: "This tool makes network calls to public crypto APIs and Solana RPC. Daemon should summarize findings as analysis, not financial advice.",
    icon: "NET",
    defaultEnabled: false,
  },
  {
    id: "api",
    name: "API Endpoint Calls",
    description: "Let the local agent call curated or manually added HTTP endpoints with user confirmation.",
    confirmation: "Manual endpoints are user-owned. Review method and URL before enabling calls.",
    icon: "NET",
    defaultEnabled: false,
  },
  {
    id: "websearch",
    name: "Web Search",
    description:
      "Optional Google Programmable Search (Custom Search JSON API) when you add an API key and search engine id in the vault—full multi-word queries and snippets. Otherwise falls back to DuckDuckGo instant answers.",
    confirmation: "Google queries use your key and cx over HTTPS. Verify important facts yourself.",
    icon: "NET",
    defaultEnabled: false,
  },
];

export const statusRail = [
  { label: "Inference", value: "Local", icon: "AI" },
  { label: "Privacy", value: "On-device", icon: "SEC" },
  { label: "Models", value: "Add-ons", icon: "DL" },
  { label: "Keys", value: "User-owned", icon: "KEY" },
];
