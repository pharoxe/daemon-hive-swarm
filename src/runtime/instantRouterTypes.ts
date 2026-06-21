/** High-level intents produced by the instant router (pre-LLM). */
export type InstantIntent = "price" | "onchain" | "web" | "llm";

/**
 * Ordered stages for the deterministic price pipeline (Dex pair → extra Dex token
 * pairs → Jupiter-style USD → DuckDuckGo web summary).
 */
export type PriceFallbackStage = "dex_pair" | "dex_token_pairs" | "jupiter_usd" | "duckduckgo";

export const DEFAULT_PRICE_FALLBACK_CHAIN: PriceFallbackStage[] = [
  "dex_pair",
  "dex_token_pairs",
  "jupiter_usd",
  "duckduckgo",
];

/** One persisted routing rule row (SQLite). */
export type InstantRoutingRuleRow = {
  id: string;
  priority: number;
  enabled: boolean;
  name: string;
  matcherType: "regex" | "builtin";
  matcherValue: string;
  routeKind: InstantIntent;
  /** Optional JSON: web template keys, synthesis flags, etc. */
  routePayloadJson: string | null;
  schemaVersion: number;
};

/**
 * Materialized route the chat layer should execute before any local LLM call.
 * `llm` means “no instant tool hit — continue normal chat flow”.
 */
export type InstantToolRoute =
  | { intent: "llm"; ruleId?: string; reason: string }
  | {
      intent: "price";
      ruleId: string;
      ruleName: string;
      /** Stages to attempt in order (defaults to DEFAULT_PRICE_FALLBACK_CHAIN). */
      priceChain: PriceFallbackStage[];
    }
  | { intent: "onchain"; ruleId: string; ruleName: string; analysisPrompt: string }
  | {
      intent: "web";
      ruleId: string;
      ruleName: string;
      query: string;
      /** If true, caller may run a short local/cloud synthesis pass after tool output. */
      synthesizeAfter?: boolean;
    };

export type InstantRouteDecision = InstantToolRoute;
