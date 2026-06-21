import type { RuntimeModel } from "./modelManifest";
import { runtimeModels } from "./modelManifest";
import type { QvacDelegateOptions, QvacCheckResult } from "./qvacClient";
import { cleanLocalResponse, formatLocalLlmAgentTurn, loadQvacModel } from "./qvacClient";

export type RealtimeVoiceLoop = {
  asrModelId: string;
  ttsModelId: string;
  llmModelId: string;
  writePcmFloat32: (chunk: Uint8Array) => void;
  stop: () => Promise<void>;
};

export type VoiceLoopCallbacks = {
  onVad?: (speaking: boolean, probability: number) => void;
  onTranscript?: (text: string) => void;
  onReply?: (text: string) => void;
  onSpeechPcm?: (samples: number[], sampleRate: number) => void;
  onError?: (error: string) => void;
};

const SUPERTONIC_SAMPLE_RATE = 44100;
const MIN_UTTERANCE_CHARS = 3;

function voiceModel(kind: "asr" | "tts") {
  const id = kind === "asr" ? "whisper-tiny" : "supertonic-tts-en";
  const model = runtimeModels.find((candidate) => candidate.id === id);
  if (!model) throw new Error(`Missing QVAC voice model manifest entry: ${id}`);
  return model;
}

function modelIdFromLoadDetail(detail: string) {
  return detail
    .replace("Loaded model instance: ", "")
    .split(/\s+(?:via|\()/i)[0]!
    .trim();
}

function fileUriToPath(uri: string) {
  return uri.replace(/^file:\/\//, "");
}

function isMeaningfulTranscript(text: string) {
  const trimmed = text.trim();
  if (!trimmed || trimmed.includes("[No speech detected]")) return false;
  if (/^\[[^\]]+\]$/.test(trimmed)) return false;
  return trimmed.replace(/[^\p{L}\p{N}]/gu, "").length >= MIN_UTTERANCE_CHARS;
}

async function loadVoiceModel(model: RuntimeModel) {
  const result = await loadQvacModel(model);
  if (!result.ok) throw new Error(result.detail);
  return modelIdFromLoadDetail(result.detail);
}

async function generateVoiceReply(params: {
  llmModelId: string;
  ttsModelId?: string;
  transcript: string;
  systemPrompt?: string;
  callbacks?: VoiceLoopCallbacks;
}) {
  const { completion, textToSpeech } = await import("@qvac/sdk");
  const { system, user } = formatLocalLlmAgentTurn(
    [
      params.systemPrompt,
      "Voice mode: answer in one or two speakable sentences. Avoid markdown, tables, hidden reasoning, and code blocks.",
    ]
      .filter(Boolean)
      .join("\n"),
    params.transcript,
  );
  const run = completion({
    modelId: params.llmModelId,
    stream: true,
    history: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    generationParams: { reasoning_budget: 0 },
  });

  let buffer = "";
  for await (const token of run.tokenStream) {
    buffer += token;
  }
  const reply = cleanLocalResponse(buffer);
  params.callbacks?.onReply?.(reply);

  if (params.ttsModelId && reply) {
    const tts = textToSpeech({
      modelId: params.ttsModelId,
      text: reply,
      inputType: "text",
      stream: false,
    });
    const samples = await tts.buffer;
    params.callbacks?.onSpeechPcm?.(samples, SUPERTONIC_SAMPLE_RATE);
  }

  return reply;
}

export async function runQvacVoiceFileTurn(params: {
  agentModel: RuntimeModel;
  audioUri: string;
  systemPrompt?: string;
  delegate?: QvacDelegateOptions;
}): Promise<QvacCheckResult> {
  try {
    const asrModel = voiceModel("asr");
    const ttsModel = voiceModel("tts");
    const [asrModelId, llmLoad, ttsModelId] = await Promise.all([
      loadVoiceModel(asrModel),
      loadQvacModel(params.agentModel, undefined, params.delegate),
      loadVoiceModel(ttsModel),
    ]);
    if (!llmLoad.ok) return llmLoad;

    const { transcribe } = await import("@qvac/sdk");
    const transcript = await transcribe({
      modelId: asrModelId,
      audioChunk: fileUriToPath(params.audioUri),
      prompt: "A short spoken command to a private phone agent.",
    });
    if (!isMeaningfulTranscript(transcript)) {
      return { ok: false, label: "QVAC Voice", detail: "No meaningful speech was detected in the selected audio." };
    }

    const reply = await generateVoiceReply({
      llmModelId: modelIdFromLoadDetail(llmLoad.detail),
      ttsModelId,
      transcript,
      systemPrompt: params.systemPrompt,
    });
    return {
      ok: true,
      label: "QVAC Voice",
      detail: [`Transcript: ${transcript.trim()}`, "", `Daemon: ${reply}`].join("\n"),
    };
  } catch (error) {
    return { ok: false, label: "QVAC Voice", detail: error instanceof Error ? error.message : String(error) };
  }
}

export async function startQvacRealtimeVoiceLoop(params: {
  agentModel: RuntimeModel;
  systemPrompt?: string;
  delegate?: QvacDelegateOptions;
  callbacks?: VoiceLoopCallbacks;
}): Promise<RealtimeVoiceLoop> {
  const asrModel = voiceModel("asr");
  const ttsModel = voiceModel("tts");
  const [asrModelId, llmLoad, ttsModelId] = await Promise.all([
    loadVoiceModel(asrModel),
    loadQvacModel(params.agentModel, undefined, params.delegate),
    loadVoiceModel(ttsModel),
  ]);
  if (!llmLoad.ok) throw new Error(llmLoad.detail);

  const { transcribeStream, unloadModel } = await import("@qvac/sdk");
  const session = await transcribeStream({
    modelId: asrModelId,
    emitVadEvents: true,
    endOfTurnSilenceMs: 700,
    vadRunIntervalMs: 120,
    prompt: "A short spoken command to a private phone agent.",
  });
  const llmModelId = modelIdFromLoadDetail(llmLoad.detail);
  let speaking = false;
  let stopped = false;

  void (async () => {
    try {
      for await (const event of session) {
        if (stopped) break;
        if (event.type === "vad") {
          params.callbacks?.onVad?.(event.speaking, event.probability);
          continue;
        }
        if (event.type !== "text" || !isMeaningfulTranscript(event.text) || speaking) continue;
        const transcript = event.text.trim();
        params.callbacks?.onTranscript?.(transcript);
        speaking = true;
        try {
          await generateVoiceReply({
            llmModelId,
            ttsModelId,
            transcript,
            systemPrompt: params.systemPrompt,
            callbacks: params.callbacks,
          });
        } finally {
          speaking = false;
        }
      }
    } catch (error) {
      params.callbacks?.onError?.(error instanceof Error ? error.message : String(error));
    }
  })();

  return {
    asrModelId,
    ttsModelId,
    llmModelId,
    writePcmFloat32: (chunk: Uint8Array) => {
      if (!stopped && !speaking) session.write(chunk);
    },
    stop: async () => {
      stopped = true;
      try {
        session.end();
      } catch {
        session.destroy();
      }
      await unloadModel({ modelId: ttsModelId, clearStorage: false }).catch(() => {});
      await unloadModel({ modelId: asrModelId, clearStorage: false }).catch(() => {});
    },
  };
}
