import * as Calendar from "expo-calendar";
import * as Device from "expo-device";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { DEFAULT_PRICE_FALLBACK_CHAIN } from "./instantRouterTypes";
import type { PriceFallbackStage } from "./instantRouterTypes";
import type { CredentialsVault } from "./localStore";

export type ToolId = "device" | "files" | "calendar" | "wallet" | "memory" | "api" | "onchain" | "vision" | "websearch" | "voice";

export type ManualEndpoint = {
  id: string;
  name: string;
  method: "GET" | "POST";
  url: string;
  headers?: string;
  body?: string;
};

export type EndpointCallResult = {
  ok: boolean;
  label: string;
  detail: string;
};

export type OnchainApiSource = {
  id: string;
  name: string;
  baseUrl: string;
  access: "public" | "optional-key" | "requires-key";
  purpose: string;
  promptUse: string;
  example: string;
};

function decodeBase64Json(value: string) {
  try {
    const decoded =
      typeof atob === "function"
        ? atob(value)
        : (globalThis as any).Buffer?.from(value, "base64").toString("utf8");
    if (!decoded) return undefined;
    return JSON.parse(decoded);
  } catch {
    return undefined;
  }
}

export const onchainApiSources: OnchainApiSource[] = [
  {
    id: "dexscreener",
    name: "DexScreener",
    baseUrl: "https://api.dexscreener.com",
    access: "public",
    purpose: "Resolve token symbols, rank Solana pools by liquidity, inspect price, volume, txn counts, FDV, market cap, and pair URLs.",
    promptUse: "Use first when a user gives a ticker like $ORE. Prefer exact Solana baseToken symbol matches with the deepest USD liquidity.",
    example: "GET /latest/dex/search?q=ORE",
  },
  {
    id: "defillama",
    name: "DefiLlama",
    baseUrl: "https://api.llama.fi",
    access: "public",
    purpose: "Fetch DeFi protocol, chain, stablecoin, DEX volume, fee, yield, and token price context without an API key.",
    promptUse: "Use for macro context, Solana DEX volume backdrop, protocol health, and price cross-checks by chain-prefixed coin IDs.",
    example: "GET /overview/dexs/solana",
  },
  {
    id: "geckoterminal",
    name: "GeckoTerminal",
    baseUrl: "https://api.geckoterminal.com/api/v2",
    access: "public",
    purpose: "Fetch DEX pool discovery, liquidity, trades, OHLCV, and token pool rankings across Solana and other networks.",
    promptUse: "Use after resolving a mint to compare top pools, pool activity, and short-term price/volume behavior.",
    example: "GET /networks/solana/tokens/{mint}/pools",
  },
  {
    id: "reddit",
    name: "Reddit",
    baseUrl: "https://www.reddit.com",
    access: "public",
    purpose: "Fetch public social chatter, narratives, risks, and community sentiment around tokens and protocols.",
    promptUse: "Use only as social context. Never treat Reddit sentiment as verified market data.",
    example: "GET /search.json?q=%24ORE%20Solana&limit=10",
  },
  {
    id: "goplus-solana",
    name: "GoPlus Security",
    baseUrl: "https://api.gopluslabs.io",
    access: "optional-key",
    purpose: "Fetch Solana token security and risk fields where available.",
    promptUse: "Use for safety checks after mint resolution. If authorization is unavailable or a request fails, disclose the gap and continue with public sources.",
    example: "GET /api/v1/solana/token_security?contract_addresses={mint}",
  },
  {
    id: "solana-rpc",
    name: "Solana JSON-RPC",
    baseUrl: "Configured SOLANA_RPC_URL with public fallback",
    access: "public",
    purpose: "Read token supply, largest token accounts, token-account owners, signatures, and parsed transactions.",
    promptUse: "Use for holder distribution and recent token-account balance deltas. Keep requests bounded to avoid public RPC rate limits.",
    example: "POST getTokenLargestAccounts, getMultipleAccounts, getSignaturesForAddress, getTransaction",
  },
  {
    id: "jupiter-tokens",
    name: "Jupiter Tokens API",
    baseUrl: "https://api.jup.ag",
    access: "requires-key",
    purpose: "Search Solana token metadata, verification state, organic score, holder count, and trading stats.",
    promptUse: "Use when the user provides a Jupiter API key later. For this MVP, DexScreener remains the default public symbol resolver.",
    example: "GET /tokens/v2/search?query=ORE",
  },
  {
    id: "goldrush",
    name: "GoldRush",
    baseUrl: "https://api.covalenthq.com",
    access: "requires-key",
    purpose: "Fetch indexed balances, transactions, token transfers, and portfolio views across supported chains when a GoldRush/Covalent key is configured.",
    promptUse: "Use for richer historical wallet and portfolio activity after the user adds a key. For this keyless MVP, use Solana RPC holder sampling instead.",
    example: "GET /v1/{chainName}/address/{walletAddress}/portfolio_v2/",
  },
  {
    id: "dune",
    name: "Dune API",
    baseUrl: "https://api.dune.com",
    access: "requires-key",
    purpose: "Fetch curated SQL query results and dashboards for deeper token, holder, DEX, and wallet cohort analysis.",
    promptUse: "Use when the user adds a Dune API key and a known query ID. Prefer public no-key APIs for default MVP flows.",
    example: "GET /api/v1/query/{query_id}/results",
  },
  {
    id: "rugcheck",
    name: "RugCheck",
    baseUrl: "https://api.rugcheck.xyz/v1",
    access: "public",
    purpose: "Fetch Solana token report summaries, risk indicators, lockers, and token verification context when the public endpoint is available.",
    promptUse: "Use as an additional safety lens alongside GoPlus. Treat failures as non-fatal because availability and limits can vary.",
    example: "GET /tokens/{mint}/report/summary",
  },
  {
    id: "payai-bazaar",
    name: "PayAI x402 Bazaar",
    baseUrl: "https://facilitator.payai.network",
    access: "public",
    purpose: "Discover x402-compatible paid APIs and MCP tools that agents can call after payment.",
    promptUse: "Use to discover paid API candidates before attempting a paid x402 call. Prefer APIs with clear schemas, low price, and Solana support.",
    example: "GET /discovery/resources",
  },
  {
    id: "coinbase-x402-bazaar",
    name: "Coinbase x402 Bazaar",
    baseUrl: "https://api.cdp.coinbase.com/platform/v2/x402",
    access: "public",
    purpose: "Discover x402-compatible resources listed through the Coinbase facilitator discovery layer.",
    promptUse: "Use as a second x402 discovery source when looking for web search, data, crypto, weather, or scrape APIs.",
    example: "GET /discovery/resources",
  },
];

export async function getDeviceToolSummary() {
  const summary = {
    brand: Device.brand ?? "unknown",
    deviceName: Device.deviceName ?? "unknown",
    deviceType: Device.deviceType ?? "unknown",
    manufacturer: Device.manufacturer ?? "unknown",
    modelName: Device.modelName ?? "unknown",
    osName: Device.osName ?? "unknown",
    osVersion: Device.osVersion ?? "unknown",
    totalMemory: Device.totalMemory ? `${Math.round(Device.totalMemory / 1024 / 1024)} MB` : "unknown",
  };

  return JSON.stringify(summary, null, 2);
}

export async function pickAndReadLocalFile(
  type: string | string[] = ["text/*", "application/json", "application/pdf", "image/*"],
  options?: { visionProvider?: "qvac-ocr" | "mlkit" },
) {
  const picked = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: false,
    type,
  });

  if (picked.canceled) return "File picker cancelled.";

  const asset = picked.assets[0];
  if (!asset) return "No file selected.";

  const mimeType = asset.mimeType ?? "unknown";
  let preview = "Preview unavailable for this file type.";
  let vision = "";
  if (mimeType.startsWith("text/") || asset.name.endsWith(".json") || asset.name.endsWith(".md")) {
    const content = await FileSystem.readAsStringAsync(asset.uri);
    preview = content.slice(0, 4000);
  } else if (mimeType.startsWith("image/")) {
    if (options?.visionProvider === "qvac-ocr") {
      try {
        const { runQvacOcrPreview } = await import("./qvacOcr");
        vision = await runQvacOcrPreview(asset.uri);
        preview = "Image selected. QVAC OCR output is included below when available.";
      } catch (error) {
        const fallback = await runMlKitVisionPreview(asset.uri);
        vision = JSON.stringify(
          {
            provider: "QVAC OCR fallback",
            qvacError: error instanceof Error ? error.message : String(error),
            mlKit: safeJsonParse(fallback) ?? fallback,
          },
          null,
          2,
        );
        preview = "Image selected. QVAC OCR was unavailable, so ML Kit fallback output is included below.";
      }
    } else {
      vision = await runMlKitVisionPreview(asset.uri);
      preview = "Image selected. ML Kit vision output is included below when available.";
    }
  } else if (mimeType === "application/pdf" || asset.name.toLowerCase().endsWith(".pdf")) {
    preview = "PDF selected. Native PDF text extraction is planned; use image screenshots or text exports for this MVP.";
  }

  return JSON.stringify(
    {
      name: asset.name,
      mimeType,
      size: asset.size ?? "unknown",
      preview,
      vision,
    },
    null,
    2,
  );
}

function safeJsonParse(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

export async function pickLocalAudioFile() {
  const picked = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: false,
    type: ["audio/*", "video/mp4"],
  });

  if (picked.canceled) return null;
  return picked.assets[0] ?? null;
}

export async function runMlKitVisionPreview(uri?: string) {
  if (!uri) return "Select an image file first so ML Kit can inspect it.";

  try {
    const [textRecognitionModule, imageLabelingModule] = await Promise.all([
      import("@react-native-ml-kit/text-recognition"),
      import("@react-native-ml-kit/image-labeling"),
    ]);
    const TextRecognition = (textRecognitionModule as any).default ?? textRecognitionModule;
    const ImageLabeling = (imageLabelingModule as any).default ?? imageLabelingModule;
    const [recognizedText, labels] = await Promise.all([
      TextRecognition.recognize(uri),
      ImageLabeling.label(uri),
    ]);
    const text = String(recognizedText?.text ?? "").slice(0, 2500);
    const labelSummary = Array.isArray(labels)
      ? labels
          .slice(0, 8)
          .map((label: any) => `${label.text ?? label.label ?? "label"} (${Math.round(Number(label.confidence ?? 0) * 100)}%)`)
          .join(", ")
      : "";

    return JSON.stringify(
      {
        ocrText: text || "No text recognized.",
        labels: labelSummary || "No labels recognized.",
      },
      null,
      2,
    );
  } catch (error) {
    return `ML Kit vision is not available in this build yet. Install @react-native-ml-kit/text-recognition and @react-native-ml-kit/image-labeling, then rebuild Android. Detail: ${
      error instanceof Error ? error.message : String(error)
    }`;
  }
}

export async function requestCalendarToolSummary() {
  const permission = await Calendar.requestCalendarPermissionsAsync();
  if (permission.status !== "granted") {
    return "Calendar permission was not granted.";
  }

  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  return JSON.stringify(
    calendars.slice(0, 8).map((calendar) => ({
      id: calendar.id,
      title: calendar.title,
      allowsModifications: calendar.allowsModifications,
      source: calendar.source?.name ?? "unknown",
    })),
    null,
    2,
  );
}

export async function writeMemoryBackup(payload: unknown) {
  const directory = `${FileSystem.documentDirectory ?? ""}daemon-backups/`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  const path = `${directory}memory-${Date.now()}.json`;
  await FileSystem.writeAsStringAsync(path, JSON.stringify(payload, null, 2));
  return path;
}

function parseHeaders(value?: string) {
  if (!value?.trim()) return {};
  return JSON.parse(value) as Record<string, string>;
}

export async function callEndpoint(endpoint: ManualEndpoint): Promise<EndpointCallResult> {
  const response = await fetch(endpoint.url, {
    method: endpoint.method,
    headers: parseHeaders(endpoint.headers),
    body: endpoint.method === "POST" && endpoint.body?.trim() ? endpoint.body : undefined,
  });
  const text = await response.text();
  const paymentRequired = response.headers.get("PAYMENT-REQUIRED") ?? response.headers.get("X-PAYMENT-REQUIRED");
  const paymentResponse = response.headers.get("PAYMENT-RESPONSE") ?? response.headers.get("X-PAYMENT-RESPONSE");
  const paymentInfo = paymentRequired
    ? `\n\nx402 payment required:\n${JSON.stringify(decodeBase64Json(paymentRequired) ?? paymentRequired, null, 2).slice(0, 1600)}`
    : paymentResponse
      ? `\n\nx402 payment response:\n${JSON.stringify(decodeBase64Json(paymentResponse) ?? paymentResponse, null, 2).slice(0, 1600)}`
      : "";

  return {
    ok: response.ok,
    label: endpoint.name,
    detail: `HTTP ${response.status}: ${text.slice(0, 1200) || "No response body."}${paymentInfo}`,
  };
}

type DexPair = {
  chainId?: string;
  dexId?: string;
  url?: string;
  pairAddress?: string;
  baseToken?: { address?: string; name?: string; symbol?: string };
  quoteToken?: { symbol?: string };
  priceUsd?: string;
  liquidity?: { usd?: number };
  volume?: Record<string, number>;
  txns?: Record<string, { buys?: number; sells?: number }>;
  priceChange?: Record<string, number>;
  fdv?: number;
  marketCap?: number;
};

type RpcTokenAccount = {
  address: string;
  amount: string;
  decimals: number;
  uiAmount?: number;
  uiAmountString?: string;
};

type HolderActivity = {
  owner: string;
  tokenAccount: string;
  balance: string;
  recentTxCount: number;
  buysOrReceives: number;
  sellsOrSends: number;
  netTokenDelta: number;
  latestSignature?: string;
};

const base58Pattern = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function compactJson(value: unknown, maxLength = 2200) {
  const serialized = JSON.stringify(value, null, 2);
  return serialized.length > maxLength ? `${serialized.slice(0, maxLength)}\n...truncated` : serialized;
}

function shortAddress(value?: string) {
  if (!value || value === "unknown") return "unknown";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function formatAmount(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value ?? "unknown");
  if (Math.abs(numeric) >= 1_000_000) return `${(numeric / 1_000_000).toFixed(2)}M`;
  if (Math.abs(numeric) >= 1_000) return `${(numeric / 1_000).toFixed(2)}K`;
  return numeric.toFixed(4).replace(/\.?0+$/, "");
}

function formatUsd(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "unknown";
  if (numeric >= 1_000_000) return `$${(numeric / 1_000_000).toFixed(2)}M`;
  if (numeric >= 1_000) return `$${(numeric / 1_000).toFixed(1)}K`;
  return `$${numeric.toFixed(2)}`;
}

function buildOnchainInsightBrief(payload: {
  request: string;
  resolvedToken: { mint: string; symbol: string; name: string; source: string };
  marketFromDexScreener?: {
    dex?: string;
    pairAddress?: string;
    url?: string;
    quote?: string;
    priceUsd?: string;
    liquidityUsd?: number;
    volume?: Record<string, number>;
    txns?: Record<string, { buys?: number; sells?: number }>;
    priceChange?: Record<string, number>;
    fdv?: number;
    marketCap?: number;
  };
  topHolders: Array<{ owner: string; tokenAccount: string; balance: string }>;
  holderActivity: HolderActivity[];
  enrichmentStatus: Record<string, string>;
}) {
  const market = payload.marketFromDexScreener;
  const volume24h = market?.volume?.h24;
  const txns24h = market?.txns?.h24;
  const priceChange24h = market?.priceChange?.h24;
  const netDelta = payload.holderActivity.reduce((sum, item) => sum + Number(item.netTokenDelta || 0), 0);
  const receives = payload.holderActivity.reduce((sum, item) => sum + item.buysOrReceives, 0);
  const sends = payload.holderActivity.reduce((sum, item) => sum + item.sellsOrSends, 0);
  const sampledTxs = payload.holderActivity.reduce((sum, item) => sum + item.recentTxCount, 0);
  const holderLines = payload.topHolders.slice(0, 5).map(
    (holder, index) =>
      `${index + 1}. ${shortAddress(holder.owner)} owns ${formatAmount(holder.balance)} tokens via ${shortAddress(holder.tokenAccount)}`,
  );
  const activityLines = payload.holderActivity.slice(0, 5).map(
    (item, index) =>
      `${index + 1}. ${shortAddress(item.owner)}: ${item.recentTxCount} recent txs, ${item.buysOrReceives} receives/buys, ${item.sellsOrSends} sends/sells, net ${formatAmount(item.netTokenDelta)}`,
  );
  const confidence =
    sampledTxs === 0
      ? "Low: holders resolved, but recent transfer sample was empty or unavailable on public RPC."
      : "Medium: public RPC sample covers largest token accounts, but cannot always distinguish DEX fills from wallet transfers.";

  return [
    `Onchain brief for ${payload.resolvedToken.symbol} (${payload.resolvedToken.name})`,
    `Mint: ${payload.resolvedToken.mint}`,
    `Resolution: ${payload.resolvedToken.source}`,
    market
      ? `Market: ${market.dex ?? "DEX"} ${market.quote ? `/ ${market.quote}` : ""}; price ${market.priceUsd ?? "unknown"}; liquidity ${formatUsd(market.liquidityUsd)}; 24h volume ${formatUsd(volume24h)}; 24h txns ${(txns24h?.buys ?? 0) + (txns24h?.sells ?? 0)}; 24h change ${priceChange24h ?? "unknown"}%.`
      : "Market: no DexScreener pair selected.",
    `Top-holder sample: ${payload.topHolders.length} largest token accounts inspected.`,
    ...holderLines,
    `48h activity sample: ${sampledTxs} recent token-account transactions; receives/buys ${receives}; sends/sells ${sends}; net sampled delta ${formatAmount(netDelta)}.`,
    ...activityLines,
    `Enrichment: GeckoTerminal ${payload.enrichmentStatus.geckoTerminalPools}; RugCheck ${payload.enrichmentStatus.rugCheckSummary}; GoPlus ${payload.enrichmentStatus.goPlusSolanaSecurity}; Reddit ${payload.enrichmentStatus.redditSearch}.`,
    `Confidence: ${confidence}`,
    "Caveat: positive deltas are receives or buys, negative deltas are sends or sells; public RPC alone cannot always classify intent.",
  ].join("\n");
}

function extractTokenQuery(prompt: string) {
  const explicitAddress = prompt.match(/\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/)?.[0];
  if (explicitAddress && base58Pattern.test(explicitAddress)) return explicitAddress;

  const dollar = prompt.match(/\$([A-Za-z0-9]{2,16})/)?.[1];
  if (dollar) return dollar.toUpperCase();

  const tokenWord = prompt.match(/\btoken\s+([A-Za-z0-9]{2,16})\b/i)?.[1];
  if (tokenWord) return tokenWord.toUpperCase();

  if (/\b(price|prices|spot|quote|quotes|cost|worth|value|fetch|current|latest|check|how much)\b/i.test(prompt)) {
    const common = prompt.match(/\b(SOL|WSOL|USDC|JUP|RAY|BONK|WIF|ETH|BTC)\b/i)?.[1];
    if (common) return common.toUpperCase();
  }

  return undefined;
}

function looksLikeMint(value: string) {
  return base58Pattern.test(value);
}

async function rpcCall<T>(rpcUrl: string, method: string, params: unknown[]): Promise<T> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
  });
  const payload = (await response.json()) as { result?: T; error?: { message?: string } };
  if (!response.ok || payload.error) {
    throw new Error(payload.error?.message ?? `RPC ${method} failed with HTTP ${response.status}`);
  }
  return payload.result as T;
}

/** Canonical mints for high-traffic symbols so Dex search does not pick unrelated low-liquidity pairs. */
const WELL_KNOWN_SOLANA_QUOTES: Record<string, { mint: string; displayName: string }> = {
  SOL: { mint: "So11111111111111111111111111111111111111112", displayName: "Wrapped SOL" },
  WSOL: { mint: "So11111111111111111111111111111111111111112", displayName: "Wrapped SOL" },
};

async function resolveToken(query: string) {
  if (looksLikeMint(query)) {
    return {
      mint: query,
      symbol: "UNKNOWN",
      name: "Direct mint",
      source: "direct mint",
      pair: undefined as DexPair | undefined,
    };
  }

  const upper = query.trim().toUpperCase();
  const known = WELL_KNOWN_SOLANA_QUOTES[upper];
  if (known) {
    const res = await fetchOptionalJson(`https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(known.mint)}`);
    if (res.ok && res.data && typeof res.data === "object") {
      const pairs = (res.data as { pairs?: DexPair[] }).pairs;
      if (Array.isArray(pairs) && pairs.length) {
        const solPairs = pairs.filter((pair) => pair.chainId === "solana");
        const list = solPairs.length ? solPairs : pairs;
        list.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));
        const best = list[0];
        if (best?.baseToken?.address) {
          return {
            mint: known.mint,
            symbol: best.baseToken.symbol ?? upper,
            name: best.baseToken.name ?? known.displayName,
            source: "DexScreener token endpoint (canonical mint)",
            pair: best,
          };
        }
      }
    }
    return {
      mint: known.mint,
      symbol: upper === "WSOL" ? "WSOL" : "SOL",
      name: known.displayName,
      source: "Canonical Solana native mint (WSOL)",
      pair: undefined as DexPair | undefined,
    };
  }

  const response = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`);
  const payload = (await response.json()) as { pairs?: DexPair[] };
  const pairs = (payload.pairs ?? [])
    .filter((pair) => pair.chainId === "solana" && pair.baseToken?.address)
    .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));
  const exact = pairs.find((pair) => pair.baseToken?.symbol?.toUpperCase() === query.toUpperCase());
  const selected = exact ?? pairs[0];

  if (!selected?.baseToken?.address) {
    throw new Error(`Could not resolve ${query} to a Solana token with DexScreener.`);
  }

  return {
    mint: selected.baseToken.address,
    symbol: selected.baseToken.symbol ?? query.toUpperCase(),
    name: selected.baseToken.name ?? query.toUpperCase(),
    source: "DexScreener liquidity-ranked Solana pair search",
    pair: selected,
  };
}

function parseUsdFromDexField(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function fetchDexTokenPairsBestUsd(mint: string): Promise<number | null> {
  const res = await fetchOptionalJson(`https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(mint)}`);
  if (!res.ok || !res.data || typeof res.data !== "object") return null;
  const pairs = (res.data as { pairs?: DexPair[] }).pairs;
  if (!Array.isArray(pairs) || !pairs.length) return null;
  const solPairs = pairs.filter((pair) => pair.chainId === "solana");
  const list = solPairs.length ? solPairs : pairs;
  list.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));
  for (const pair of list.slice(0, 8)) {
    const u = parseUsdFromDexField(pair?.priceUsd);
    if (u !== null) return u;
  }
  return null;
}

async function fetchJupiterReferenceUsd(mint: string): Promise<number | null> {
  const urls = [
    `https://lite-api.jup.ag/price/v3?ids=${encodeURIComponent(mint)}`,
    `https://api.jup.ag/price/v2?ids=${encodeURIComponent(mint)}`,
  ];
  for (const url of urls) {
    const res = await fetchOptionalJson(url);
    if (!res.ok || !res.data || typeof res.data !== "object") continue;
    const root = res.data as Record<string, unknown>;
    const inner = root.data && typeof root.data === "object" ? (root.data as Record<string, unknown>) : root;
    const entry = inner[mint];
    if (entry && typeof entry === "object") {
      const o = entry as Record<string, unknown>;
      const u = parseUsdFromDexField(o.price ?? o.usdPrice);
      if (u !== null) return u;
    }
    if (typeof entry === "number") {
      const u = parseUsdFromDexField(entry);
      if (u !== null) return u;
    }
  }
  return null;
}

async function fetchTokenOwners(rpcUrl: string, accounts: RpcTokenAccount[]) {
  if (!accounts.length) return new Map<string, string>();
  const result = await rpcCall<{
    value: Array<{
      data?: {
        parsed?: {
          info?: {
            owner?: string;
          };
        };
      };
    } | null>;
  }>(rpcUrl, "getMultipleAccounts", [accounts.map((account) => account.address), { encoding: "jsonParsed" }]);

  return new Map(
    accounts.map((account, index) => [
      account.address,
      result.value[index]?.data?.parsed?.info?.owner ?? "unknown",
    ]),
  );
}

function tokenDeltaForOwner(transaction: any, mint: string, owner: string) {
  const preBalances = transaction?.meta?.preTokenBalances ?? [];
  const postBalances = transaction?.meta?.postTokenBalances ?? [];
  const balanceMap = new Map<string, { pre: number; post: number }>();

  for (const item of preBalances) {
    if (item.mint !== mint || item.owner !== owner) continue;
    const key = `${item.accountIndex}:${item.mint}`;
    balanceMap.set(key, { pre: Number(item.uiTokenAmount?.uiAmount ?? 0), post: 0 });
  }

  for (const item of postBalances) {
    if (item.mint !== mint || item.owner !== owner) continue;
    const key = `${item.accountIndex}:${item.mint}`;
    const current = balanceMap.get(key) ?? { pre: 0, post: 0 };
    current.post = Number(item.uiTokenAmount?.uiAmount ?? 0);
    balanceMap.set(key, current);
  }

  let delta = 0;
  for (const balance of balanceMap.values()) {
    delta += balance.post - balance.pre;
  }
  return delta;
}

async function fetchHolderActivity(rpcUrl: string, mint: string, holder: RpcTokenAccount, owner: string) {
  const cutoff = Math.floor(Date.now() / 1000) - 48 * 60 * 60;
  const signatures = await rpcCall<Array<{ signature: string; blockTime?: number }>>(rpcUrl, "getSignaturesForAddress", [
    holder.address,
    { limit: 20 },
  ]);
  const recent = signatures.filter((signature) => (signature.blockTime ?? 0) >= cutoff).slice(0, 8);
  const activity: HolderActivity = {
    owner,
    tokenAccount: holder.address,
    balance: holder.uiAmountString ?? holder.amount,
    recentTxCount: recent.length,
    buysOrReceives: 0,
    sellsOrSends: 0,
    netTokenDelta: 0,
    latestSignature: recent[0]?.signature,
  };

  for (const signature of recent.slice(0, 5)) {
    try {
      const tx = await rpcCall<any>(rpcUrl, "getTransaction", [
        signature.signature,
        { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 },
      ]);
      const delta = tokenDeltaForOwner(tx, mint, owner);
      activity.netTokenDelta += delta;
      if (delta > 0) activity.buysOrReceives += 1;
      if (delta < 0) activity.sellsOrSends += 1;
    } catch {
      // Public RPC nodes can prune or rate-limit parsed transactions; keep the rest of the analysis useful.
    }
  }

  return activity;
}

async function fetchOptionalJson(url: string, headers?: Record<string, string>) {
  try {
    const response = await fetch(url, { headers });
    if (!response.ok) return { ok: false, status: response.status };
    return { ok: true, status: response.status, data: await response.json() };
  } catch (error) {
    return { ok: false, status: "network", error: error instanceof Error ? error.message : String(error) };
  }
}

export function shouldAutoRunOnchainAnalysis(prompt: string) {
  const token = extractTokenQuery(prompt);
  if (!token) return false;
  if (
    /\b(analy[sz]e|holders?|portfolio|buy\/sell|trading activity|onchain|on-chain|whales?)\b/i.test(prompt)
  ) {
    return true;
  }
  // Price / quote questions with an explicit ticker ($SOL) should hit Dex-backed data instead of waiting on local LLM.
  if (
    /\b(price|fetch|quote|cost|worth|value|how much|market cap|mcap|fdv|ticker)\b/i.test(prompt) ||
    /\$\s*[A-Za-z0-9]{2,16}/.test(prompt)
  ) {
    return /\b(price|fetch|quote|cost|worth|value|how much|market cap|mcap|fdv|get|show|current|latest|check)\b/i.test(
      prompt,
    );
  }
  return false;
}

/** Price / quote only: DexScreener resolution + spot fields — no RPC holders or social enrichment. */
export function shouldFetchTokenPriceOnly(prompt: string) {
  const token = extractTokenQuery(prompt);
  if (!token) return false;
  const p = prompt.toLowerCase();
  if (
    /\b(holders?|holder|analy[sz]e|analysis|portfolio|whales?|on-?chain|distribution|activity|top\s+\d+|buy\/sell|trading|sentiment|reddit|rugcheck|defi|liquidity\s+providers?)\b/i.test(
      p,
    )
  ) {
    return false;
  }
  return (
    /\b(price|prices|quote|quotes|cost|worth|value|how much|spot|ticker|mcap|marketcap|fdv|fetch|current|latest|check)\b/i.test(p) ||
    /\$\s*[A-Za-z0-9]{2,16}/.test(prompt)
  );
}

export async function fetchTokenSpotPriceOnly(prompt: string): Promise<EndpointCallResult> {
  const query = extractTokenQuery(prompt);
  if (!query) {
    return {
      ok: false,
      label: "Spot price",
      detail: "Add a ticker like $SOL or a Solana mint address.",
    };
  }
  try {
    const resolved = await resolveToken(query);
    const pair = resolved.pair;
    const priceUsd = pair?.priceUsd;
    const dex = pair?.dexId ?? "unknown DEX";
    const quote = pair?.quoteToken?.symbol ?? "?";
    const change = pair?.priceChange?.h24 ?? pair?.priceChange?.m5;
    const liq = pair?.liquidity?.usd;
    const priceLine =
      priceUsd === undefined || priceUsd === null
        ? "Price USD: not listed on the selected DexScreener pair."
        : `Price (DexScreener, ${dex} / ${quote}): $${Number(priceUsd).toLocaleString(undefined, { maximumFractionDigits: 6 })} USD`;
    const lines = [
      `${resolved.symbol} — ${resolved.name}`,
      priceLine,
      typeof liq === "number" ? `Liquidity (reported): ~$${Number(liq).toLocaleString()}.` : "",
      change !== undefined && change !== null && String(change).length ? `24h change (pair): ${String(change)}%.` : "",
      `Mint: ${resolved.mint}`,
      "Note: DEX-derived spot price only (not financial advice).",
    ].filter(Boolean);
    return { ok: true, label: `Price: ${resolved.symbol}`, detail: lines.join("\n") };
  } catch (error) {
    return {
      ok: false,
      label: "Spot price",
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

export function extractWebSearchQueryFromPrompt(prompt: string): string | null {
  const trimmed = prompt.trim();
  const slash = trimmed.match(/^\/?(?:search|web|ddg)\s+(.+)/i);
  if (slash?.[1]) return slash[1].trim() || null;
  const phrases = [
    /search\s+the\s+web\s+for\s+(.+)/i,
    /web\s+search\s+for\s+(.+)/i,
    /look\s+up\s+online\s+(.+)/i,
    /duckduckgo\s+(.+)/i,
    /google\s+(.+)/i,
  ];
  for (const re of phrases) {
    const m = trimmed.match(re);
    if (m?.[1]?.trim()) return m[1].trim();
  }
  if (/^search\s+/i.test(trimmed)) return trimmed.replace(/^search\s+/i, "").trim() || null;
  return null;
}

/**
 * Heuristic: likely needs fresh web facts (not handled by price/onchain auto routes).
 * Used by instant router for tool-first DuckDuckGo hits before local LLM.
 */
export function shouldRouteUnknownTopicToWeb(prompt: string): boolean {
  const trimmed = prompt.trim();
  if (trimmed.length < 16) return false;
  if (extractWebSearchQueryFromPrompt(prompt)) return false;
  if (shouldFetchTokenPriceOnly(prompt)) return false;
  if (shouldAutoRunOnchainAnalysis(prompt)) return false;
  if (/^\/(device|files|calendar|wallet|memory|api|onchain|search|web|ddg)\b/i.test(trimmed)) return false;
  if (/^\d[\d\s.x×*/+-]+=\s*\?/i.test(trimmed)) return false;
  if (/\b(latest|news|today|yesterday|this week|breaking|who won|score|weather|forecast|election|announced|ipo|released)\b/i.test(trimmed)) {
    return true;
  }
  if (/\b20[2-3][0-9]\b/.test(trimmed)) return true;
  if (/\?\s*$/.test(trimmed) && /\b(what|who|when|where|why|how)\b/i.test(trimmed) && trimmed.length > 28) return true;
  return false;
}

export async function searchWebDuckDuckGo(query: string): Promise<EndpointCallResult> {
  const q = query.trim();
  if (!q) {
    return { ok: false, label: "Web search", detail: "Empty search query." };
  }
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&no_redirect=1&t=daemon-agent`;
    const response = await fetch(url);
    if (!response.ok) {
      return { ok: false, label: "Web search", detail: `DuckDuckGo HTTP ${response.status}` };
    }
    const data = (await response.json()) as Record<string, unknown>;
    const parts: string[] = [];
    const heading = typeof data.Heading === "string" ? data.Heading : "";
    const abstract =
      typeof data.AbstractText === "string" && data.AbstractText
        ? data.AbstractText
        : typeof data.Abstract === "string"
          ? data.Abstract
          : "";
    const answer = typeof data.Answer === "string" ? data.Answer : "";
    if (heading) parts.push(heading);
    if (abstract) parts.push(abstract);
    if (answer) parts.push(`Instant answer: ${answer}`);
    const related = Array.isArray(data.RelatedTopics) ? data.RelatedTopics : [];
    let count = 0;
    for (const topic of related) {
      if (count >= 6) break;
      if (topic && typeof topic === "object" && "Text" in topic && typeof (topic as { Text?: string }).Text === "string") {
        parts.push(`• ${(topic as { Text: string }).Text}`);
        count++;
      }
    }
    if (!parts.length) {
      return {
        ok: true,
        label: "Web search",
        detail: `No instant summary from DuckDuckGo for "${q}". Try rephrasing, a proper noun, or add /search before your query.`,
      };
    }
    return {
      ok: true,
      label: "Web search",
      detail: [`Query: ${q}`, "", ...parts].join("\n"),
    };
  } catch (error) {
    return {
      ok: false,
      label: "Web search",
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

async function searchGoogleCustomSearch(query: string, apiKey: string, cx: string): Promise<EndpointCallResult> {
  const q = query.trim();
  if (!q) {
    return { ok: false, label: "Web search", detail: "Empty search query." };
  }
  try {
    const url = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(apiKey)}&cx=${encodeURIComponent(cx)}&q=${encodeURIComponent(q)}`;
    const response = await fetch(url);
    const data = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      const msg = typeof data.error === "object" && data.error && "message" in (data.error as object)
        ? String((data.error as { message?: string }).message)
        : JSON.stringify(data).slice(0, 400);
      return { ok: false, label: "Web search", detail: `Google Custom Search HTTP ${response.status}: ${msg}` };
    }
    const items = Array.isArray(data.items) ? data.items : [];
    if (!items.length) {
      return {
        ok: true,
        label: "Web search",
        detail: `Google Custom Search returned no web results for "${q}". Try broader keywords or fall back to /search with a shorter query.`,
      };
    }
    const lines: string[] = [`Query: ${q}`, ""];
    let n = 0;
    for (const raw of items) {
      if (n >= 8) break;
      if (!raw || typeof raw !== "object") continue;
      const item = raw as { title?: string; snippet?: string; link?: string };
      const title = item.title ?? "Result";
      const snippet = item.snippet ?? "";
      const link = item.link ?? "";
      lines.push(`• ${title}${link ? `\n  ${link}` : ""}${snippet ? `\n  ${snippet}` : ""}`);
      n++;
    }
    return { ok: true, label: "Web search", detail: lines.join("\n") };
  } catch (error) {
    return {
      ok: false,
      label: "Web search",
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Uses Google Programmable Search when vault has API key + search engine id; otherwise DuckDuckGo instant answer API.
 */
export async function searchWeb(
  query: string,
  vault: Pick<CredentialsVault, "googleCustomSearchApiKey" | "googleSearchEngineId">,
): Promise<EndpointCallResult> {
  const key = vault.googleCustomSearchApiKey?.trim();
  const cx = vault.googleSearchEngineId?.trim();
  if (key && cx) {
    const primary = await searchGoogleCustomSearch(query, key, cx);
    if (primary.ok) return primary;
    const fallback = await searchWebDuckDuckGo(query);
    if (fallback.ok) {
      return {
        ok: true,
        label: "Web search",
        detail: [`Google search did not return usable snippets (${primary.detail.slice(0, 280)}).`, "DuckDuckGo fallback:", "", fallback.detail].join(
          "\n",
        ),
      };
    }
    return primary;
  }
  return searchWebDuckDuckGo(query);
}

function buildSpotDetailLines(params: {
  symbol: string;
  name: string;
  mint: string;
  usd: number;
  sourceNote: string;
  pair?: DexPair;
}) {
  const { symbol, name, mint, usd, sourceNote, pair } = params;
  const dex = pair?.dexId ?? "aggregate";
  const quote = pair?.quoteToken?.symbol ?? "?";
  const change = pair?.priceChange?.h24 ?? pair?.priceChange?.m5;
  const liq = pair?.liquidity?.usd;
  return [
    `${symbol} — ${name}`,
    `Price (${sourceNote}, ${dex} / ${quote}): $${usd.toLocaleString(undefined, { maximumFractionDigits: 8 })} USD`,
    typeof liq === "number" ? `Liquidity (reported, when available): ~$${Number(liq).toLocaleString()}.` : "",
    change !== undefined && change !== null && String(change).length ? `24h change (pair, when available): ${String(change)}%.` : "",
    `Mint: ${mint}`,
    "Note: Public market sources only — verify before trading (not financial advice).",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Deterministic price pipeline: Dex primary pair → Dex token pairs → Jupiter reference → DuckDuckGo.
 */
export async function fetchTokenSpotPriceWithFallbackChain(
  prompt: string,
  chain?: PriceFallbackStage[],
  webVault?: Pick<CredentialsVault, "googleCustomSearchApiKey" | "googleSearchEngineId">,
): Promise<EndpointCallResult> {
  const stages = chain?.length ? [...chain] : [...DEFAULT_PRICE_FALLBACK_CHAIN];
  const query = extractTokenQuery(prompt);
  if (!query) {
    return {
      ok: false,
      label: "Spot price",
      detail: "Add a ticker like $SOL or a Solana mint address.",
    };
  }

  let resolved: Awaited<ReturnType<typeof resolveToken>> | undefined;
  let resolveError = "";

  try {
    resolved = await resolveToken(query);
  } catch (error) {
    resolveError = error instanceof Error ? error.message : String(error);
    resolved = undefined;
  }

  for (const stage of stages) {
    if (stage === "dex_pair" && resolved) {
      const u = parseUsdFromDexField(resolved.pair?.priceUsd);
      if (u !== null) {
        return {
          ok: true,
          label: `Price: ${resolved.symbol}`,
          detail: buildSpotDetailLines({
            symbol: resolved.symbol,
            name: resolved.name,
            mint: resolved.mint,
            usd: u,
            sourceNote: "DexScreener primary pair",
            pair: resolved.pair,
          }),
        };
      }
    }

    if (stage === "dex_token_pairs" && resolved?.mint) {
      const u = await fetchDexTokenPairsBestUsd(resolved.mint);
      if (u !== null) {
        return {
          ok: true,
          label: `Price: ${resolved.symbol}`,
          detail: buildSpotDetailLines({
            symbol: resolved.symbol,
            name: resolved.name,
            mint: resolved.mint,
            usd: u,
            sourceNote: "DexScreener token pairs",
            pair: resolved.pair,
          }),
        };
      }
    }

    if (stage === "jupiter_usd" && resolved?.mint) {
      const u = await fetchJupiterReferenceUsd(resolved.mint);
      if (u !== null) {
        return {
          ok: true,
          label: `Price: ${resolved.symbol}`,
          detail: buildSpotDetailLines({
            symbol: resolved.symbol,
            name: resolved.name,
            mint: resolved.mint,
            usd: u,
            sourceNote: "Jupiter reference USD",
            pair: resolved.pair,
          }),
        };
      }
    }

    if (stage === "duckduckgo") {
      const sym = resolved?.symbol ?? (looksLikeMint(query) ? "Solana SPL token" : query.toUpperCase());
      const mint = resolved?.mint ?? (looksLikeMint(query) ? query : "");
      const q = mint ? `${sym} Solana mint ${mint} USD price` : `${sym} crypto USD spot price`;
      const ddg = await searchWeb(
        q,
        webVault ?? { googleCustomSearchApiKey: "", googleSearchEngineId: "" },
      );
      if (ddg.ok) {
        return {
          ok: true,
          label: `Price (web fallback): ${sym}`,
          detail: ["Dex / Jupiter instant quotes were unavailable for this asset.", "Web summary (DuckDuckGo):", "", ddg.detail].join("\n"),
        };
      }
      return {
        ok: false,
        label: "Spot price",
        detail: [resolveError || "No on-chain market quote.", "Web fallback failed:", ddg.detail].filter(Boolean).join("\n"),
      };
    }
  }

  return {
    ok: false,
    label: "Spot price",
    detail: resolveError || "Could not assemble a USD quote with the configured fallback chain.",
  };
}

export async function analyzeOnchainQuery(prompt: string, rpcUrl: string): Promise<EndpointCallResult> {
  const query = extractTokenQuery(prompt);
  if (!query) {
    return {
      ok: false,
      label: "Onchain Analysis",
      detail: "Add a ticker like $ORE or a Solana mint address so Daemon can resolve the token.",
    };
  }

  try {
    const resolved = await resolveToken(query);
    const rpcCandidates = Array.from(new Set([rpcUrl, "https://solana-rpc.publicnode.com", "https://api.mainnet-beta.solana.com"].filter(Boolean)));
    let activeRpcUrl = rpcUrl;
    let largest: { value: RpcTokenAccount[] } | undefined;
    let lastRpcError = "";

    for (const candidate of rpcCandidates) {
      try {
        largest = await rpcCall<{ value: RpcTokenAccount[] }>(candidate, "getTokenLargestAccounts", [
          resolved.mint,
          { commitment: "confirmed" },
        ]);
        activeRpcUrl = candidate;
        break;
      } catch (error) {
        lastRpcError = error instanceof Error ? error.message : String(error);
      }
    }

    if (!largest) throw new Error(`Could not fetch top holders from available Solana RPC endpoints. Last error: ${lastRpcError}`);

    const topAccounts = largest.value.slice(0, 10);
    const owners = await fetchTokenOwners(activeRpcUrl, topAccounts);
    const holderActivity = await Promise.all(
      topAccounts.slice(0, 5).map((account) => fetchHolderActivity(activeRpcUrl, resolved.mint, account, owners.get(account.address) ?? "unknown")),
    );
    const gecko = await fetchOptionalJson(
      `https://api.geckoterminal.com/api/v2/networks/solana/tokens/${resolved.mint}/pools`,
    );
    const rugcheck = await fetchOptionalJson(`https://api.rugcheck.xyz/v1/tokens/${resolved.mint}/report/summary`);
    const goplus = await fetchOptionalJson(
      `https://api.gopluslabs.io/api/v1/solana/token_security?contract_addresses=${resolved.mint}`,
    );
    const redditQuery = encodeURIComponent(`$${resolved.symbol} Solana`);
    const reddit = await fetchOptionalJson(`https://www.reddit.com/search.json?q=${redditQuery}&limit=5`, {
      "User-Agent": "DaemonOnchainAnalysis/0.1",
    });

    const marketFromDexScreener = resolved.pair
      ? {
          dex: resolved.pair.dexId,
          pairAddress: resolved.pair.pairAddress,
          url: resolved.pair.url,
          quote: resolved.pair.quoteToken?.symbol,
          priceUsd: resolved.pair.priceUsd,
          liquidityUsd: resolved.pair.liquidity?.usd,
          volume: resolved.pair.volume,
          txns: resolved.pair.txns,
          priceChange: resolved.pair.priceChange,
          fdv: resolved.pair.fdv,
          marketCap: resolved.pair.marketCap,
        }
      : undefined;
    const enrichmentStatus = {
      geckoTerminalPools: gecko.ok ? "available" : `unavailable (${gecko.status})`,
      rugCheckSummary: rugcheck.ok ? "available" : `unavailable (${rugcheck.status})`,
      goPlusSolanaSecurity: goplus.ok ? "available" : `unavailable (${goplus.status})`,
      redditSearch: reddit.ok ? "available" : `unavailable (${reddit.status})`,
    };
    const analysisPayload = {
      request: prompt,
      resolvedToken: {
        mint: resolved.mint,
        symbol: resolved.symbol,
        name: resolved.name,
        source: resolved.source,
      },
      rpcEndpointUsed: activeRpcUrl,
      marketFromDexScreener,
      topHolders: topAccounts.map((account) => ({
        owner: owners.get(account.address) ?? "unknown",
        tokenAccount: account.address,
        balance: account.uiAmountString ?? account.amount,
      })),
      activityWindow: "last 48 hours, bounded public-RPC sample",
      holderActivity,
      enrichmentStatus,
    };
    const brief = buildOnchainInsightBrief(analysisPayload);

    return {
      ok: true,
      label: `Onchain Analysis: ${resolved.symbol}`,
      detail: `${brief}\n\nCompact evidence:\n${compactJson(analysisPayload, 1000)}`,
    };
  } catch (error) {
    return {
      ok: false,
      label: "Onchain Analysis",
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

export { extractTokenQuery as extractTokenSymbolOrMintFromPrompt };
