import fs from "bare-fs";
import path from "bare-path";
import b4a from "b4a";
import Corestore from "corestore";
import { datasetCoreName, HIVE_DATASET_IDS } from "./datasetCoreIds.mjs";

let store = null;
let storageRoot = null;
let migrationPromise = null;
const cores = new Map();

const statsCache = {
  shareCount: 0,
  dataPointCount: 0,
  perDataset: {},
};

function ensureDir(target) {
  fs.mkdirSync(target, { recursive: true });
}

function jsonlPath(root) {
  return path.join(root, "pear-holepunch", "hive-dataset-shares.jsonl");
}

function migrationMarkerPath(root) {
  return path.join(root, "pear-holepunch", "hive-dataset-shares.jsonl.corestore-migrated");
}

function corestorePath(root) {
  return path.join(root, "pear-holepunch", "corestore");
}

function ensureDatasetCacheEntry(datasetId) {
  if (!statsCache.perDataset[datasetId]) {
    statsCache.perDataset[datasetId] = { length: 0, dataPointCount: 0 };
  }
  return statsCache.perDataset[datasetId];
}

function noteAppend(datasetId, share, length) {
  const dataPoints = typeof share?.dataPointCount === "number" ? share.dataPointCount : 1;
  const entry = ensureDatasetCacheEntry(datasetId);
  const previousLength = entry.length;
  entry.length = length;
  entry.dataPointCount += dataPoints;
  statsCache.shareCount += length > previousLength ? length - previousLength : 0;
  statsCache.dataPointCount += dataPoints;
}

function noteMedicalTruncate(deletedCount, deletedDataPoints) {
  const entry = ensureDatasetCacheEntry("medical-reports");
  entry.length = 0;
  entry.dataPointCount = 0;
  statsCache.shareCount = Math.max(0, statsCache.shareCount - deletedCount);
  statsCache.dataPointCount = Math.max(0, statsCache.dataPointCount - deletedDataPoints);
}

async function openAllCores() {
  await Promise.all(
    HIVE_DATASET_IDS.map(async (datasetId) => {
      if (cores.has(datasetId)) return;
      const core = store.get({ name: datasetCoreName(datasetId), valueEncoding: "json" });
      await core.ready();
      cores.set(datasetId, core);
      const entry = ensureDatasetCacheEntry(datasetId);
      entry.length = core.length;
    }),
  );
}

async function refreshStatsCacheFromCores() {
  await openAllCores();
  let shareCount = 0;
  let dataPointCount = 0;

  for (const datasetId of HIVE_DATASET_IDS) {
    const core = cores.get(datasetId);
    const length = core?.length ?? 0;
    let datasetDataPoints = 0;
    if (length > 0 && length <= 64) {
      for (let index = 0; index < length; index += 1) {
        const block = await core.get(index);
        datasetDataPoints += typeof block?.dataPointCount === "number" ? block.dataPointCount : 1;
      }
    } else {
      datasetDataPoints = length;
    }
    statsCache.perDataset[datasetId] = { length, dataPointCount: datasetDataPoints };
    shareCount += length;
    dataPointCount += datasetDataPoints;
  }

  statsCache.shareCount = shareCount;
  statsCache.dataPointCount = dataPointCount;
}

export async function initHiveDatasetStorage(root) {
  if (!root) throw new Error("Hive storage root is required");
  storageRoot = root.replace(/\/$/, "");
  if (store) {
    return {
      ok: true,
      alreadyInitialized: true,
      migration: { imported: 0, skipped: true },
      coreKeys: await getDatasetCoreKeys(),
      shareCount: statsCache.shareCount,
      dataPointCount: statsCache.dataPointCount,
    };
  }

  const dir = corestorePath(storageRoot);
  ensureDir(dir);
  store = new Corestore(dir);
  await store.ready();
  await openAllCores();

  if (!migrationPromise) {
    migrationPromise = migrateJsonlIfNeeded().catch(() => ({ imported: 0, skipped: true, reason: "migration-failed" }));
  }
  void refreshStatsCacheFromCores().catch(() => undefined);

  return {
    ok: true,
    migration: { imported: 0, skipped: false, reason: "background" },
    coreKeys: await getDatasetCoreKeys(),
    shareCount: statsCache.shareCount,
    dataPointCount: statsCache.dataPointCount,
  };
}

async function ensureStore() {
  if (store) return store;
  if (!storageRoot) throw new Error("Hive Corestore is not initialized");
  await initHiveDatasetStorage(storageRoot);
  return store;
}

async function getCore(datasetId) {
  if (!HIVE_DATASET_IDS.includes(datasetId)) {
    throw new Error(`Unknown Hive dataset: ${datasetId}`);
  }
  await ensureStore();
  if (cores.has(datasetId)) return cores.get(datasetId);
  const core = store.get({ name: datasetCoreName(datasetId), valueEncoding: "json" });
  await core.ready();
  cores.set(datasetId, core);
  return core;
}

export async function appendDatasetShare(datasetId, share) {
  const core = await getCore(datasetId);
  await core.append(share);
  noteAppend(datasetId, share, core.length);
  return {
    ok: true,
    datasetId,
    length: core.length,
    key: b4a.toString(core.key, "hex"),
    discoveryKey: b4a.toString(core.discoveryKey, "hex"),
    shareCount: statsCache.shareCount,
    dataPointCount: statsCache.dataPointCount,
  };
}

export async function getDatasetShareStats() {
  await ensureStore();
  const perDataset = {};
  for (const datasetId of HIVE_DATASET_IDS) {
    const core = cores.get(datasetId) ?? (await getCore(datasetId));
    const cached = ensureDatasetCacheEntry(datasetId);
    cached.length = core.length;
    perDataset[datasetId] = {
      length: cached.length,
      dataPointCount: cached.dataPointCount,
      key: b4a.toString(core.key, "hex"),
      discoveryKey: b4a.toString(core.discoveryKey, "hex"),
    };
  }

  return {
    ok: true,
    shareCount: statsCache.shareCount,
    dataPointCount: statsCache.dataPointCount,
    perDataset,
    coreKeys: await getDatasetCoreKeys(),
  };
}

export async function getDatasetCoreKeys() {
  if (!store) return {};
  const keys = {};
  for (const datasetId of HIVE_DATASET_IDS) {
    const core = cores.get(datasetId);
    if (!core) continue;
    keys[datasetId] = b4a.toString(core.key, "hex");
  }
  if (Object.keys(keys).length === HIVE_DATASET_IDS.length) return keys;

  await openAllCores();
  for (const datasetId of HIVE_DATASET_IDS) {
    const core = cores.get(datasetId);
    keys[datasetId] = b4a.toString(core.key, "hex");
  }
  return keys;
}

export async function deleteMedicalDatasetShares() {
  await ensureStore();
  const core = await getCore("medical-reports");
  const deletedCount = core.length;
  const deletedDataPoints = ensureDatasetCacheEntry("medical-reports").dataPointCount;
  if (deletedCount > 0) {
    await core.truncate(0);
  }
  cores.delete("medical-reports");
  noteMedicalTruncate(deletedCount, deletedDataPoints);

  return {
    ok: true,
    deletedCount,
    remainingCount: statsCache.shareCount,
    dataPointCount: statsCache.dataPointCount,
  };
}

async function migrateJsonlIfNeeded() {
  const marker = migrationMarkerPath(storageRoot);
  if (fs.existsSync(marker)) {
    return { imported: 0, skipped: true, reason: "already-migrated" };
  }

  const source = jsonlPath(storageRoot);
  if (!fs.existsSync(source)) {
    fs.writeFileSync(marker, `${new Date().toISOString()}\n`);
    return { imported: 0, skipped: true, reason: "no-jsonl" };
  }

  const raw = fs.readFileSync(source, "utf8");
  const lines = raw.split("\n").map((line) => line.trim()).filter(Boolean);
  let imported = 0;

  for (const line of lines) {
    try {
      const share = JSON.parse(line);
      if (!share?.datasetId || !HIVE_DATASET_IDS.includes(share.datasetId)) continue;
      await appendDatasetShare(share.datasetId, { ...share, storage: "pear-hypercore" });
      imported += 1;
    } catch {
      // Skip malformed legacy lines.
    }
  }

  fs.writeFileSync(marker, `${new Date().toISOString()}\nimported=${imported}\n`);
  await refreshStatsCacheFromCores().catch(() => undefined);
  return { imported, skipped: false, reason: "jsonl-import" };
}

export function replicateDatasetStore(socket) {
  if (!store || !socket) return;
  store.replicate(socket, { live: true });
}

export async function closeDatasetStore() {
  cores.clear();
  migrationPromise = null;
  statsCache.shareCount = 0;
  statsCache.dataPointCount = 0;
  statsCache.perDataset = {};
  if (!store) return;
  const closing = store;
  store = null;
  storageRoot = null;
  await closing.close();
}
