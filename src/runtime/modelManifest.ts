export type RuntimeModel = {
  id: string;
  title: string;
  modelType: "llamacpp-completion" | "llamacpp-embedding" | "whispercpp-transcription" | "tts-ggml" | "ocr";
  sourceKind: "qvac-registry" | "https" | "local-file";
  /** QVAC registry constant, HTTPS artifact URL, or `file://` path depending on modelType. */
  source: string;
  /** Extra registry constants or HTTPS URLs needed by compound voice and multimodal models. */
  supportSources?: Record<string, string>;
  approximateSize: string;
  tag: "Basic" | "Lightweight" | "Tools" | "Recommended" | "Advanced" | "Voice" | "Embedding" | "Vision" | "OCR";
  role: "reasoning" | "tool-agent" | "vision" | "embedding" | "voice" | "ocr";
  bundled: false;
};

/** Unsloth Dynamic 2.0 Q4_K_M weights — QVAC 0.11 auto-detects Qwen3.5 / Qwen3.6 tool-call dialects from the path. */
const QWEN35_08B_Q4KM =
  "https://huggingface.co/unsloth/Qwen3.5-0.8B-GGUF/resolve/main/Qwen3.5-0.8B-Q4_K_M.gguf";
const QWEN35_2B_Q4KM =
  "https://huggingface.co/unsloth/Qwen3.5-2B-GGUF/resolve/main/Qwen3.5-2B-Q4_K_M.gguf";
const QWEN35_4B_Q4KM =
  "https://huggingface.co/unsloth/Qwen3.5-4B-GGUF/resolve/main/Qwen3.5-4B-Q4_K_M.gguf";
const GEMMA4_E2B_Q4KM =
  "https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF/resolve/main/gemma-4-E2B-it-Q4_K_M.gguf";
const GEMMA4_E2B_MMPROJ_F16 =
  "https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF/resolve/main/mmproj-F16.gguf";
const MEDPSY_17B_Q4KM =
  "https://huggingface.co/qvac/MedPsy-1.7B-GGUF/resolve/main/medpsy-1.7b-q4_k_m-imat.gguf";
const LLAMA32_3B_Q4KM =
  "https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf";

export const runtimeModels: RuntimeModel[] = [
  {
    id: "qwen35-08b-q4km",
    title: "Qwen 3.5 Mobile (0.8B)",
    modelType: "llamacpp-completion",
    sourceKind: "https",
    source: QWEN35_08B_Q4KM,
    approximateSize: "~0.5 GB",
    tag: "Recommended",
    role: "reasoning",
    bundled: false,
  },
  {
    id: "qwen35-2b-q4km",
    title: "Qwen 3.5 Tool Agent (2B)",
    modelType: "llamacpp-completion",
    sourceKind: "https",
    source: QWEN35_2B_Q4KM,
    approximateSize: "~1.2 GB",
    tag: "Recommended",
    role: "tool-agent",
    bundled: false,
  },
  {
    id: "qwen35-4b-q4km",
    title: "Qwen 3.5 Reasoning (4B)",
    modelType: "llamacpp-completion",
    sourceKind: "https",
    source: QWEN35_4B_Q4KM,
    approximateSize: "~2.6 GB",
    tag: "Advanced",
    role: "reasoning",
    bundled: false,
  },
  {
    id: "gemma4-e2b-q4km",
    title: "Gemma 4 Multimodal (E2B)",
    modelType: "llamacpp-completion",
    sourceKind: "https",
    source: GEMMA4_E2B_Q4KM,
    supportSources: {
      projectionModelSrc: GEMMA4_E2B_MMPROJ_F16,
    },
    approximateSize: "~3.9 GB",
    tag: "Advanced",
    role: "vision",
    bundled: false,
  },
  {
    id: "qwen3-1-7b-q4",
    title: "QVAC Tool Agent (legacy 1.7B)",
    modelType: "llamacpp-completion",
    sourceKind: "qvac-registry",
    source: "QWEN3_1_7B_INST_Q4",
    approximateSize: "~1.1 GB",
    tag: "Tools",
    role: "tool-agent",
    bundled: false,
  },
  {
    id: "qwen3-600m-q4-registry",
    title: "QVAC CPU Baseline (Qwen 0.6B)",
    modelType: "llamacpp-completion",
    sourceKind: "qvac-registry",
    source: "QWEN3_600M_INST_Q4",
    approximateSize: "~382 MB",
    tag: "Lightweight",
    role: "reasoning",
    bundled: false,
  },
  {
    id: "llama32-1b-q4-registry",
    title: "QVAC CPU Baseline (Llama 1B)",
    modelType: "llamacpp-completion",
    sourceKind: "qvac-registry",
    source: "LLAMA_3_2_1B_INST_Q4_0",
    approximateSize: "~773 MB",
    tag: "Basic",
    role: "reasoning",
    bundled: false,
  },
  {
    id: "bitnet-07b-tq2-registry",
    title: "QVAC Tiny CPU Baseline (BitNet 0.7B)",
    modelType: "llamacpp-completion",
    sourceKind: "qvac-registry",
    source: "BITNET_0_7B_INST_TQ2_0",
    approximateSize: "~217 MB",
    tag: "Lightweight",
    role: "reasoning",
    bundled: false,
  },
  {
    id: "medpsy-17b-q4km",
    title: "QVAC MedPsy (1.7B)",
    modelType: "llamacpp-completion",
    sourceKind: "https",
    source: MEDPSY_17B_Q4KM,
    approximateSize: "~1.3 GB",
    tag: "Advanced",
    role: "reasoning",
    bundled: false,
  },
  {
    id: "llama32-3b-q4km",
    title: "Llama 3.2 Control (3B)",
    modelType: "llamacpp-completion",
    sourceKind: "https",
    source: LLAMA32_3B_Q4KM,
    approximateSize: "~2.0 GB",
    tag: "Basic",
    role: "reasoning",
    bundled: false,
  },
  {
    id: "embeddinggemma-300m-q4",
    title: "QVAC Memory Embeddings",
    modelType: "llamacpp-embedding",
    sourceKind: "qvac-registry",
    source: "EMBEDDINGGEMMA_300M_Q4_0",
    approximateSize: "~190 MB",
    tag: "Embedding",
    role: "embedding",
    bundled: false,
  },
  {
    id: "qvac-latin-ocr",
    title: "QVAC OCR Reader",
    modelType: "ocr",
    sourceKind: "qvac-registry",
    source: "OCR_LATIN_RECOGNIZER_1",
    approximateSize: "~65 MB",
    tag: "OCR",
    role: "ocr",
    bundled: false,
  },
  {
    id: "whisper-tiny",
    title: "QVAC Realtime Listener",
    modelType: "whispercpp-transcription",
    sourceKind: "qvac-registry",
    source: "WHISPER_TINY",
    supportSources: {
      vadModelSrc: "VAD_SILERO_5_1_2",
    },
    approximateSize: "~150 MB",
    tag: "Voice",
    role: "voice",
    bundled: false,
  },
  {
    id: "supertonic-tts-en",
    title: "QVAC Realtime Voice",
    modelType: "tts-ggml",
    sourceKind: "qvac-registry",
    source: "TTS_EN_SUPERTONIC_Q4_0",
    approximateSize: "~220 MB",
    tag: "Voice",
    role: "voice",
    bundled: false,
  },
];

/** Default consumer preset model: small enough for local Android, capable enough for private guidance. */
export const recommendedRuntimeModelId = "qwen35-08b-q4km";

/** Pick a chat model id based on detected device GPU profile. */
export function recommendedModelIdForDevice(profileId?: string | null): string {
  if (profileId === "mali_vulkan" || profileId === "adreno_opencl") {
    return "qwen35-2b-q4km";
  }
  return recommendedRuntimeModelId;
}

/** Stored profile ids that should migrate to the new default lineup. */
export const retiredRuntimeModelIds = new Set([
  "qwen3-600m-fabric-q8",
  "qwen3-600m-q4",
  "qwen3-4b-q4",
  "qwen3-8b-q4",
  "llama-tool-1b-q4",
  "llama-tool-calling-1b-q4",
  "qwen3vl-2b-multimodal-q4",
  "executorch-qwen3-06b-xnnpack",
]);

export function isReasoningRuntimeModel(model?: RuntimeModel | null) {
  return model?.modelType === "llamacpp-completion";
}
