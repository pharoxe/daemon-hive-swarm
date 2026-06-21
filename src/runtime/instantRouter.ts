import {
  extractWebSearchQueryFromPrompt,
  shouldAutoRunOnchainAnalysis,
  shouldFetchTokenPriceOnly,
  shouldRouteUnknownTopicToWeb,
} from "./toolRuntime";
import { loadRoutingRulesFromStore } from "./instantRouterStore";
import type { InstantRoutingRuleRow, InstantToolRoute, PriceFallbackStage } from "./instantRouterTypes";
import { DEFAULT_PRICE_FALLBACK_CHAIN } from "./instantRouterTypes";
import type { ToolId } from "./toolRuntime";

export type InstantRouterContext = {
  enabledToolIds: Set<ToolId>;
};

function safeJsonParse(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw) as unknown;
    return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function isPriceChain(value: unknown): value is PriceFallbackStage[] {
  if (!Array.isArray(value)) return false;
  const allowed: PriceFallbackStage[] = ["dex_pair", "dex_token_pairs", "jupiter_usd", "duckduckgo"];
  return value.every((x) => typeof x === "string" && (allowed as string[]).includes(x));
}

function matchBuiltin(prompt: string, builtin: string): boolean {
  switch (builtin) {
    case "web_extract":
      return extractWebSearchQueryFromPrompt(prompt) !== null;
    case "price_only":
      return shouldFetchTokenPriceOnly(prompt);
    case "onchain_auto": {
      const slash = prompt.match(/^\/onchain\s+(.+)/i);
      if (slash?.[1]?.trim()) return true;
      return shouldAutoRunOnchainAnalysis(prompt);
    }
    case "unknown_topic_web":
      return shouldRouteUnknownTopicToWeb(prompt);
    default:
      return false;
  }
}

function ruleMatches(prompt: string, rule: InstantRoutingRuleRow): boolean {
  if (!rule.enabled) return false;
  if (rule.matcherType === "regex") {
    try {
      return new RegExp(rule.matcherValue, "i").test(prompt);
    } catch {
      return false;
    }
  }
  return matchBuiltin(prompt, rule.matcherValue);
}

function onchainAnalysisPrompt(prompt: string): string {
  const slash = prompt.match(/^\/onchain\s+(.+)/i);
  if (slash?.[1]?.trim()) return slash[1].trim();
  return prompt;
}

/**
 * First matching SQLite rule wins (ordered by priority). Returns null when no instant
 * tool route applies — caller should continue legacy command handling / LLM path.
 */
export async function matchInstantToolRoute(prompt: string, ctx: InstantRouterContext): Promise<InstantToolRoute | null> {
  const rules = await loadRoutingRulesFromStore();

  for (const rule of rules) {
    if (!ruleMatches(prompt, rule)) continue;

    const payload = safeJsonParse(rule.routePayloadJson);

    if (rule.routeKind === "web") {
      if (!ctx.enabledToolIds.has("websearch")) continue;

      const querySource = typeof payload.querySource === "string" ? payload.querySource : "extracted";
      let query = "";
      if (querySource === "extracted") {
        query = extractWebSearchQueryFromPrompt(prompt) ?? "";
      } else if (querySource === "prompt_trimmed") {
        const maxChars = typeof payload.maxChars === "number" ? payload.maxChars : 240;
        query = prompt.trim().slice(0, maxChars);
      }
      if (!query.trim()) continue;

      const synthesizeAfter = payload.synthesizeAfter === true;
      return {
        intent: "web",
        ruleId: rule.id,
        ruleName: rule.name,
        query: query.trim(),
        synthesizeAfter,
      };
    }

    if (rule.routeKind === "price") {
      if (!ctx.enabledToolIds.has("onchain")) continue;
      const chainRaw = payload.priceChain;
      const priceChain = isPriceChain(chainRaw) ? chainRaw : DEFAULT_PRICE_FALLBACK_CHAIN;
      return {
        intent: "price",
        ruleId: rule.id,
        ruleName: rule.name,
        priceChain,
      };
    }

    if (rule.routeKind === "onchain") {
      if (!ctx.enabledToolIds.has("onchain")) continue;
      return {
        intent: "onchain",
        ruleId: rule.id,
        ruleName: rule.name,
        analysisPrompt: onchainAnalysisPrompt(prompt),
      };
    }

    if (rule.routeKind === "llm") {
      return { intent: "llm", ruleId: rule.id, reason: "rule_routed_llm" };
    }
  }

  return null;
}

export { initInstantRouterStore, invalidateInstantRouterRuleCache } from "./instantRouterStore";
