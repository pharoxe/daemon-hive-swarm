import { matchInstantToolRoute } from "./instantRouter";
import type { ToolId } from "./toolRuntime";

const ALL_TOOLS = new Set<ToolId>(["device", "files", "calendar", "wallet", "memory", "api", "onchain", "vision", "websearch"]);

type MatrixCase = {
  prompt: string;
  expect: "price" | "onchain" | "web" | "none";
};

/**
 * Lightweight routing regression checks (dev-only). Logs mismatches instead of throwing
 * so UI startup is never blocked by network or heuristic drift.
 */
export const INSTANT_ROUTER_MATRIX: MatrixCase[] = [
  { prompt: "What is the spot price of $SOL?", expect: "price" },
  { prompt: "/search Solana RPC rate limits", expect: "web" },
  { prompt: "/onchain $ORE holders narrative", expect: "onchain" },
  { prompt: "Analyze holder distribution for $ORE on Solana", expect: "onchain" },
  { prompt: "Latest breaking news on AI regulation today", expect: "web" },
  { prompt: "gm", expect: "none" },
];

export async function verifyInstantRouterMatrixInDev(): Promise<void> {
  for (const row of INSTANT_ROUTER_MATRIX) {
    const route = await matchInstantToolRoute(row.prompt, { enabledToolIds: ALL_TOOLS });
    const got = route?.intent === "llm" || !route ? "none" : route.intent;
    if (got !== row.expect) {
      console.warn("[InstantRouterMatrix] mismatch", { prompt: row.prompt, expect: row.expect, got, route });
    }
  }
}
