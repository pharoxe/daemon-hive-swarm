import * as Device from "expo-device";
import { Platform } from "react-native";
import { env } from "../config/env";
import type { StoredDaemonState } from "./localStore";

export type DeviceGpuProfileId = "mali_vulkan" | "adreno_opencl" | "cpu_safe";
export type GpuBackendPreference = "vulkan" | "opencl" | "auto";

export type DeviceGpuProbe = {
  profileId: DeviceGpuProfileId;
  preferredBackend: GpuBackendPreference;
  label: string;
  signals: {
    platform: string;
    brand: string;
    manufacturer: string;
    modelName: string;
    osVersion: string;
    totalMemoryMb?: number;
  };
};

const PROFILE_LABELS: Record<DeviceGpuProfileId, string> = {
  mali_vulkan: "Mali / MediaTek (Vulkan)",
  adreno_opencl: "Adreno / Qualcomm (OpenCL)",
  cpu_safe: "CPU-safe (unknown GPU)",
};

function envProfileOverride(): DeviceGpuProfileId | undefined {
  const raw = String(process.env.EXPO_PUBLIC_DAEMON_GPU_PROFILE || "").trim().toLowerCase();
  if (raw === "mali_vulkan" || raw === "adreno_opencl" || raw === "cpu_safe") return raw;
  return undefined;
}

function classifyFromSignals(manufacturer: string, brand: string, modelName: string): DeviceGpuProfileId {
  const blob = `${manufacturer} ${brand} ${modelName}`.toLowerCase();
  if (/qualcomm|snapdragon|adreno|\bsm[0-9]{4}\b/.test(blob)) return "adreno_opencl";
  if (/mediatek|dimensity|\bmt[0-9]{4}\b|mali|oneplus|oppo|realme|vivo|infinix|tecno/.test(blob)) {
    return "mali_vulkan";
  }
  if (/exynos|samsung.*galaxy/.test(blob) && !/snapdragon/.test(blob)) return "mali_vulkan";
  return "cpu_safe";
}

function preferredBackendForProfile(profileId: DeviceGpuProfileId): GpuBackendPreference {
  if (profileId === "mali_vulkan") return "vulkan";
  if (profileId === "adreno_opencl") return "opencl";
  return "auto";
}

export function probeDeviceGpuProfile(stored?: Pick<StoredDaemonState, "deviceGpuProfileId">): DeviceGpuProbe {
  const override = envProfileOverride();
  const brand = Device.brand ?? "unknown";
  const manufacturer = Device.manufacturer ?? "unknown";
  const modelName = Device.modelName ?? Device.deviceName ?? "unknown";
  const platform = Platform.OS;
  const osVersion = Device.osVersion ?? "unknown";
  const totalMemoryMb = Device.totalMemory ? Math.round(Device.totalMemory / 1024 / 1024) : undefined;

  let profileId: DeviceGpuProfileId =
    override ??
    (stored?.deviceGpuProfileId as DeviceGpuProfileId | undefined) ??
    (platform === "android" ? classifyFromSignals(manufacturer, brand, modelName) : "cpu_safe");

  if (!override && platform !== "android") profileId = "cpu_safe";

  const preferredBackend =
    env.androidGpuBackend === "opencl" || env.androidGpuBackend === "vulkan"
      ? env.androidGpuBackend
      : preferredBackendForProfile(profileId);

  const probe: DeviceGpuProbe = {
    profileId,
    preferredBackend,
    label: PROFILE_LABELS[profileId],
    signals: { platform, brand, manufacturer, modelName, osVersion, totalMemoryMb },
  };

  console.log("[DaemonGpuProfile]", probe.profileId, probe.preferredBackend, probe.signals);
  return probe;
}

export function gpuProfileSummary(probe: DeviceGpuProbe): string {
  const mem = probe.signals.totalMemoryMb ? `${probe.signals.totalMemoryMb} MB RAM` : "RAM unknown";
  const packaging = env.androidGpuBackend;
  if (probe.profileId === "mali_vulkan" && packaging === "opencl") {
    return `${probe.label} · OpenCL-only package is not recommended for this device · ${probe.signals.modelName}`;
  }
  return `${probe.label} · ${probe.signals.manufacturer} ${probe.signals.modelName} · ${mem} · pkg=${packaging}`;
}
