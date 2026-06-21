import * as FileSystem from "expo-file-system/legacy";
import type { InstantRoutingRuleRow } from "./instantRouterTypes";

const DB_NAME = "daemon-instant-router.db";
const ROUTING_SCHEMA_VERSION = 1;

const SEED_RULES: Omit<InstantRoutingRuleRow, "schemaVersion">[] = [
  {
    id: "rule-web-extract",
    priority: 10,
    enabled: true,
    name: "Explicit web / search phrasing",
    matcherType: "builtin",
    matcherValue: "web_extract",
    routeKind: "web",
    routePayloadJson: JSON.stringify({ querySource: "extracted", synthesizeAfter: false }),
  },
  {
    id: "rule-price-only",
    priority: 20,
    enabled: true,
    name: "Spot / quote price (Dex-first chain)",
    matcherType: "builtin",
    matcherValue: "price_only",
    routeKind: "price",
    routePayloadJson: JSON.stringify({ priceChain: ["dex_pair", "dex_token_pairs", "jupiter_usd", "duckduckgo"] }),
  },
  {
    id: "rule-onchain-auto",
    priority: 30,
    enabled: true,
    name: "Onchain analysis (/onchain or auto heuristics)",
    matcherType: "builtin",
    matcherValue: "onchain_auto",
    routeKind: "onchain",
    routePayloadJson: null,
  },
  {
    id: "rule-unknown-topic-web",
    priority: 40,
    enabled: true,
    name: "Fresh / out-of-weights factual topics → web-first",
    matcherType: "builtin",
    matcherValue: "unknown_topic_web",
    routeKind: "web",
    routePayloadJson: JSON.stringify({
      querySource: "prompt_trimmed",
      maxChars: 240,
      synthesizeAfter: false,
    }),
  },
];

type ExpoSqliteDb = {
  execAsync: (sql: string) => Promise<void>;
  runAsync: (sql: string, params?: (string | number)[]) => Promise<void>;
  getFirstAsync: <T>(sql: string) => Promise<T | null>;
  getAllAsync: <T>(sql: string) => Promise<T[]>;
};

type ExpoSqliteModule = { openDatabaseAsync: (name: string) => Promise<ExpoSqliteDb> };

let sqliteModule: ExpoSqliteModule | null | undefined;
let dbInstance: ExpoSqliteDb | null = null;
let memoryRules: InstantRoutingRuleRow[] | null = null;
let rulesCache: InstantRoutingRuleRow[] | null = null;

async function tryLoadSqlite(): Promise<ExpoSqliteModule | null> {
  if (sqliteModule !== undefined) return sqliteModule;
  try {
    sqliteModule = (await import("expo-sqlite")) as ExpoSqliteModule;
    return sqliteModule;
  } catch {
    sqliteModule = null;
    return null;
  }
}

function seedMemoryRules(): InstantRoutingRuleRow[] {
  return SEED_RULES.map((row) => ({ ...row, schemaVersion: ROUTING_SCHEMA_VERSION }));
}

async function migrate(db: ExpoSqliteDb) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS routing_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS routing_rules (
      id TEXT PRIMARY KEY NOT NULL,
      priority INTEGER NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      name TEXT NOT NULL,
      matcher_type TEXT NOT NULL,
      matcher_value TEXT NOT NULL,
      route_kind TEXT NOT NULL,
      route_payload_json TEXT,
      schema_version INTEGER NOT NULL DEFAULT ${ROUTING_SCHEMA_VERSION}
    );
    CREATE INDEX IF NOT EXISTS idx_routing_rules_priority ON routing_rules(priority ASC);
  `);
}

async function seedIfEmpty(db: ExpoSqliteDb) {
  const row = await db.getFirstAsync<{ c: number }>("SELECT COUNT(*) as c FROM routing_rules");
  if (row && row.c > 0) return;

  for (const rule of SEED_RULES) {
    await db.runAsync(
      `INSERT INTO routing_rules (id, priority, enabled, name, matcher_type, matcher_value, route_kind, route_payload_json, schema_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        rule.id,
        rule.priority,
        rule.enabled ? 1 : 0,
        rule.name,
        rule.matcherType,
        rule.matcherValue,
        rule.routeKind,
        rule.routePayloadJson ?? "",
        ROUTING_SCHEMA_VERSION,
      ],
    );
  }
  await db.runAsync("INSERT OR REPLACE INTO routing_meta (key, value) VALUES (?, ?)", [
    "schema_version",
    String(ROUTING_SCHEMA_VERSION),
  ]);
}

/**
 * Opens the SQLite DB (Expo sandbox), migrates, and seeds default routing rules once.
 * Falls back to in-memory rules if `expo-sqlite` is unavailable (e.g. broken install).
 */
export async function initInstantRouterStore(): Promise<void> {
  const SQLite = await tryLoadSqlite();
  if (!SQLite) {
    memoryRules = seedMemoryRules();
    rulesCache = null;
    return;
  }

  if (!dbInstance) {
    const dir = FileSystem.documentDirectory;
    if (dir) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => undefined);
    }
    dbInstance = await SQLite.openDatabaseAsync(DB_NAME);
    await migrate(dbInstance);
    await seedIfEmpty(dbInstance);
    rulesCache = null;
  }
}

function mapRow(r: Record<string, unknown>): InstantRoutingRuleRow {
  return {
    id: String(r.id),
    priority: Number(r.priority),
    enabled: Number(r.enabled) === 1,
    name: String(r.name),
    matcherType: r.matcher_type === "regex" ? "regex" : "builtin",
    matcherValue: String(r.matcher_value),
    routeKind: r.route_kind as InstantRoutingRuleRow["routeKind"],
    routePayloadJson: r.route_payload_json == null ? null : String(r.route_payload_json),
    schemaVersion: Number(r.schema_version ?? ROUTING_SCHEMA_VERSION),
  };
}

/** Ordered instant routing rules (lower priority number runs first). */
export async function loadRoutingRulesFromStore(): Promise<InstantRoutingRuleRow[]> {
  await initInstantRouterStore();

  if (rulesCache) return rulesCache.slice();

  if (memoryRules) {
    const snapshot = memoryRules.slice();
    rulesCache = snapshot;
    return snapshot.slice();
  }

  const SQLite = await tryLoadSqlite();
  if (!SQLite || !dbInstance) {
    memoryRules = seedMemoryRules();
    const snapshot = memoryRules.slice();
    rulesCache = snapshot;
    return snapshot.slice();
  }

  const rows = await dbInstance.getAllAsync<Record<string, unknown>>(
    "SELECT id, priority, enabled, name, matcher_type, matcher_value, route_kind, route_payload_json, schema_version FROM routing_rules ORDER BY priority ASC, id ASC",
  );
  const mapped = rows.map(mapRow);
  rulesCache = mapped;
  return mapped.slice();
}

/** Clears the in-process rule cache so the next load reads SQLite again. */
export function invalidateInstantRouterRuleCache() {
  memoryRules = null;
  rulesCache = null;
}
