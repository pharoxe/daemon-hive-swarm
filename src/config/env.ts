export const env = {
  defaultModel: process.env.EXPO_PUBLIC_DAEMON_DEFAULT_MODEL || "qwen35-08b-q4km",
  modelContext: Number(process.env.EXPO_PUBLIC_DAEMON_MODEL_CONTEXT || 1024),
  modelPredict: Number(process.env.EXPO_PUBLIC_DAEMON_MODEL_PREDICT || 768),
  fabricLlm: process.env.EXPO_PUBLIC_DAEMON_FABRIC_LLM !== "0",
  androidGpuBackend: (process.env.EXPO_PUBLIC_DAEMON_ANDROID_GPU_BACKEND || "auto").toLowerCase(),
  fabricGpuLayers: (() => {
    const raw = process.env.EXPO_PUBLIC_DAEMON_FABRIC_GPU_LAYERS;
    if (raw === undefined || raw === "") return 99;
    const v = Number(raw);
    if (!Number.isFinite(v)) return 1;
    return Math.min(99, Math.max(1, Math.floor(v)));
  })(),
  fabricGpu: process.env.EXPO_PUBLIC_DAEMON_FABRIC_GPU === "1",
  telegramBotToken: process.env.EXPO_PUBLIC_TELEGRAM_BOT_TOKEN || "",
  photonIMessageAddress: process.env.EXPO_PUBLIC_PHOTON_IMESSAGE_ADDRESS || "",
  photonIMessageToken: process.env.EXPO_PUBLIC_PHOTON_IMESSAGE_TOKEN || "",
  photonIMessagePhone: process.env.EXPO_PUBLIC_PHOTON_IMESSAGE_PHONE || "",
  solanaChain: process.env.EXPO_PUBLIC_SOLANA_CHAIN || "solana:mainnet",
  solanaRpcUrl: process.env.EXPO_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
  solanaAgentWalletAddress:
    process.env.EXPO_PUBLIC_SOLANA_AGENT_WALLET_ADDRESS || "AsZgkDxiRLHR9gWDUEs9zkDnku3v7maXxxp5mNasUfWr",
  solanaUsdcMint: process.env.EXPO_PUBLIC_SOLANA_USDC_MINT || "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  solanaDefaultFundAmount: process.env.EXPO_PUBLIC_SOLANA_DEFAULT_FUND_AMOUNT || "1",
  payAiFacilitatorUrl: process.env.EXPO_PUBLIC_PAYAI_FACILITATOR_URL || "https://facilitator.payai.network",
  qvacHttpConnectionTimeoutMs: (() => {
    const raw = process.env.EXPO_PUBLIC_DAEMON_QVAC_HTTP_CONNECTION_TIMEOUT_MS;
    if (raw === undefined || raw === "") return 1_800_000;
    const v = Number(raw);
    if (!Number.isFinite(v)) return 1_800_000;
    return Math.min(3_600_000, Math.max(15_000, Math.floor(v)));
  })(),
};

export function configured(value: string) {
  return value.trim().length > 0;
}
