import RPC from "bare-rpc";
import b4a from "b4a";
import Hyperswarm from "hyperswarm";
import crypto from "hypercore-crypto";
import {
  APPEND_DATASET_SHARE,
  BROADCAST_CAPABILITIES,
  DELETE_MEDICAL_DATASET_SHARES,
  DELEGATE_PROVIDER_SELECTED,
  GET_DATASET_STATS,
  HIVE_MESSAGE_TYPES,
  HIVE_PROTOCOL_VERSION,
  HIVE_STATUS,
  HIVE_TOPIC_LABEL,
  HIVE_TOPIC_SEED,
  HIVE_CORESTORE_TOPIC_SEED,
  INIT_HIVE_STORAGE,
  JOIN_HIVE,
  LEAVE_HIVE,
} from "./rpcCommands.mjs";
import {
  appendDatasetShare,
  closeDatasetStore,
  deleteMedicalDatasetShares,
  getDatasetCoreKeys,
  getDatasetShareStats,
  initHiveDatasetStorage,
  replicateDatasetStore,
} from "./hiveDatasetStore.mjs";

const MAX_MESSAGE_BYTES = 24 * 1024;
const { IPC } = BareKit;

let swarm;
let replicateSwarm;
let discovery;
let replicateDiscovery;
let localKeyPair;
let joined = false;
let lastError = null;
let latestJoinOptions = {};
let latestCapabilities = {};

const connections = new Map();
const peerCapabilities = new Map();
const providerCandidates = new Map();
const topic = crypto.hash(b4a.from(HIVE_TOPIC_SEED));
const topicHex = b4a.toString(topic, "hex");
const replicateTopic = crypto.hash(b4a.from(HIVE_CORESTORE_TOPIC_SEED));
const replicateTopicHex = b4a.toString(replicateTopic, "hex");

const rpc = new RPC(IPC, async (request) => {
  try {
    const payload = parseRequest(request.data);
    switch (request.command) {
      case INIT_HIVE_STORAGE:
        request.reply(encode(await initHiveDatasetStorage(payload?.storageRoot)));
        break;
      case APPEND_DATASET_SHARE:
        request.reply(encode(await appendDatasetShare(payload?.datasetId, payload?.share ?? {})));
        break;
      case GET_DATASET_STATS:
        request.reply(encode(await getDatasetShareStats()));
        break;
      case DELETE_MEDICAL_DATASET_SHARES:
        request.reply(encode(await deleteMedicalDatasetShares()));
        break;
      case JOIN_HIVE:
        request.reply(encode(await joinHive(payload)));
        break;
      case LEAVE_HIVE:
        request.reply(encode(await leaveHive()));
        break;
      case HIVE_STATUS:
        request.reply(encode(await status()));
        break;
      case BROADCAST_CAPABILITIES:
        latestCapabilities = payload?.capabilities ?? {};
        request.reply(encode(await status({ ok: true, event: "broadcast-accepted" })));
        void enqueueCapabilityBroadcast();
        break;
      case DELEGATE_PROVIDER_SELECTED:
        request.reply(encode(await selectProvider(payload?.providerPublicKey)));
        break;
      default:
        request.reply(encode({ ok: false, error: `Unknown Hive command: ${request.command}` }));
    }
  } catch (error) {
    request.reply(encode({ ok: false, error: error instanceof Error ? error.message : String(error) }));
  }
});

async function ensureDatasetStorage(options = {}) {
  const storageRoot = options.storageRoot ?? latestJoinOptions.storageRoot;
  if (!storageRoot) return null;
  return initHiveDatasetStorage(storageRoot);
}

async function enqueueCapabilityBroadcast() {
  try {
    if (!joined) {
      await joinHive({ capabilities: latestCapabilities });
      return;
    }
    await broadcastDatasetSummary();
    broadcastSigned(HIVE_MESSAGE_TYPES.capabilities, latestCapabilities);
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error);
  }
}

async function joinHive(options = {}) {
  latestJoinOptions = options ?? {};
  latestCapabilities = latestJoinOptions.capabilities ?? latestCapabilities;
  ensureSwarm();

  if (latestJoinOptions.storageRoot) {
    try {
      const initResult = await ensureDatasetStorage(latestJoinOptions);
      latestCapabilities = {
        ...latestCapabilities,
        datasetCoreKeys: initResult?.coreKeys ?? (await getDatasetCoreKeys().catch(() => ({}))),
        pearStorageLabel: "Pear Corestore / Hypercore",
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  if (!joined) {
    discovery = swarm.join(topic, { client: true, server: true });
    replicateDiscovery = ensureReplicateSwarm().join(replicateTopic, { client: true, server: true });
    try {
      await withTimeout(Promise.all([discovery.flushed(), replicateDiscovery.flushed()]), 4000);
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    joined = true;
  }

  broadcastHello();
  await broadcastDatasetSummary();
  broadcastSigned(HIVE_MESSAGE_TYPES.capabilities, latestCapabilities);
  return await status({ ok: true, event: "joined" });
}

async function leaveHive() {
  joined = false;
  discovery = null;
  replicateDiscovery = null;
  peerCapabilities.clear();
  providerCandidates.clear();
  for (const peer of connections.values()) {
    peer.socket.destroy?.();
  }
  connections.clear();
  await swarm?.destroy?.();
  swarm = null;
  await replicateSwarm?.destroy?.();
  replicateSwarm = null;
  await closeDatasetStore().catch(() => undefined);
  return await status({ ok: true, event: "left" });
}

function ensureReplicateSwarm() {
  if (replicateSwarm) return replicateSwarm;
  if (!localKeyPair) localKeyPair = crypto.keyPair();
  replicateSwarm = new Hyperswarm({ keyPair: localKeyPair });
  replicateSwarm.on("connection", (socket) => {
    replicateDatasetStore(socket);
  });
  replicateSwarm.on("error", (error) => {
    lastError = error instanceof Error ? error.message : String(error);
  });
  return replicateSwarm;
}

function ensureSwarm() {
  if (swarm) return swarm;
  if (!localKeyPair) localKeyPair = crypto.keyPair();
  swarm = new Hyperswarm({ keyPair: localKeyPair });
  swarm.on("connection", onConnection);
  swarm.on("error", (error) => {
    lastError = error instanceof Error ? error.message : String(error);
  });
  return swarm;
}

function onConnection(socket, info = {}) {
  const peerKey = publicKeyHex(info.publicKey) || `peer-${connections.size + 1}`;
  const record = { socket, info, peerKey, buffer: "" };
  connections.set(peerKey, record);

  socket.on("data", (chunk) => onPeerData(record, chunk));
  socket.on("close", () => removePeer(peerKey));
  socket.on("error", (error) => {
    lastError = error instanceof Error ? error.message : String(error);
    removePeer(peerKey);
  });

  broadcastHello(socket);
  sendSigned(socket, HIVE_MESSAGE_TYPES.capabilities, latestCapabilities);
  void broadcastDatasetSummary(socket);
}

function onPeerData(record, chunk) {
  record.buffer += b4a.toString(chunk, "utf8");
  if (record.buffer.length > MAX_MESSAGE_BYTES) {
    record.socket.destroy?.(new Error("Hive peer message exceeded size limit"));
    return;
  }

  const lines = record.buffer.split("\n");
  record.buffer = lines.pop() ?? "";
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      handlePeerMessage(record, JSON.parse(line));
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }
}

function handlePeerMessage(record, message) {
  if (!verifyMessage(message)) return;
  const peerKey = message.publicKey;
  if (message.type === HIVE_MESSAGE_TYPES.capabilities) {
    peerCapabilities.set(peerKey, { ...(message.body ?? {}), updatedAt: new Date().toISOString() });
    if (message.body?.providerPublicKey) providerCandidates.set(peerKey, message.body.providerPublicKey);
  }
  if (message.type === HIVE_MESSAGE_TYPES.memorySummary) {
    peerCapabilities.set(peerKey, {
      ...(peerCapabilities.get(peerKey) ?? {}),
      datasetCoreKeys: message.body?.datasetCoreKeys ?? {},
      pearStorageLabel: message.body?.pearStorageLabel ?? null,
      updatedAt: new Date().toISOString(),
    });
  }
  if (message.type === HIVE_MESSAGE_TYPES.delegateProvider && message.body?.providerPublicKey) {
    providerCandidates.set(peerKey, message.body.providerPublicKey);
  }
  connections.set(peerKey, { ...record, peerKey });
}

function removePeer(peerKey) {
  connections.delete(peerKey);
  peerCapabilities.delete(peerKey);
  providerCandidates.delete(peerKey);
}

async function broadcastDatasetSummary(socket) {
  try {
    const coreKeys = await getDatasetCoreKeys();
    const body = {
      datasetCoreKeys: coreKeys,
      pearStorageLabel: "Pear Corestore / Hypercore",
      storage: "pear-hypercore",
    };
    if (socket) sendSigned(socket, HIVE_MESSAGE_TYPES.memorySummary, body);
    else broadcastSigned(HIVE_MESSAGE_TYPES.memorySummary, body);
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error);
  }
}

function broadcastHello(socket) {
  sendSigned(socket, HIVE_MESSAGE_TYPES.hello, {
    appVersion: latestJoinOptions.appVersion ?? "0.1.0",
    agentWalletAddress: latestJoinOptions.agentWalletAddress ?? null,
    deviceLabel: latestJoinOptions.deviceLabel ?? "Android Daemon",
    protocolVersion: HIVE_PROTOCOL_VERSION,
  });
}

function broadcastSigned(type, body) {
  for (const { socket } of connections.values()) {
    sendSigned(socket, type, body);
  }
}

function sendSigned(socket, type, body) {
  if (!socket || !localKeyPair) return;
  const envelope = makeSignedMessage(type, body);
  socket.write(b4a.from(`${JSON.stringify(envelope)}\n`));
}

function makeSignedMessage(type, body) {
  const publicKey = publicKeyHex(localKeyPair.publicKey);
  const payload = { type, protocolVersion: HIVE_PROTOCOL_VERSION, body, publicKey };
  const signature = crypto.sign(b4a.from(JSON.stringify(payload)), localKeyPair.secretKey);
  return { ...payload, signature: b4a.toString(signature, "hex") };
}

function verifyMessage(message) {
  if (!message || message.protocolVersion !== HIVE_PROTOCOL_VERSION) return false;
  if (!message.publicKey || !message.signature || !message.type) return false;
  const payload = {
    type: message.type,
    protocolVersion: message.protocolVersion,
    body: message.body,
    publicKey: message.publicKey,
  };
  return crypto.verify(
    b4a.from(JSON.stringify(payload)),
    b4a.from(message.signature, "hex"),
    b4a.from(message.publicKey, "hex"),
  );
}

async function selectProvider(providerPublicKey) {
  const providerKnown = [...providerCandidates.values()].includes(providerPublicKey);
  return {
    ok: Boolean(providerPublicKey && providerKnown),
    selectedProviderPublicKey: providerKnown ? providerPublicKey : null,
    providerKnown,
    status: await status(),
  };
}

async function status(extra = {}) {
  let datasetStats = null;
  try {
    datasetStats = await getDatasetShareStats();
  } catch {
    datasetStats = null;
  }

  return {
    ok: true,
    label: "Hive Swarm",
    topic: HIVE_TOPIC_LABEL,
    topicHash: topicHex,
    replicateTopicHash: replicateTopicHex,
    localPeerKey: localKeyPair ? publicKeyHex(localKeyPair.publicKey) : null,
    joined,
    peerCount: connections.size,
    peers: [...connections.keys()],
    peerCapabilities: Object.fromEntries(peerCapabilities),
    providerCandidates: [...providerCandidates.values()],
    datasetCoreKeys: datasetStats?.coreKeys ?? latestCapabilities?.datasetCoreKeys ?? {},
    datasetShareCount: datasetStats?.shareCount ?? 0,
    datasetDataPointCount: datasetStats?.dataPointCount ?? 0,
    pearStorageLabel: latestCapabilities?.pearStorageLabel ?? "Pear Corestore / Hypercore",
    lastError,
    ...extra,
  };
}

function parseRequest(data) {
  if (!data) return {};
  const text = b4a.toString(data, "utf8");
  return text ? JSON.parse(text) : {};
}

function encode(value) {
  return b4a.from(JSON.stringify(value));
}

function publicKeyHex(key) {
  return key ? b4a.toString(key, "hex") : null;
}

function withTimeout(promise, timeoutMs) {
  let timer;
  return Promise.race([
    promise.finally(() => {
      if (timer) clearTimeout(timer);
    }),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Hive swarm flush timed out after ${timeoutMs}ms`)), timeoutMs);
    }),
  ]);
}

rpc.event(HIVE_STATUS).send(encode({ ok: true, label: "Hive Swarm", event: "ready" }));
