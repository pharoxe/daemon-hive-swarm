import type { CredentialsVault } from "./localStore";

export type CloudProvider = "openai" | "anthropic" | "gemini" | "openrouter";

const geminiPreferredModels = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
  "gemini-2.0-flash-001",
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
  "gemini-flash-latest",
  "gemini-1.5-flash-latest",
];

export function getAvailableCloudProvider(vault: CredentialsVault): CloudProvider | null {
  if (vault.openaiApiKey.trim()) return "openai";
  if (vault.anthropicApiKey.trim()) return "anthropic";
  if (vault.geminiApiKey.trim()) return "gemini";
  if (vault.openRouterApiKey.trim()) return "openrouter";
  return null;
}

async function readJsonResponse(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { text };
  }
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function geminiEndpoint(model: string, apiKey: string) {
  const normalizedModel = model.replace(/^models\//, "").replace("gemini-1.5.flash", "gemini-1.5-flash");
  return `https://generativelanguage.googleapis.com/v1beta/models/${normalizedModel}:generateContent?key=${encodeURIComponent(apiKey)}`;
}

function geminiText(data: any) {
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  return parts.map((part: { text?: string }) => part.text ?? "").join("").trim();
}

function isGeminiModelUnavailable(data: any, status: number) {
  const message = String(data?.error?.message ?? data?.text ?? "");
  return status === 404 || /not found|not supported for generateContent|unsupported/i.test(message);
}

async function listGenerateContentGeminiModels(apiKey: string) {
  const response = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
    {},
    45000,
  );
  const data = await readJsonResponse(response);
  if (!response.ok) throw new Error(data?.error?.message || data?.text || `Gemini model list failed: ${response.status}`);

  const names = ((data?.models ?? []) as Array<{ name?: string; supportedGenerationMethods?: string[] }>)
    .filter((model) => model.supportedGenerationMethods?.includes("generateContent") && model.name)
    .map((model) => String(model.name).replace(/^models\//, ""));

  return names.sort((a, b) => {
    const score = (name: string) => (name.includes("flash") ? 0 : 1) + (name.includes("2.5") ? 0 : 2) + (name.includes("lite") ? 0.2 : 0);
    return score(a) - score(b);
  });
}

async function sendGeminiAgentMessage(vault: CredentialsVault, systemPrompt: string, userMessage: string) {
  const apiKey = vault.geminiApiKey.trim();
  let lastError = "";

  const tryModel = async (model: string) => {
    let response: Response;
    try {
      response = await fetchWithTimeout(
        geminiEndpoint(model, apiKey),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: systemPrompt }],
            },
            contents: [
              {
                role: "user",
                parts: [{ text: userMessage }],
              },
            ],
            generationConfig: {
              temperature: 0.25,
              maxOutputTokens: 4096,
            },
          }),
        },
        120000,
      );
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      const msg = error instanceof Error ? error.message : String(error);
      if (name === "AbortError" || /aborted|AbortError/i.test(msg)) {
        lastError = "Gemini request timed out (network stall or slow API).";
        return null;
      }
      lastError = msg;
      return null;
    }

    const data = await readJsonResponse(response);
    if (response.ok) return geminiText(data) || "Gemini response was empty.";
    lastError = data?.error?.message || data?.text || `Gemini request failed: ${response.status}`;
    if (isGeminiModelUnavailable(data, response.status)) return null;
    throw new Error(lastError);
  };

  for (const model of geminiPreferredModels) {
    const text = await tryModel(model);
    if (text) return text;
  }

  let listedModels: string[] = [];
  try {
    listedModels = await listGenerateContentGeminiModels(apiKey);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    lastError = msg || lastError;
  }
  for (const model of listedModels) {
    if (geminiPreferredModels.includes(model)) continue;
    const text = await tryModel(model);
    if (text) return text;
  }

  throw new Error(lastError || "No Gemini model supporting generateContent was available for this API key.");
}

export async function sendCloudAgentMessage({
  provider,
  vault,
  systemPrompt,
  userMessage,
}: {
  provider: CloudProvider;
  vault: CredentialsVault;
  systemPrompt: string;
  userMessage: string;
}) {
  if (provider === "openai") {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${vault.openaiApiKey.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature: 0.2,
      }),
    });
    const data = await readJsonResponse(response);
    if (!response.ok) throw new Error(data?.error?.message || data?.text || `OpenAI request failed: ${response.status}`);
    return String(data?.choices?.[0]?.message?.content || "").trim();
  }

  if (provider === "anthropic") {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": vault.anthropicApiKey.trim(),
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-latest",
        max_tokens: 768,
        temperature: 0.2,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });
    const data = await readJsonResponse(response);
    if (!response.ok) throw new Error(data?.error?.message || data?.text || `Claude request failed: ${response.status}`);
    return String(data?.content?.[0]?.text || "").trim();
  }

  if (provider === "gemini") {
    return sendGeminiAgentMessage(vault, systemPrompt, userMessage);
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${vault.openRouterApiKey.trim()}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://daemon.local",
      "X-Title": "Daemon",
    },
    body: JSON.stringify({
      model: "openai/gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.2,
    }),
  });
  const data = await readJsonResponse(response);
  if (!response.ok) throw new Error(data?.error?.message || data?.text || `OpenRouter request failed: ${response.status}`);
  return String(data?.choices?.[0]?.message?.content || "").trim();
}
