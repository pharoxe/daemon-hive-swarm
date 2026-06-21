import * as Device from "expo-device";
import {
  Accelerometer,
  Barometer,
  DeviceMotion,
  Gyroscope,
  LightSensor,
  Magnetometer,
  Pedometer,
} from "expo-sensors";
import * as FileSystem from "expo-file-system/legacy";

export type HiveDatasetId =
  | "motion-imu"
  | "activity-pedometer"
  | "environment-context"
  | "network-quality"
  | "device-performance"
  | "app-usage-preferences"
  | "medical-reports";

export type HiveDatasetDefinition = {
  id: HiveDatasetId;
  name: string;
  category: "Sensors" | "Device" | "Medical";
  summary: string;
  fields: string[];
  anonymization: string;
  cadence: string;
  sampleDataPointCount: number;
  privacyGuarantees?: string[];
  requiresUsageAccess?: boolean;
  requiresPicker?: boolean;
};

export type HiveDatasetShare = {
  datasetId: HiveDatasetId;
  sharedAtBucket: string;
  storage: "pear-hypercore";
  anonymized: true;
  nodeProfile: {
    platform: string;
    osMajor: string;
    deviceClass: string;
  };
  payloadSchema: string[];
  sensorAvailability?: Record<string, boolean | "unknown">;
  payload?: Record<string, unknown>;
  privacy: string;
  privacyGuarantees: string[];
  dataPointCount: number;
};

export const defaultPrivacyGuarantees = [
  "No exact timestamps: shares use coarse 6-hour time buckets.",
  "No exact GPS: records expose only city-level or geohash-style coarse buckets when location is ever added.",
  "Medical records are user-deletable from the local Pear/Holepunch share log.",
];

export const hiveDatasets: HiveDatasetDefinition[] = [
  {
    id: "motion-imu",
    name: "Motion IMU",
    category: "Sensors",
    summary: "Accelerometer, gyroscope, and coarse device-motion feature windows for mobility and context models.",
    fields: ["acceleration buckets", "rotation-rate buckets", "orientation class", "sampling quality"],
    anonymization: "Raw streams are reduced on-device into rounded feature windows; no timestamps finer than the hour.",
    cadence: "15 sec windows while enabled",
    sampleDataPointCount: 24,
    privacyGuarantees: defaultPrivacyGuarantees,
  },
  {
    id: "activity-pedometer",
    name: "Activity + Steps",
    category: "Sensors",
    summary: "Pedometer deltas and coarse activity intensity for wellness, commute, and routine-pattern agents.",
    fields: ["step-count buckets", "cadence bucket", "active/resting label", "hour band"],
    anonymization: "Counts are bucketed, location is never included, and daily totals are randomized within a small range.",
    cadence: "Hourly aggregates",
    sampleDataPointCount: 12,
    privacyGuarantees: defaultPrivacyGuarantees,
  },
  {
    id: "environment-context",
    name: "Environment Context",
    category: "Sensors",
    summary: "Ambient light, barometer, and magnetometer/compass features for local environmental context.",
    fields: ["light bucket", "pressure trend", "heading stability", "indoor/outdoor confidence"],
    anonymization: "Only coarse buckets and trends are shared; exact readings and coordinates are discarded.",
    cadence: "5 min aggregates",
    sampleDataPointCount: 12,
    privacyGuarantees: defaultPrivacyGuarantees,
  },
  {
    id: "network-quality",
    name: "Network Quality",
    category: "Device",
    summary: "Connectivity class and latency buckets for routing swarm work to reliable phones.",
    fields: ["connection class", "latency bucket", "packet-loss bucket", "carrier hidden"],
    anonymization: "IP address, SSID, BSSID, carrier, and nearby network identifiers are never stored.",
    cadence: "On swarm heartbeat",
    sampleDataPointCount: 8,
    privacyGuarantees: defaultPrivacyGuarantees,
  },
  {
    id: "device-performance",
    name: "Inference Performance",
    category: "Device",
    summary: "Local model load, token, thermal, and battery-safe capability signals for benchmark routing.",
    fields: ["model id", "tokens/sec bucket", "memory tier", "thermal/battery-safe flag"],
    anonymization: "Device names are replaced with broad platform and OS-major classes before sharing.",
    cadence: "After local benchmark runs",
    sampleDataPointCount: 10,
    privacyGuarantees: defaultPrivacyGuarantees,
  },
  {
    id: "app-usage-preferences",
    name: "App Usage + Preferences",
    category: "Device",
    summary: "Permission-gated app category/session buckets and local preference signals for personal-agent routing.",
    fields: [
      "foreground app category bucket",
      "session length bucket",
      "notification interaction bucket",
      "daypart bucket",
      "enabled tool ids",
      "model preference bucket",
      "privacy mode preference",
      "dataset opt-in summary",
    ],
    anonymization:
      "Package names, exact app names, exact launch times, account identifiers, notification text, and raw preference values are never shared.",
    cadence: "Daily coarse aggregates after Usage Access approval",
    sampleDataPointCount: 20,
    privacyGuarantees: defaultPrivacyGuarantees,
    requiresUsageAccess: true,
  },
  {
    id: "medical-reports",
    name: "Medical Reports",
    category: "Medical",
    summary: "User-picked reports processed locally into de-identified timelines, lab ranges, and document metadata.",
    fields: ["report type", "finding category", "normalized range bucket", "timeline offset"],
    anonymization: "Names, IDs, exact dates, addresses, clinicians, facilities, and free text are removed before sharing.",
    cadence: "Only after file picker consent",
    sampleDataPointCount: 18,
    privacyGuarantees: [
      ...defaultPrivacyGuarantees,
      "Medical documents are reduced to de-identified ranges, categories, and embedding-derived summaries before any share record is written.",
    ],
    requiresPicker: true,
  },
];

export function getHiveDataset(id: HiveDatasetId) {
  return hiveDatasets.find((dataset) => dataset.id === id);
}

export function buildDatasetContributionManifest(
  enabledDatasetIds: Iterable<HiveDatasetId>,
  coreKeys?: Record<string, string>,
) {
  const ids = Array.from(new Set(enabledDatasetIds));
  return {
    storage: "Pear Corestore / Hypercore",
    anonymized: true,
    enabledDatasetIds: ids,
    datasetCoreKeys: coreKeys ?? {},
    datasets: ids
      .map((id) => getHiveDataset(id))
      .filter(Boolean)
      .map((dataset) => ({
        id: dataset!.id,
        name: dataset!.name,
        category: dataset!.category,
        fields: dataset!.fields,
        cadence: dataset!.cadence,
        anonymization: dataset!.anonymization,
        privacyGuarantees: dataset!.privacyGuarantees ?? defaultPrivacyGuarantees,
        coreKey: coreKeys?.[dataset!.id] ?? null,
      })),
    privacyGuarantees: defaultPrivacyGuarantees,
  };
}

export function getHiveStorageRoot() {
  return (FileSystem.documentDirectory ?? "").replace(/^file:\/\//, "").replace(/\/$/, "");
}

let storageReady: Promise<{ coreKeys?: Record<string, string> }> | null = null;

export async function ensureHiveDatasetStorage() {
  if (!storageReady) {
    storageReady = (async () => {
      const { initHiveStorage } = await import("./hiveClient");
      return initHiveStorage(getHiveStorageRoot());
    })();
  }
  return storageReady;
}

export async function getHiveDatasetCoreKeys(): Promise<Record<string, string>> {
  const init = await ensureHiveDatasetStorage();
  if (init.coreKeys) return init.coreKeys;
  const { getHiveDatasetStats } = await import("./hiveClient");
  const stats = await getHiveDatasetStats();
  return stats.coreKeys ?? {};
}

export async function persistAnonymizedDatasetShare(
  datasetId: HiveDatasetId,
  options?: { payload?: Record<string, unknown>; dataPointCount?: number },
): Promise<HiveDatasetShare & { shareCount?: number; dataPointCountTotal?: number }> {
  const dataset = getHiveDataset(datasetId);
  if (!dataset) throw new Error(`Unknown Hive dataset: ${datasetId}`);

  const sensorPayload =
    options?.payload ?? (datasetId !== "medical-reports" ? await import("./sensorSnapshot").then((m) => m.collectSensorPayload(datasetId)) : undefined);

  const share: HiveDatasetShare = {
    datasetId,
    sharedAtBucket: timeBucket(new Date()),
    storage: "pear-hypercore",
    anonymized: true,
    nodeProfile: {
      platform: Device.osName ?? "Android",
      osMajor: String(Device.osVersion ?? "unknown").split(".")[0] ?? "unknown",
      deviceClass: Device.deviceType ? `type-${Device.deviceType}` : "phone",
    },
    payloadSchema: dataset.fields,
    sensorAvailability: await getSensorAvailability(datasetId),
    payload: sensorPayload,
    privacy: dataset.anonymization,
    privacyGuarantees: dataset.privacyGuarantees ?? defaultPrivacyGuarantees,
    dataPointCount: options?.dataPointCount ?? (sensorPayload ? Object.keys(sensorPayload).length || dataset.sampleDataPointCount : dataset.sampleDataPointCount),
  };

  await ensureHiveDatasetStorage();
  const { appendHiveDatasetShare } = await import("./hiveClient");
  const result = await appendHiveDatasetShare(datasetId, share);
  return {
    ...share,
    shareCount: result.shareCount,
    dataPointCountTotal: result.dataPointCount,
  };
}

export async function deleteMedicalDatasetShares(): Promise<{ deletedCount: number; remainingCount: number; dataPointCount: number }> {
  await ensureHiveDatasetStorage();
  const { deleteHiveMedicalDatasetShares } = await import("./hiveClient");
  const result = await deleteHiveMedicalDatasetShares();
  return {
    deletedCount: result.deletedCount ?? 0,
    remainingCount: result.remainingCount ?? 0,
    dataPointCount: result.dataPointCount ?? 0,
  };
}

export async function readHiveDatasetShareStats(): Promise<{ shareCount: number; dataPointCount: number }> {
  try {
    await ensureHiveDatasetStorage();
    const { getHiveDatasetStats } = await import("./hiveClient");
    const stats = await getHiveDatasetStats();
    return {
      shareCount: stats.shareCount ?? 0,
      dataPointCount: stats.dataPointCount ?? 0,
    };
  } catch {
    return { shareCount: 0, dataPointCount: 0 };
  }
}

async function getSensorAvailability(datasetId: HiveDatasetId): Promise<Record<string, boolean | "unknown"> | undefined> {
  if (datasetId === "motion-imu") {
    const availability: Record<string, boolean | "unknown"> = {
      accelerometer: await available(() => Accelerometer.isAvailableAsync()),
      gyroscope: await available(() => Gyroscope.isAvailableAsync()),
      deviceMotion: await available(() => DeviceMotion.isAvailableAsync()),
    };
    return availability;
  }

  if (datasetId === "activity-pedometer") {
    const availability: Record<string, boolean | "unknown"> = {
      pedometer: await available(() => Pedometer.isAvailableAsync()),
    };
    return availability;
  }

  if (datasetId === "environment-context") {
    const availability: Record<string, boolean | "unknown"> = {
      ambientLight: await available(() => LightSensor.isAvailableAsync()),
      barometer: await available(() => Barometer.isAvailableAsync()),
      magnetometer: await available(() => Magnetometer.isAvailableAsync()),
    };
    return availability;
  }

  return undefined;
}

function timeBucket(date: Date) {
  const bucketHour = Math.floor(date.getUTCHours() / 6) * 6;
  return `${date.toISOString().slice(0, 10)}T${String(bucketHour).padStart(2, "0")}:00Z-6h`;
}

async function available(check: () => Promise<boolean>) {
  try {
    return await check();
  } catch {
    return "unknown" as const;
  }
}
