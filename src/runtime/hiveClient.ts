import RPC from "bare-rpc";
import b4a from "b4a";
import { Worklet } from "react-native-bare-kit";
import hiveBundle from "../hive/hive.bundle.mjs";
import {
  APPEND_DATASET_SHARE,
  BROADCAST_CAPABILITIES,
  DELETE_MEDICAL_DATASET_SHARES,
  DELEGATE_PROVIDER_SELECTED,
  GET_DATASET_STATS,
  HIVE_STATUS,
  HIVE_TOPIC_LABEL,
  INIT_HIVE_STORAGE,
  JOIN_HIVE,
  LEAVE_HIVE,
} from "../hive/rpcCommands.mjs";
import type { HiveDatasetId, HiveDatasetShare } from "./hiveDatasets";

export type HiveCapabilities = {
  installedModelIds?: string[];
  supportedModelIds?: string[];
  toolAwareModelIds?: string[];
  reasoningTier?: string;
  batteryOptIn?: boolean;
  maxConcurrentJobs?: number;
  canProvideQvac?: boolean;
  providerPublicKey?: string | null;
  deviceLabel?: string;
  runtimeLabel?: string;
  pricePerHourUsd?: number;
  pricingLabel?: string;
  availabilityLabel?: string;
  mantleTrack?: string;
  agentIdentityStandard?: string;
  benchmarkingTarget?: string;
  transparencyMode?: string;
  enabledDatasetIds?: string[];
  datasetContributionManifest?: unknown;
  datasetCoreKeys?: Record<string, string>;
  pearStorageLabel?: string;
};

export type HiveStatus = {
  ok: boolean;
  label: string;
  topic: string;
  topicHash?: string;
  localPeerKey?: string | null;
  joined?: boolean;
  peerCount?: number;
  peers?: string[];
  peerCapabilities?: Record<string, HiveCapabilities & { updatedAt?: string }>;
  providerCandidates?: string[];
  datasetCoreKeys?: Record<string, string>;
  datasetShareCount?: number;
  datasetDataPointCount?: number;
  pearStorageLabel?: string;
  selectedProviderPublicKey?: string | null;
  lastError?: string | null;
  detail?: string;
};

export type HiveJoinOptions = {
  agentWalletAddress?: string;
  appVersion?: string;
  deviceLabel?: string;
  storageRoot?: string;
  capabilities?: HiveCapabilities;
};

export type HiveJoinResult = HiveStatus;

export type HiveDatasetStats = {
  ok: boolean;
  shareCount: number;
  dataPointCount: number;
  perDataset?: Record<
    string,
    {
      length: number;
      dataPointCount: number;
      key: string;
      discoveryKey: string;
    }
  >;
  coreKeys?: Record<string, string>;
};

export type HiveStorageInitResult = {
  ok: boolean;
  alreadyInitialized?: boolean;
  migration?: { imported: number; skipped: boolean; reason?: string };
  coreKeys?: Record<string, string>;
};

let worklet: Worklet | undefined;
let rpc: RPC | undefined;

function ensureHiveRpc() {
  if (rpc) return rpc;
  worklet = new Worklet();
  worklet.start("/hive.bundle", hiveBundle);
  rpc = new RPC(worklet.IPC, () => undefined);
  return rpc;
}

export async function initHiveStorage(storageRoot: string): Promise<HiveStorageInitResult> {
  return hiveRequest(INIT_HIVE_STORAGE, { storageRoot });
}

export async function appendHiveDatasetShare(datasetId: HiveDatasetId, share: HiveDatasetShare) {
  return hiveRequest(APPEND_DATASET_SHARE, { datasetId, share }) as Promise<{
    ok: boolean;
    shareCount?: number;
    dataPointCount?: number;
    length?: number;
  }>;
}

export async function getHiveDatasetStats(): Promise<HiveDatasetStats> {
  return hiveRequest(GET_DATASET_STATS, {});
}

export async function deleteHiveMedicalDatasetShares(): Promise<{
  ok: boolean;
  deletedCount: number;
  remainingCount: number;
  dataPointCount: number;
}> {
  return hiveRequest(DELETE_MEDICAL_DATASET_SHARES, {});
}

export async function joinHiveSwarm(options?: HiveJoinOptions | string): Promise<HiveJoinResult> {
  try {
    const payload = typeof options === "string" ? { agentWalletAddress: options } : options;
    return normalizeStatus(await hiveRequest(JOIN_HIVE, payload ?? {}));
  } catch (error) {
    return {
      ok: false,
      label: "Hive Swarm",
      detail: error instanceof Error ? error.message : String(error),
      topic: HIVE_TOPIC_LABEL,
    };
  }
}

export async function leaveHiveSwarm() {
  try {
    await hiveRequest(LEAVE_HIVE, {});
  } finally {
    rpc = undefined;
    worklet = undefined;
  }
}

export async function getHiveStatus(): Promise<HiveStatus> {
  return normalizeStatus(await hiveRequest(HIVE_STATUS, {}));
}

export async function broadcastHiveCapabilities(capabilities: HiveCapabilities): Promise<HiveStatus> {
  return normalizeStatus(await hiveRequest(BROADCAST_CAPABILITIES, { capabilities }));
}

export async function selectHiveDelegateProvider(providerPublicKey: string): Promise<HiveStatus> {
  return normalizeStatus(await hiveRequest(DELEGATE_PROVIDER_SELECTED, { providerPublicKey }));
}

async function hiveRequest(command: number, payload: unknown) {
  const client = ensureHiveRpc();
  const request = client.request(command);
  const reply = request.reply();
  request.send(b4a.from(JSON.stringify(payload ?? {})));
  const timeoutMs =
    command === JOIN_HIVE
      ? 15000
      : command === BROADCAST_CAPABILITIES
        ? 8000
        : command === INIT_HIVE_STORAGE
          ? 45000
          : command === APPEND_DATASET_SHARE
            ? 30000
            : command === GET_DATASET_STATS
              ? 8000
              : 15000;
  const response = await withTimeout(reply, timeoutMs);
  return parseResponse(response);
}

function parseResponse(response: unknown) {
  if (!response) return {};
  if (typeof response === "string") return JSON.parse(response);
  if (response instanceof Uint8Array) return JSON.parse(b4a.toString(response, "utf8"));
  return response;
}

function normalizeStatus(status: HiveStatus): HiveStatus {
  const peerCount = status.peerCount ?? status.peers?.length ?? 0;
  const datasetShareCount = status.datasetShareCount ?? 0;
  return {
    ...status,
    ok: status.ok !== false,
    label: status.label ?? "Hive Swarm",
    topic: status.topic ?? HIVE_TOPIC_LABEL,
    peerCount,
    detail:
      status.detail ??
      `Topic ${status.topicHash ? status.topicHash.slice(0, 12) : HIVE_TOPIC_LABEL} · peers ${peerCount} · shares ${datasetShareCount} · providers ${
        status.providerCandidates?.length ?? 0
      }${status.lastError ? ` · ${status.lastError}` : ""}`,
  };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise.finally(() => {
      if (timer) clearTimeout(timer);
    }),
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Hive RPC timed out")), timeoutMs);
    }),
  ]);
}
