import type { RuntimeModel } from "./modelManifest";
import type { Tool, ToolCallWithCall, ToolDialect } from "@qvac/sdk";
import { Paths } from "expo-file-system";
import * as FileSystem from "expo-file-system/legacy";
import { env } from "../config/env";
import { ensureQvacSdkConfigFile } from "./ensureQvacSdkConfig";
import {
  getActiveGpuProfile,
  getPreferredGpuBackend,
  getProgressiveGpuLayers,
  isFabricGpuUserEnabled,
  noteGpuLayerDecodeSuccess,
  setGpuDecodeEffective,
  shouldSkipGpuLoad,
} from "./deviceInferencePrefs";

export type QvacCheckResult = {
  ok: boolean;
  label: string;
  detail: string;
};

export type QvacLoadProgress = {
  label: string;
  percentage?: number;
};

export type QvacDelegateOptions = {
  providerPublicKey: string;
  timeout?: number;
  fallbackToLocal?: boolean;
};

const loadedModelCache = new Map<string, string>();

function toErrorDetail(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error);
  return compactSdkValidationError(raw);
}

function compactSdkValidationError(raw: string) {
  if (/Unrecognized keys?: .*"topic"/.test(raw) && /modelConfig/i.test(raw)) {
    return [
      "QVAC provider mode is not available in this embedded Android worker yet.",
      "Hive discovery is still active, and this device can still use provider keys advertised by another peer for delegated inference.",
    ].join(" ");
  }

  if (!raw.includes("invalid_union") && !raw.includes("Unrecognized key") && !raw.includes("Unrecognized keys")) {
    return raw;
  }

  const unrecognized = Array.from(raw.matchAll(/Unrecognized keys?: ([^\n]+)/g))
    .map((match) => match[1]?.replace(/\\"/g, '"').trim())
    .filter(Boolean);
  const invalidOptions = Array.from(raw.matchAll(/Invalid option: expected one of ([^\n]+)/g))
    .map((match) => match[1]?.replace(/\\"/g, '"').trim())
    .filter(Boolean);
  const details = [
    unrecognized.length ? `Unsupported modelConfig field(s): ${Array.from(new Set(unrecognized)).join("; ")}.` : "",
    invalidOptions.length ? `Schema alternatives checked: ${Array.from(new Set(invalidOptions)).slice(0, 3).join("; ")}.` : "",
  ].filter(Boolean);

  return details.length ? `QVAC model configuration was rejected. ${details.join(" ")}` : raw.slice(0, 1200);
}

/**
 * Vulkan/OpenCL offload for llama.cpp completion models when the build enables Fabric GPU
 * (`EXPO_PUBLIC_DAEMON_FABRIC_GPU=1`) and the user has not turned hardware acceleration off.
 * Applies to QVAC registry weights and `https` / `local-file` GGUF URLs — same backend.
 * Vision and voice adjuncts stay CPU-only for stability.
 */
function wantsLlamacppGpu(model?: RuntimeModel) {
  if (!env.fabricGpu || !env.fabricLlm) return false;
  if (!isFabricGpuUserEnabled()) return false;
  if (!model || model.modelType !== "llamacpp-completion") return false;
  if (isMedPsyModel(model)) return false;
  if (model.role === "vision") return false;
  return true;
}

function isMedPsyModel(model?: RuntimeModel) {
  return model?.id === "medpsy-17b-q4km";
}

function shouldUseJinjaTemplate(model?: RuntimeModel) {
  return model?.role === "tool-agent" || isMedPsyModel(model);
}

function finalOnlyGenerationParams(model?: RuntimeModel) {
  return { reasoning_budget: 0 } as any;
}

function profilerGenerationParams() {
  return { reasoning_budget: 0, predict: 48, temp: 0.1, top_p: 0.75 } as any;
}

function profilerPromptForModel(model: RuntimeModel) {
  if (isMedPsyModel(model)) {
    return {
      system: "You are MedPsy, a private medical analysis assistant. Reply with one concise final sentence.",
      user: "Summarize this clinical note in one sentence: patient reports mild headache, normal sleep, and good hydration.",
    };
  }

  return {
    system: "/no_think\nYou are Daemon. Reply with a concise final answer only.",
    user: "/no_think\nSummarize this in one sentence: local models are faster when prompts are compact.",
  };
}

function smokePromptForModel(model: RuntimeModel) {
  if (isMedPsyModel(model)) {
    return {
      system: "You are MedPsy, a private medical analysis assistant. Reply with a short final answer only.",
      user: "Say MEDPSY LOCAL OK in five words or less.",
    };
  }

  return {
    system: "/no_think\nYou are Daemon, a private local phone agent. Reply tersely with final answer only.",
    user: "/no_think\nSay LOCAL TEST OK in five words or less.",
  };
}

function fileUriToPath(uri: string) {
  return uri.replace(/^file:\/\//, "");
}

function getOpenClCacheDir() {
  return `${fileUriToPath(Paths.cache.uri).replace(/\/$/, "")}/qvac-opencl-cache`;
}

function getLlmModelConfig(model?: RuntimeModel, forceCpu = false) {
  const isToolAgent = model?.role === "tool-agent";
  const isVision = model?.role === "vision";
  const isTinyLlm =
    model?.id === "qwen35-08b-q4km" ||
    model?.id === "qwen3-600m-q4-registry" ||
    model?.id === "bitnet-07b-tq2-registry";
  const isMedicalPreset = isMedPsyModel(model);
  const isEveryday = model?.id === "qwen35-2b-q4km" || model?.id === "qwen3-1-7b-q4";
  const isDeepReasoning = model?.id === "qwen35-4b-q4km" || model?.id === "gemma4-e2b-q4km" || isMedicalPreset;
  const useGpu = wantsLlamacppGpu(model) && !forceCpu;
  const gpuProfile = getActiveGpuProfile();
  const preferredBackend = getPreferredGpuBackend();
  const maliProfile = gpuProfile === "mali_vulkan";
  const maliGpuProbe = useGpu && maliProfile;
  // Smaller ctx/predict on mid-range phones: less prefill work and faster first token (see off-grid style “light” paths).
  const defaultContext = isTinyLlm
    ? maliProfile
      ? 1024
      : 1024
    : isMedicalPreset
      ? maliProfile
        ? 704
        : 768
    : isToolAgent
      ? maliProfile
        ? 640
        : 768
      : isVision
        ? 1024
      : isEveryday
        ? maliProfile
          ? 768
          : 1024
        : isDeepReasoning
          ? maliProfile
            ? 1024
            : 1536
          : maliProfile
            ? 768
            : 1024;
  const defaultPredict = isTinyLlm
    ? maliProfile
      ? 768
      : 768
    : isMedicalPreset
      ? maliProfile
        ? 96
        : 128
    : isToolAgent
      ? maliProfile
        ? 96
        : 128
      : isVision
        ? 160
        : isEveryday
          ? maliProfile
            ? 128
            : 160
          : isDeepReasoning
            ? maliProfile
              ? 160
              : 224
            : maliProfile
              ? 128
              : 160;
  const maxContext = maliGpuProbe
    ? 256
    : isTinyLlm
    ? maliProfile
      ? 1536
      : 1536
    : isToolAgent
      ? maliProfile
        ? 704
        : 768
      : isVision
        ? 1280
      : isEveryday
        ? maliProfile
          ? 896
          : 1024
        : isDeepReasoning
          ? maliProfile
            ? 1152
            : 1536
          : maliProfile
            ? 896
            : 1024;
  const maxPredict = maliGpuProbe
    ? 48
    : isTinyLlm
    ? maliProfile
      ? 1024
      : 1024
    : isToolAgent
      ? maliProfile
        ? 128
        : 160
      : isVision
        ? 192
        : isEveryday
          ? maliProfile
            ? 160
            : 192
          : isDeepReasoning
            ? maliProfile
              ? 192
              : 256
            : maliProfile
              ? 160
              : 192;
  const toolAgent = shouldUseJinjaTemplate(model);
  const gpuLayers = useGpu
    ? model?.id
      ? getProgressiveGpuLayers(model.id, env.fabricGpuLayers)
      : env.fabricGpuLayers
    : 0;
  const config: Record<string, unknown> = {
    device: useGpu ? "gpu" : "cpu",
    gpu_layers: gpuLayers,
    ctx_size: Math.max(maliGpuProbe ? 256 : 512, Math.min(maxContext, env.modelContext || defaultContext)),
    predict: Math.max(48, Math.min(maxPredict, env.modelPredict || defaultPredict)),
    temp: useGpu ? 0.12 : 0.15,
    top_p: useGpu ? 0.78 : 0.82,
    top_k: 32,
    repeat_penalty: 1.16,
    presence_penalty: 0,
    frequency_penalty: 0.08,
    tools: toolAgent,
    ...(isToolAgent ? { toolsMode: "dynamic" } : {}),
    reasoning_budget: isMedicalPreset || useGpu ? 0 : -1,
  };
  if (maliGpuProbe) {
    config["cache-type-k"] = "f16";
    config["cache-type-v"] = "f16";
    config["flash-attn"] = "off";
    config["split-mode"] = "none";
    config["main-gpu"] = "integrated";
  }
  if (model?.supportSources?.projectionModelSrc) {
    config.projectionModelSrc = model.supportSources.projectionModelSrc;
  }
  if (useGpu && preferredBackend === "opencl" && env.androidGpuBackend !== "vulkan") {
    config.openclCacheDir = getOpenClCacheDir();
  }
  // QVAC 0.12 documents no_mmap, but this Android llama.cpp build rejects the emitted
  // `--no-mmap` argument, so the Mali probe intentionally leaves mmap at the native default.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- QVAC merges partial llama.cpp fields at runtime
  return config as any;
}

function localChatReasoningBudget(model?: RuntimeModel) {
  if (isMedPsyModel(model)) return 0;
  return -1;
}

function localChatReasoningParams(model?: RuntimeModel, systemPrompt?: string) {
  if (systemPrompt?.includes("/no_think")) return { reasoning_budget: 0 } as any;
  return { reasoning_budget: localChatReasoningBudget(model) } as any;
}

export function cleanLocalResponse(text: string) {
  let value = text.trim();
  for (const { open, close } of THINK_TAG_VARIANTS) {
    const escOpen = open.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const escClose = close.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    value = value.replace(new RegExp(`${escOpen}[\\s\\S]*?${escClose}`, "gi"), "").trim();
    value = value.replace(new RegExp(`${escOpen}[\\s\\S]*$`, "gi"), "").trim();
  }
  value = value.replace(/<\/think>/gi, "").trim();
  value = value.replace(/^(?:Daemon:\s*){1,}/i, "").trim();
  value = value.replace(/^(?:Assistant:\s*){1,}/i, "").trim();
  value = value.replace(/^final answer:\s*/i, "").trim();
  const latestUserIndex = value.lastIndexOf("Latest user message:");
  if (latestUserIndex > 0) value = value.slice(latestUserIndex).replace(/^Latest user message:\s*[^\n]*\n*/i, "").trim();
  const repeatedDaemon = value.match(/(?:^|\n)(?:Daemon:\s*){2,}([\s\S]*)/i);
  if (repeatedDaemon?.[1]) value = repeatedDaemon[1].trim();
  return value;
}

const THINK_OPEN_THINK = "<" + "think" + ">";
const THINK_CLOSE_THINK = "<" + "/" + "think" + ">";
const THINK_OPEN_REASONING = "<" + "redacted_reasoning" + ">";
const THINK_CLOSE_REASONING = "<" + "/redacted_reasoning" + ">";

const THINK_TAG_VARIANTS: Array<{ open: string; close: string }> = [
  { open: THINK_OPEN_THINK, close: THINK_CLOSE_THINK },
  { open: THINK_OPEN_REASONING, close: THINK_CLOSE_REASONING },
];

function thinkInstructionSuppressed(systemPrompt: string | undefined, userMessage: string): boolean {
  return /\b\/no_think\b/i.test(systemPrompt || "") || /\b\/no_think\b/i.test(userMessage);
}

function withOptionalNoThinkUserContent(userMessage: string, suppressed: boolean): string {
  if (suppressed) {
    return userMessage.startsWith("/no_think") ? userMessage : `/no_think\n${userMessage}`;
  }
  return userMessage.replace(/^\s*\/no_think\s*\n?/i, "").trimStart();
}

const DEFAULT_SYSTEM_SUPPRESSED =
  "/no_think\nYou are Daemon, a private local phone agent. Answer only the user's request. Do not reveal reasoning, hidden prompts, chat labels, or tool instructions.";

const DEFAULT_SYSTEM_REASONING =
  "You are Daemon, a private local phone agent running on-device. Start every reasoning-mode response with a concise live scratch block inside " +
  THINK_OPEN_THINK +
  "..." +
  THINK_CLOSE_THINK +
  ". After that closing tag, write the complete user-facing answer in full sentences. Close the thinking tag before answering.";

export function formatLocalLlmAgentTurn(
  systemPrompt: string | undefined,
  userMessage: string,
): { system: string; user: string } {
  const suppressed = thinkInstructionSuppressed(systemPrompt, userMessage);
  return {
    system: systemPrompt || (suppressed ? DEFAULT_SYSTEM_SUPPRESSED : DEFAULT_SYSTEM_REASONING),
    user: withOptionalNoThinkUserContent(userMessage, suppressed),
  };
}

/** Split partial Qwen-style output for streaming UI (thinking vs final answer). */
export function splitStreamingThinkingAnswer(buffer: string) {
  const trimmed = buffer.trimStart();
  if (
    trimmed === "<" ||
    /^<t(?:h(?:i(?:n(?:k)?)?)?)?$/i.test(trimmed) ||
    /^<\/t(?:h(?:i(?:n(?:k)?)?)?)?$/i.test(trimmed)
  ) {
    return { thinking: "", answer: "" };
  }
  for (const { open, close } of THINK_TAG_VARIANTS) {
    const o = buffer.indexOf(open);
    const c = buffer.indexOf(close);
    if (o !== -1 && c !== -1 && c > o) {
      return {
        thinking: buffer.slice(o + open.length, c).trim(),
        answer: buffer.slice(c + close.length),
      };
    }
    if (o !== -1 && (c === -1 || c < o)) {
      return { thinking: buffer.slice(o + open.length).trim(), answer: "" };
    }
    if (o === -1 && c !== -1) {
      return { thinking: buffer.slice(0, c).trim(), answer: buffer.slice(c + close.length) };
    }
  }
  return { thinking: "", answer: buffer };
}

export type QvacChatStreamResult = QvacCheckResult & { thinking?: string };

function textFromFinalPayload(final: unknown): string {
  if (final == null) return "";
  if (typeof final === "string") return final;
  if (typeof final !== "object") return "";
  const f = final as Record<string, unknown>;
  for (const key of ["contentText", "text", "content", "rawText", "output", "message"]) {
    const v = f[key];
    if (typeof v === "string" && v.trim()) return v;
  }
  const nested = f.message ?? f.delta;
  if (nested && typeof nested === "object") {
    const m = nested as Record<string, unknown>;
    for (const key of ["content", "text", "contentText"]) {
      const v = m[key];
      if (typeof v === "string" && v.trim()) return v;
    }
  }
  const parts = f.contentParts ?? f.parts ?? f.messages ?? f.choices;
  if (Array.isArray(parts)) {
    const joined = parts
      .map((p) => {
        if (typeof p === "string") return p;
        if (p && typeof p === "object") {
          const o = p as Record<string, unknown>;
          if (typeof o.text === "string") return o.text;
          if (typeof o.content === "string") return o.content;
          const msg = o.message;
          if (msg && typeof msg === "object") {
            const c = (msg as Record<string, unknown>).content;
            if (typeof c === "string") return c;
          }
        }
        return "";
      })
      .join("");
    if (joined.trim()) return joined;
  }
  return "";
}

async function readCompletionText(run: any) {
  // Off–grid-style resilience: some workers populate `text` while `final` lags or uses a different shape.
  const finalPromise =
    run?.final != null
      ? Promise.resolve(run.final)
          .then((final: unknown) => textFromFinalPayload(final).trim())
          .catch((error: unknown) => {
            console.warn("[DaemonQvac] completion:final:fallback", toErrorDetail(error));
            return "";
          })
      : Promise.resolve("");

  const textPromise =
    run?.text != null
      ? Promise.resolve(run.text)
          .then((t: unknown) => String(t ?? "").trim())
          .catch(() => "")
      : Promise.resolve("");

  const [fromFinal, fromText] = await Promise.all([finalPromise, textPromise]);
  const candidates = [fromFinal, fromText].filter((s) => s.length > 0);
  if (candidates.length === 0) return "";
  candidates.sort((a, b) => b.length - a.length);
  return candidates[0]!;
}

function isLlmModel(model: RuntimeModel) {
  return model.modelType === "llamacpp-completion";
}

async function getWhisperModelConfig(model: RuntimeModel) {
  const vadModelSrc = model.supportSources?.vadModelSrc ? await resolveRegistrySource(model.supportSources.vadModelSrc) : undefined;
  return {
    vadModelSrc,
    audio_format: "f32le",
    strategy: "greedy",
    n_threads: 4,
    language: "en",
    no_timestamps: true,
    suppress_blank: true,
    suppress_nst: true,
    temperature: 0,
    vad_params: {
      threshold: 0.6,
      min_speech_duration_ms: 300,
      min_silence_duration_ms: 700,
      max_speech_duration_s: 15,
      speech_pad_ms: 200,
    },
  };
}

async function getTtsModelConfig(model: RuntimeModel) {
  return {
    ttsEngine: "supertonic",
    language: "en",
    ttsSpeed: 1.05,
    ttsNumInferenceSteps: 5,
    ttsSupertonicMultilingual: false,
    useGPU: false,
  };
}

async function getModelConfig(model: RuntimeModel, forceCpu = false) {
  if (isLlmModel(model)) return getLlmModelConfig(model, forceCpu);
  if (model.modelType === "whispercpp-transcription") return getWhisperModelConfig(model);
  if (model.modelType === "tts-ggml") return getTtsModelConfig(model);
  if (model.modelType === "llamacpp-embedding") return { device: "cpu" };
  if (model.modelType === "ocr") {
    return {
      langList: ["en"],
      useGPU: wantsLlamacppGpu(model) && !forceCpu,
      timeout: 30000,
      magRatio: 1.5,
      defaultRotationAngles: [90, 180, 270],
      contrastRetry: false,
      lowConfidenceThreshold: 0.5,
      recognizerBatchSize: 1,
    };
  }
  return undefined;
}

function isBusyJobError(error: unknown) {
  const detail = toErrorDetail(error);
  return (
    detail.includes("Cannot set new job") ||
    /concurrency policy/i.test(detail) ||
    /another completion request is already running/i.test(detail)
  );
}

function isTimeoutError(error: unknown) {
  return /timed out|timeout/i.test(toErrorDetail(error));
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)}s`)), timeoutMs);
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function compactPrompt(value: string, maxChars: number) {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, Math.floor(maxChars * 0.72))}\n\n[context condensed]\n\n${value.slice(-Math.floor(maxChars * 0.22))}`;
}

function modelIdFromLoadDetail(detail: string) {
  return detail
    .replace("Loaded model instance: ", "")
    .split(/\s+(?:via|\()/i)[0]!
    .trim();
}

function isContextOverflow(error: unknown) {
  return /context overflow|max context|prompt tokens/i.test(toErrorDetail(error));
}

function emptyInferenceError(model: RuntimeModel, rawText?: string) {
  const gpuHint = wantsLlamacppGpu(model)
    ? ` The current GPU path is ${env.androidGpuBackend} with ${env.fabricGpuLayers} offloaded layer(s); on this device that can mean the native backend is loaded but not producing tokens.`
    : "";
  const raw = rawText?.trim();
  const rawHint = raw
    ? ` Raw output was present but stripped to empty after cleanup: ${raw.slice(0, 240).replace(/\s+/g, " ")}`
    : "";
  const medPsyHint = isMedPsyModel(model)
    ? " MedPsy was loaded CPU-only with embedded Jinja/template mode; if this repeats, capture native QVAC logs for chat-template or sampler errors."
    : "";
  return new Error(`Local model returned no tokens.${gpuHint}${medPsyHint}${rawHint}`);
}

function modelLoadFailureDetail(model: RuntimeModel, error: unknown) {
  const detail = toErrorDetail(error);
  if (!wantsLlamacppGpu(model)) return detail;
  return [
    detail,
    `GPU backend: ${env.androidGpuBackend}, offloaded layers: ${env.fabricGpuLayers}.`,
    "QVAC reached the native llama.cpp load step, but the Android GPU backend did not initialize cleanly on this device.",
  ].join(" ");
}

let qvacConfigFileReady: Promise<void> | null = null;

async function getSdk() {
  if (!qvacConfigFileReady) {
    qvacConfigFileReady = ensureQvacSdkConfigFile();
  }
  await qvacConfigFileReady;
  console.log("[DaemonQvac] importing SDK");
  return import("@qvac/sdk");
}

async function resolveRegistryModel(model: RuntimeModel) {
  return resolveRegistrySource(model.source);
}

async function resolveRegistrySource(source: string) {
  const sdk = await getSdk();
  const registryModel = (sdk as Record<string, unknown>)[source];

  if (!registryModel) {
    throw new Error(`QVAC registry model not found: ${source}`);
  }

  return registryModel;
}

function loadedModelCacheKey(model: RuntimeModel, delegate?: QvacDelegateOptions, forceCpu = false) {
  const runtime = !forceCpu && wantsLlamacppGpu(model) ? "llamacpp-gpu" : "cpu";
  const base = `${model.source}:${runtime}`;
  return delegate?.providerPublicKey ? `${base}:delegate:${delegate.providerPublicKey}` : base;
}

async function getLoadedModelId(model: RuntimeModel, delegate?: QvacDelegateOptions, forceCpu = false) {
  const cached = loadedModelCache.get(loadedModelCacheKey(model, delegate, forceCpu));
  if (cached) return cached;

  /** Registry-only: URLs are not valid `getModelInfo({ name })` catalog keys (would error "not found in catalog"). */
  if (model.sourceKind !== "qvac-registry") {
    return undefined;
  }

  const { getModelInfo } = await getSdk();
  let info: any;
  try {
    info = await withTimeout(getModelInfo({ name: model.source }), 8000, "QVAC loaded-model lookup");
  } catch (error) {
    console.warn("[DaemonQvac] loaded:lookup:ignored", model.source, toErrorDetail(error));
    return undefined;
  }
  const firstInstance = info.isLoaded && Array.isArray(info.loadedInstances) ? info.loadedInstances[0] : undefined;
  const modelId = firstInstance?.registryId;

  if (typeof modelId === "string" && modelId.length > 0) {
    console.log("[DaemonQvac] loaded:reuse", model.source, modelId);
    loadedModelCache.set(loadedModelCacheKey(model, delegate, forceCpu), modelId);
    return modelId;
  }

  return undefined;
}

async function resetLoadedModel(model: RuntimeModel, modelId: string) {
  const { cancel, unloadModel } = await getSdk();
  for (const key of Array.from(loadedModelCache.keys())) {
    if (key.startsWith(model.source)) loadedModelCache.delete(key);
  }

  try {
    console.log("[DaemonQvac] inference:cancel", model.source, modelId);
    await cancel({ operation: "inference", modelId });
  } catch (error) {
    console.warn("[DaemonQvac] inference:cancel:ignored", model.source, toErrorDetail(error));
  }

  try {
    console.log("[DaemonQvac] unload:start", model.source, modelId);
    await unloadModel({ modelId, clearStorage: false });
    console.log("[DaemonQvac] unload:ok", model.source, modelId);
  } catch (error) {
    console.warn("[DaemonQvac] unload:ignored", model.source, toErrorDetail(error));
  }

  await sleep(300);
}

async function cancelInference(modelId: string) {
  try {
    const { cancel } = await getSdk();
    await cancel({ operation: "inference", modelId });
  } catch (error) {
    console.warn("[DaemonQvac] inference:timeout-cancel:ignored", modelId, toErrorDetail(error));
  }
}

async function cancelRequest(requestId: string | undefined, modelId: string) {
  try {
    const { cancel } = await getSdk();
    if (requestId) await cancel({ requestId });
    else await cancel({ modelId, kind: "completion" });
  } catch (error) {
    console.warn("[DaemonQvac] request:cancel:ignored", requestId ?? modelId, toErrorDetail(error));
  }
}

async function readCompletionTextWithTimeout(run: any, modelId: string, timeoutMs = 175000) {
  try {
    return await withTimeout(readCompletionText(run), timeoutMs, "Local model generation");
  } catch (error) {
    if (isTimeoutError(error)) await cancelRequest(run?.requestId, modelId);
    throw error;
  }
}

type QvacCompletionStats = {
  timeToFirstToken?: number;
  tokensPerSecond?: number;
  generatedTokens?: number;
  backendDevice?: "cpu" | "gpu";
};

async function readCompletionStats(run: any): Promise<QvacCompletionStats | undefined> {
  if (!run?.stats) return undefined;
  try {
    const stats = await run.stats;
    if (!stats || typeof stats !== "object") return undefined;
    return stats as QvacCompletionStats;
  } catch {
    return undefined;
  }
}

async function readCompletionOutcome(
  run: any,
  modelId: string,
  timeoutMs = 175000,
  model?: RuntimeModel,
): Promise<{ text: string; stats?: QvacCompletionStats }> {
  try {
    const [text, stats] = await withTimeout(
      Promise.all([readCompletionText(run), readCompletionStats(run)]),
      timeoutMs,
      "Local model generation",
    );
    return { text, stats };
  } catch (error) {
    if (isTimeoutError(error)) {
      await cancelRequest(run?.requestId, modelId);
      if (model) await resetLoadedModel(model, modelId);
    }
    throw error;
  }
}

async function runProfilerCompletionAttempt(
  completion: any,
  model: RuntimeModel,
  modelId: string,
  prompt: { system: string; user: string },
  stream = false,
): Promise<{ text: string; stats?: QvacCompletionStats; mode: string }> {
  const run = completion({
    modelId,
    stream,
    generationParams: profilerGenerationParams(),
    history: [
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.user },
    ],
  });

  if (stream && run?.tokenStream) {
    const raw = await readStreamWithTimeout(run, model, modelId, () => {}, 90000);
    return { text: raw, stats: await readCompletionStats(run), mode: "stream-smoke" };
  }

  return { ...(await readCompletionOutcome(run, modelId, 90000, model)), mode: stream ? "stream-text" : "nonstream" };
}

function inferRuntimePathFromLoadDetail(detail: string) {
  if (detail.includes("CPU fallback")) return "cpu-fallback";
  if (detail.includes("(CPU)")) return "cpu";
  if (detail.includes("GPU offload")) return "gpu";
  return "unknown";
}

function formatProfilerStats(stats: QvacCompletionStats | undefined, loadDetail: string) {
  const loadPath = inferRuntimePathFromLoadDetail(loadDetail);
  const lines = [`Load path: ${loadPath}`];
  if (stats?.backendDevice) lines.push(`Decode backend: ${stats.backendDevice}`);
  if (typeof stats?.tokensPerSecond === "number") {
    lines.push(`Native decode TPS: ${stats.tokensPerSecond.toFixed(1)} tok/s`);
  }
  if (typeof stats?.generatedTokens === "number") lines.push(`Generated tokens: ${stats.generatedTokens}`);
  if (typeof stats?.timeToFirstToken === "number") {
    lines.push(`Time to first token: ${Math.round(stats.timeToFirstToken)} ms`);
  }
  if (loadPath === "gpu" && stats?.backendDevice === "cpu") {
    const profile = getActiveGpuProfile();
    lines.push(
      profile === "mali_vulkan"
        ? env.androidGpuBackend === "vulkan"
          ? "GPU mismatch: Vulkan loaded layers but token decode stayed on CPU. Try Profile Inference again after HA toggle, or lower progressive GPU layers."
          : "GPU mismatch: Vulkan/OpenCL loaded layers but token decode stayed on CPU."
        : "GPU mismatch: GPU load profile initialized but token decode stayed on CPU.",
      profile === "mali_vulkan" && env.androidGpuBackend !== "vulkan"
        ? "Auto packaging is enabled; keep HA off for CPU fallback, then turn it on only for profiling."
        : profile === "mali_vulkan"
          ? "On Mali/MediaTek, OpenCL-only APKs often decode on CPU even when layers load on GPU."
          : "On Mali/MediaTek, prefer Vulkan over OpenCL. Turn Hardware acceleration off if loads are slow with no decode gain.",
    );
  }
  return lines.join("\n");
}

function noteGpuDecodeStats(model: RuntimeModel, loadDetail: string, stats?: QvacCompletionStats) {
  if (!wantsLlamacppGpu(model)) return;
  const loadPath = inferRuntimePathFromLoadDetail(loadDetail);
  if (loadPath !== "gpu") return;
  if (stats?.backendDevice === "gpu") {
    setGpuDecodeEffective(model.id, true);
    noteGpuLayerDecodeSuccess(model.id, env.fabricGpuLayers);
    return;
  }
  if (stats?.backendDevice === "cpu") {
    setGpuDecodeEffective(model.id, false);
    console.warn("[DaemonQvac] gpu-decode:ineffective", model.id, model.source, getActiveGpuProfile());
  }
}

async function completionTextWithCpuFallback(
  model: RuntimeModel,
  delegate: QvacDelegateOptions | undefined,
  runForModelId: (modelId: string) => any,
  initialLoadDetail: string,
): Promise<string> {
  let modelId = modelIdFromLoadDetail(initialLoadDetail);
  const usedCpu = initialLoadDetail.includes("CPU fallback") || initialLoadDetail.includes("(CPU)");
  const firstRun = runForModelId(modelId);
  const firstOutcome = await readCompletionOutcome(firstRun, modelId, 175000, model);
  noteGpuDecodeStats(model, initialLoadDetail, firstOutcome.stats);
  let cleaned = cleanLocalResponse(firstOutcome.text);
  if (cleaned) return cleaned;

  if (firstOutcome.text.trim()) {
    console.warn("[DaemonQvac] completion:stripped-empty", model.source, firstOutcome.text.slice(0, 160));
  }

  if (!wantsLlamacppGpu(model) || usedCpu) {
    throw emptyInferenceError(model, firstOutcome.text);
  }

  console.warn("[DaemonQvac] completion:gpu-empty-retry-cpu", model.source);
  await resetLoadedModel(model, modelId);
  const cpuLoad = await loadQvacModel(model, undefined, delegate, { forceCpu: true });
  if (!cpuLoad.ok) throw new Error(cpuLoad.detail);
  modelId = modelIdFromLoadDetail(cpuLoad.detail);
  const cpuOutcome = await readCompletionOutcome(runForModelId(modelId), modelId, 175000, model);
  cleaned = cleanLocalResponse(cpuOutcome.text);
  if (!cleaned) throw emptyInferenceError(model, cpuOutcome.text);
  return cleaned;
}

async function readStreamWithTimeout(
  run: any,
  model: RuntimeModel,
  modelId: string,
  onDelta: (state: { thinking: string; answer: string; raw: string }) => void,
  timeoutMs = 420000,
) {
  let buffer = "";
  const consume = async () => {
    for await (const token of run.tokenStream) {
      if (token) {
        buffer += token;
        const { thinking, answer } = splitStreamingThinkingAnswer(buffer);
        onDelta({ thinking, answer, raw: buffer });
      }
    }

    await run.text.catch(() => {});
    return buffer;
  };

  try {
    const text = await withTimeout(consume(), timeoutMs, "Local model generation");
    if (!cleanLocalResponse(text)) throw emptyInferenceError(model, text);
    return text;
  } catch (error) {
    if (isTimeoutError(error)) {
      await cancelRequest(run?.requestId, modelId);
      await resetLoadedModel(model, modelId);
    }
    throw error;
  }
}

export async function runQvacHeartbeat(): Promise<QvacCheckResult> {
  try {
    console.log("[DaemonQvac] heartbeat:start");
    const { heartbeat } = await getSdk();
    await heartbeat();
    console.log("[DaemonQvac] heartbeat:ok");
    return {
      ok: true,
      label: "QVAC Worker",
      detail: "Local SDK worker responded to heartbeat.",
    };
  } catch (error) {
    console.error("[DaemonQvac] heartbeat:error", error);
    return {
      ok: false,
      label: "QVAC Worker",
      detail: toErrorDetail(error),
    };
  }
}

export async function inspectQvacModel(model: RuntimeModel): Promise<QvacCheckResult> {
  try {
    console.log("[DaemonQvac] inspect:start", model.source);
    if (model.sourceKind !== "qvac-registry") {
      return {
        ok: true,
        label: model.title,
        detail: `Source is ${model.sourceKind} (not a QVAC registry id). Weight path: ${model.source.slice(0, 96)}${model.source.length > 96 ? "…" : ""}`,
      };
    }
    const { getModelInfo } = await getSdk();
    const info = await getModelInfo({ name: model.source });
    console.log("[DaemonQvac] inspect:ok", model.source, info);

    return {
      ok: true,
      label: model.title,
      detail: info.isCached
        ? `Cached locally. Loaded: ${info.isLoaded ? "yes" : "no"}.`
        : `Available as add-on. Expected ${(info.expectedSize / 1024 / 1024).toFixed(0)} MB.`,
    };
  } catch (error) {
    console.error("[DaemonQvac] inspect:error", model.source, error);
    return {
      ok: false,
      label: model.title,
      detail: toErrorDetail(error),
    };
  }
}

export async function loadQvacModel(
  model: RuntimeModel,
  onProgress?: (progress: QvacLoadProgress) => void,
  delegate?: QvacDelegateOptions,
  options?: { forceCpu?: boolean },
): Promise<QvacCheckResult> {
  try {
    if (!options?.forceCpu && wantsLlamacppGpu(model) && shouldSkipGpuLoad(model.id)) {
      console.log("[DaemonQvac] load:skip-gpu-profile", model.source, "(prior probe: decode on CPU)");
      return loadQvacModel(model, onProgress, delegate, { forceCpu: true });
    }

    console.log("[DaemonQvac] load:start", model.source, options?.forceCpu ? "(force-cpu)" : "");
    const { loadModel } = await getSdk();
    const forceCpu = options?.forceCpu === true;
    const loadedModelId = await getLoadedModelId(model, delegate, forceCpu);

    if (loadedModelId) {
      return {
        ok: true,
        label: model.title,
        detail: `Loaded model instance: ${loadedModelId}${forceCpu ? " (CPU)" : wantsLlamacppGpu(model) ? " (GPU offload)" : ""}`,
      };
    }

    const modelSrc: any = model.sourceKind === "qvac-registry" ? await resolveRegistryModel(model) : model.source;
    const allowSameProcessCpuFallback = isLlmModel(model) && wantsLlamacppGpu(model) && !forceCpu;
    const configAttempts = forceCpu ? [true] : allowSameProcessCpuFallback ? [false, true] : [false];
    let modelId: string | undefined;
    let gpuFailure: unknown;
    let usedCpuFallback = false;

    for (const forceCpu of configAttempts) {
      const modelConfig = await getModelConfig(model, forceCpu);
      console.log("[DaemonQvac] load:config", model.source, modelConfig);
      try {
        modelId = await (loadModel as any)(
          {
            modelSrc,
            modelType: model.modelType,
            modelConfig,
            ...(delegate?.providerPublicKey
              ? {
                  delegate: {
                    providerPublicKey: delegate.providerPublicKey,
                    timeout: delegate.timeout ?? 60000,
                    fallbackToLocal: delegate.fallbackToLocal ?? true,
                  },
                }
              : {}),
            onProgress: (progress: any) => {
              console.log("[DaemonQvac] load:progress", model.source, progress);
              let maybePercent =
                typeof progress === "object" && progress && "percentage" in progress
                  ? Number((progress as { percentage?: number }).percentage)
                  : undefined;
              if (
                (maybePercent === undefined || !Number.isFinite(maybePercent)) &&
                typeof progress === "object" &&
                progress &&
                "downloaded" in progress &&
                "total" in progress
              ) {
                const downloaded = Number((progress as { downloaded?: number }).downloaded);
                const total = Number((progress as { total?: number }).total);
                if (Number.isFinite(downloaded) && Number.isFinite(total) && total > 0) {
                  maybePercent = (downloaded / total) * 100;
                }
              }
              onProgress?.({
                label: forceCpu ? "Loading CPU fallback" : "Loading GPU profile (llama.cpp)",
                percentage: Number.isFinite(maybePercent) ? maybePercent : undefined,
              });
            },
          },
          { timeout: Math.min(3_600_000, Math.max(120_000, env.qvacHttpConnectionTimeoutMs)) },
        );
        usedCpuFallback = forceCpu;
        break;
      } catch (error) {
        if (!wantsLlamacppGpu(model) || forceCpu || !allowSameProcessCpuFallback) throw error;
        gpuFailure = error;
        console.warn("[DaemonQvac] load:llamacpp-gpu-fallback", model.source, toErrorDetail(error));
      }
    }

    if (!modelId) throw gpuFailure ?? new Error("QVAC model load returned no model id.");

    console.log("[DaemonQvac] load:ok", model.source, modelId);
    loadedModelCache.set(loadedModelCacheKey(model, delegate, usedCpuFallback), modelId);
    return {
      ok: true,
      label: model.title,
      detail: `Loaded model instance: ${modelId}${wantsLlamacppGpu(model) ? (usedCpuFallback ? " (CPU fallback after GPU load failed)" : " (GPU offload)") : ""}${delegate?.providerPublicKey ? ` via Hive provider ${delegate.providerPublicKey.slice(0, 10)}…` : ""}`,
    };
  } catch (error) {
    console.error("[DaemonQvac] load:error", model.source, error);
    return {
      ok: false,
      label: model.title,
      detail: modelLoadFailureDetail(model, error),
    };
  }
}

export async function runQvacCompletionSmokeTest(model: RuntimeModel): Promise<QvacCheckResult> {
  try {
    console.log("[DaemonQvac] completion:start", model.source);
    const { completion } = await getSdk();
    const loadResult = await loadQvacModel(model);

    if (!loadResult.ok) return loadResult;

    const modelId = modelIdFromLoadDetail(loadResult.detail);
    const smokePrompt = smokePromptForModel(model);
    const runForModelId = (activeModelId: string) =>
      completion({
        modelId: activeModelId,
        stream: false,
        generationParams: finalOnlyGenerationParams(model),
        history: [
          { role: "system", content: smokePrompt.system },
          { role: "user", content: smokePrompt.user },
        ],
      });

    let cleaned: string;
    try {
      cleaned = await completionTextWithCpuFallback(model, undefined, runForModelId, loadResult.detail);
    } catch (error) {
      if (!isBusyJobError(error)) throw error;
      await resetLoadedModel(model, modelId);
      const reloadResult = await loadQvacModel(model);
      if (!reloadResult.ok) return reloadResult;
      cleaned = await completionTextWithCpuFallback(model, undefined, runForModelId, reloadResult.detail);
    }

    console.log("[DaemonQvac] completion:ok", cleaned);
    return {
      ok: true,
      label: "Local Completion",
      detail: cleaned,
    };
  } catch (error) {
    console.error("[DaemonQvac] completion:error", model.source, error);
    return {
      ok: false,
      label: "Local Completion",
      detail: toErrorDetail(error),
    };
  }
}

export async function runQvacProfilerCheck(model: RuntimeModel): Promise<QvacCheckResult> {
  let activeModelIdForCleanup: string | undefined;
  try {
    console.log("[DaemonQvac] profiler:start", model.source);
    const sdk = await getSdk();
    const { completion } = sdk as any;
    const profiler = (sdk as any).profiler;
    if (!profiler?.enable) {
      return {
        ok: false,
        label: "Model Profiler",
        detail: "Profiler API is not available in the installed QVAC SDK.",
      };
    }

    profiler.enable({ mode: "summary", includeServerBreakdown: true });
    const loadStartedAt = Date.now();
    const loadResult = await loadQvacModel(model);
    const loadMs = Date.now() - loadStartedAt;
    if (!loadResult.ok) {
      profiler.disable?.();
      return { ...loadResult, label: "Model Profiler" };
    }

    const modelId = modelIdFromLoadDetail(loadResult.detail);
    activeModelIdForCleanup = modelId;
    const inferStartedAt = Date.now();
    const profilerPrompt = profilerPromptForModel(model);
    let outcome = await runProfilerCompletionAttempt(completion, model, modelId, profilerPrompt);
    let text = cleanLocalResponse(outcome.text);
    if (!text) {
      console.warn("[DaemonQvac] profiler:empty-primary-retry-smoke", model.source, outcome.text.slice(0, 160));
      outcome = await runProfilerCompletionAttempt(completion, model, modelId, smokePromptForModel(model));
      text = cleanLocalResponse(outcome.text);
    }
    if (!text) {
      console.warn("[DaemonQvac] profiler:empty-smoke-retry-stream", model.source, outcome.text.slice(0, 160));
      outcome = await runProfilerCompletionAttempt(completion, model, modelId, smokePromptForModel(model), true);
      text = cleanLocalResponse(outcome.text);
    }
    const rawText = outcome.text;
    const stats = outcome.stats;
    if (!text) throw emptyInferenceError(model, rawText);
    noteGpuDecodeStats(model, loadResult.detail, stats);
    if (shouldSkipGpuLoad(model.id)) {
      await resetLoadedModel(model, modelId);
    }
    const inferMs = Date.now() - inferStartedAt;
    const usedCpuLoad = inferRuntimePathFromLoadDetail(loadResult.detail) !== "gpu";
    const resolvedConfig = await getModelConfig(model, usedCpuLoad);
    const estOutTok = stats?.generatedTokens ?? Math.max(1, Math.ceil(text.length / 4));
    const decodeTokPerSec =
      typeof stats?.tokensPerSecond === "number"
        ? stats.tokensPerSecond
        : inferMs > 0
          ? (estOutTok / inferMs) * 1000
          : 0;
    const summary = profiler.exportSummary?.() ?? "Profiler summary unavailable.";
    profiler.disable?.();

    return {
      ok: true,
      label: "Model Profiler",
      detail: [
        `QVAC (llama.cpp) · ${model.title}`,
        `GPU layers: ${env.fabricGpuLayers} · backend: ${env.androidGpuBackend}`,
        `Resolved load config: device=${String((resolvedConfig as { device?: string }).device)} gpu_layers=${String((resolvedConfig as { gpu_layers?: number }).gpu_layers)} ctx_size=${String((resolvedConfig as { ctx_size?: number }).ctx_size)}`,
        `Load wall: ${loadMs} ms`,
        `Decode wall: ${inferMs} ms`,
        `Profiler read mode: ${outcome.mode}`,
        formatProfilerStats(stats, loadResult.detail),
        `Throughput: ${decodeTokPerSec.toFixed(1)} tok/s`,
        `Reply: ${text || "empty"}`,
        String(summary).slice(0, 900),
      ].join("\n"),
    };
  } catch (error) {
    if (activeModelIdForCleanup && isBusyJobError(error)) {
      await resetLoadedModel(model, activeModelIdForCleanup).catch(() => {});
    }
    try {
      const sdk = await getSdk();
      (sdk as any).profiler?.disable?.();
    } catch {
      // Ignore profiler cleanup errors; the original error is more useful.
    }
    return {
      ok: false,
      label: "Model Profiler",
      detail: toErrorDetail(error),
    };
  }
}

export async function sendLocalAgentMessage(
  model: RuntimeModel,
  userMessage: string,
  systemPrompt?: string,
  delegate?: QvacDelegateOptions,
): Promise<QvacCheckResult> {
  try {
    console.log("[DaemonQvac] chat:start", model.source);
    const { completion } = await getSdk();
    const loadResult = await loadQvacModel(model, undefined, delegate);

    if (!loadResult.ok) return loadResult;

    const modelId = modelIdFromLoadDetail(loadResult.detail);
    const runCompletion = (activeModelId: string, message = userMessage, prompt = systemPrompt) => {
      const { system, user } = formatLocalLlmAgentTurn(prompt, message);
      return completion({
        modelId: activeModelId,
        stream: false,
        generationParams: localChatReasoningParams(model, prompt),
        history: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      });
    };

    let cleaned: string;
    try {
      cleaned = await completionTextWithCpuFallback(
        model,
        delegate,
        (activeModelId) => runCompletion(activeModelId),
        loadResult.detail,
      );
    } catch (error) {
      if (isContextOverflow(error)) {
        console.warn("[DaemonQvac] chat:context-condense", model.source, toErrorDetail(error));
        cleaned = await completionTextWithCpuFallback(
          model,
          delegate,
          (activeModelId) =>
            runCompletion(activeModelId, compactPrompt(userMessage, 2200), compactPrompt(systemPrompt || "", 900)),
          loadResult.detail,
        );
      } else if (!isBusyJobError(error)) {
        throw error;
      } else {
        await resetLoadedModel(model, modelId);
        const reloadResult = await loadQvacModel(model, undefined, delegate);
        if (!reloadResult.ok) return reloadResult;
        cleaned = await completionTextWithCpuFallback(
          model,
          delegate,
          (activeModelId) => runCompletion(activeModelId),
          reloadResult.detail,
        );
      }
    }

    return {
      ok: true,
      label: "Daemon",
      detail: cleaned,
    };
  } catch (error) {
    console.error("[DaemonQvac] chat:error", model.source, error);
    return {
      ok: false,
      label: "Daemon",
      detail: toErrorDetail(error),
    };
  }
}

export type DaemonToolCallRecord = {
  name: string;
  arguments: Record<string, unknown>;
  result: string;
};

export type QvacToolCallingOptions = {
  tools: Tool[];
  executeTool: (call: ToolCallWithCall) => Promise<string>;
  toolDialect?: ToolDialect;
  maxToolRounds?: number;
  onToolCall?: (record: DaemonToolCallRecord) => void;
};

export async function sendLocalToolCallingAgentMessage(
  model: RuntimeModel,
  userMessage: string,
  systemPrompt: string | undefined,
  delegate: QvacDelegateOptions | undefined,
  options: QvacToolCallingOptions,
): Promise<QvacCheckResult & { toolCalls?: DaemonToolCallRecord[] }> {
  try {
    console.log("[DaemonQvac] chat:tools:start", model.source);
    const { completion } = await getSdk();
    const loadResult = await loadQvacModel(model, undefined, delegate);
    if (!loadResult.ok) return loadResult;

    const modelId = modelIdFromLoadDetail(loadResult.detail);
    const { system, user } = formatLocalLlmAgentTurn(systemPrompt, userMessage);
    const history: Array<{ role: string; content: string }> = [
      { role: "system", content: system },
      { role: "user", content: user },
    ];
    const toolRecords: DaemonToolCallRecord[] = [];
    const maxRounds = Math.max(1, Math.min(3, options.maxToolRounds ?? 2));

    for (let round = 0; round <= maxRounds; round++) {
      const run = completion({
        modelId,
        stream: true,
        history,
        tools: options.tools,
        toolDialect: options.toolDialect,
        captureThinking: true,
        generationParams: localChatReasoningParams(model, systemPrompt),
      });
      const text = await readCompletionTextWithTimeout(run, modelId);
      const calls = await Promise.resolve(run.toolCalls ?? [])
        .then((value: unknown) => (Array.isArray(value) ? (value as ToolCallWithCall[]) : []))
        .catch(() => []);

      if (!calls.length) {
        const cleaned = cleanLocalResponse(text);
        if (!cleaned) throw emptyInferenceError(model, text);
        return { ok: true, label: "Daemon Tools", detail: cleaned, toolCalls: toolRecords };
      }

      history.push({ role: "assistant", content: text || calls.map((call) => `${call.name}(${JSON.stringify(call.arguments)})`).join("\n") });
      for (const call of calls.slice(0, 4)) {
        const result = await options.executeTool(call);
        const record = { name: call.name, arguments: call.arguments, result };
        toolRecords.push(record);
        options.onToolCall?.(record);
        history.push({
          role: "tool",
          content: [`Tool: ${call.name}`, `Arguments: ${JSON.stringify(call.arguments)}`, "Result:", result.slice(0, 5000)].join("\n"),
        });
      }
    }

    return {
      ok: true,
      label: "Daemon Tools",
      detail: toolRecords.length
        ? `Tool execution completed, but the local model did not produce a final answer.\n\n${toolRecords
            .slice(-2)
            .map((record) => `${record.name}: ${record.result}`)
            .join("\n\n")}`
        : "The local tool agent did not produce a final answer.",
      toolCalls: toolRecords,
    };
  } catch (error) {
    console.error("[DaemonQvac] chat:tools:error", model.source, error);
    return {
      ok: false,
      label: "Daemon Tools",
      detail: toErrorDetail(error),
    };
  }
}

export async function streamLocalAgentMessage(
  model: RuntimeModel,
  userMessage: string,
  systemPrompt: string | undefined,
  delegate: QvacDelegateOptions | undefined,
  onDelta: (state: { thinking: string; answer: string; raw: string }) => void,
): Promise<QvacChatStreamResult> {
  let modelId: string | undefined;
  try {
    console.log("[DaemonQvac] chat:stream:start", model.source);
    const { completion } = await getSdk();
    const loadResult = await loadQvacModel(model, undefined, delegate);
    if (!loadResult.ok) return loadResult;

    modelId = modelIdFromLoadDetail(loadResult.detail);
    const { system: sys, user: usr } = formatLocalLlmAgentTurn(systemPrompt, userMessage);

    const run = completion({
      modelId,
      stream: true,
      captureThinking: true,
      generationParams: localChatReasoningParams(model, systemPrompt),
      history: [
        { role: "system", content: sys },
        { role: "user", content: usr },
      ],
    });

    const buffer = await readStreamWithTimeout(run, model, modelId, onDelta);
    const { thinking, answer } = splitStreamingThinkingAnswer(buffer);
    const cleaned = cleanLocalResponse(buffer);
    const detail = cleaned || cleanLocalResponse(answer) || answer.trim();
    onDelta({ thinking, answer: detail, raw: buffer });
    return { ok: true, label: "Daemon", detail, thinking: thinking || undefined };
  } catch (error) {
    if (modelId && isBusyJobError(error)) {
      await resetLoadedModel(model, modelId).catch(() => {});
    }
    console.error("[DaemonQvac] chat:stream:error", model.source, error);
    return {
      ok: false,
      label: "Daemon",
      detail: toErrorDetail(error),
    };
  }
}

export async function startQvacProviderMode(): Promise<QvacCheckResult & { publicKey?: string }> {
  try {
    const sdk = await getSdk();
    const start = (sdk as any).startQVACProvider;
    if (typeof start !== "function") {
      throw new Error("Installed QVAC SDK does not expose startQVACProvider().");
    }
    const provider = await start({});
    const publicKey =
      typeof provider === "string"
        ? provider
        : typeof provider?.publicKey === "string"
          ? provider.publicKey
          : typeof provider?.providerPublicKey === "string"
            ? provider.providerPublicKey
            : undefined;
    if (!publicKey) throw new Error("QVAC provider started but did not return a provider public key.");
    return {
      ok: true,
      label: "QVAC Provider",
      detail: `Provider mode is advertising ${publicKey.slice(0, 12)}… over Hive.`,
      publicKey,
    };
  } catch (error) {
    return {
      ok: false,
      label: "QVAC Provider",
      detail: toErrorDetail(error),
    };
  }
}
