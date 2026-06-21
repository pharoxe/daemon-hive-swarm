import type { DeviceGpuProfileId, GpuBackendPreference } from "./deviceGpuProfile";

/** User preference for Fabric GPU offload (when the build enables GPU). Synced from app state / local store. */
let fabricGpuUserEnabled = false;

/** Per-model probe: false = GPU load profile does not accelerate decode on this device. */
const gpuDecodeEffectiveByModelId = new Map<string, boolean>();

/** Progressive GPU layer tier index (0=1, 1=2, 2=4, 3=8, 4=16, 5=32, 6=env max). */
const gpuLayerTierByModelId = new Map<string, number>();

let activeGpuProfile: DeviceGpuProfileId = "cpu_safe";
let preferredGpuBackend: GpuBackendPreference = "auto";

const GPU_LAYER_TIERS = [1, 2, 4, 8, 16, 32] as const;

const PROFILE_GPU_LAYER_CAP: Record<DeviceGpuProfileId, number> = {
  mali_vulkan: 16,
  adreno_opencl: 99,
  cpu_safe: 0,
};

const PROFILE_DEFAULT_FABRIC_GPU: Record<DeviceGpuProfileId, boolean> = {
  mali_vulkan: false,
  adreno_opencl: true,
  cpu_safe: false,
};

export function applyDeviceGpuProfile(profileId: DeviceGpuProfileId, backend: GpuBackendPreference) {
  activeGpuProfile = profileId;
  preferredGpuBackend = backend;
}

export function getActiveGpuProfile(): DeviceGpuProfileId {
  return activeGpuProfile;
}

export function getPreferredGpuBackend(): GpuBackendPreference {
  return preferredGpuBackend;
}

export function getDefaultFabricGpuForProfile(profileId: DeviceGpuProfileId = activeGpuProfile): boolean {
  return PROFILE_DEFAULT_FABRIC_GPU[profileId];
}

export function getProfileGpuLayersCap(profileId: DeviceGpuProfileId = activeGpuProfile): number {
  return PROFILE_GPU_LAYER_CAP[profileId];
}

export function getProgressiveGpuLayers(modelId: string, envMaxLayers: number): number {
  const cap = getProfileGpuLayersCap();
  if (cap <= 0) return 0;
  const tierIndex = gpuLayerTierByModelId.get(modelId) ?? 0;
  const tierLayers = GPU_LAYER_TIERS[Math.min(tierIndex, GPU_LAYER_TIERS.length - 1)] ?? 8;
  const maxTarget = Math.min(envMaxLayers, cap === 99 ? envMaxLayers : cap);
  if (tierIndex >= GPU_LAYER_TIERS.length) return maxTarget;
  return Math.min(tierLayers, maxTarget);
}

export function noteGpuLayerDecodeSuccess(modelId: string, envMaxLayers: number) {
  const cap = getProfileGpuLayersCap();
  const maxTarget = Math.min(envMaxLayers, cap === 99 ? envMaxLayers : cap);
  const current = gpuLayerTierByModelId.get(modelId) ?? 0;
  const currentLayers = getProgressiveGpuLayers(modelId, envMaxLayers);
  if (currentLayers >= maxTarget) {
    gpuLayerTierByModelId.set(modelId, GPU_LAYER_TIERS.length);
    return;
  }
  gpuLayerTierByModelId.set(modelId, Math.min(current + 1, GPU_LAYER_TIERS.length));
}

export function resetGpuLayerTier(modelId?: string) {
  if (modelId) gpuLayerTierByModelId.delete(modelId);
  else gpuLayerTierByModelId.clear();
}

export function setFabricGpuUserEnabled(enabled: boolean) {
  fabricGpuUserEnabled = enabled;
  if (enabled) {
    gpuDecodeEffectiveByModelId.clear();
    gpuLayerTierByModelId.clear();
  }
}

export function isFabricGpuUserEnabled() {
  return fabricGpuUserEnabled;
}

export function setGpuDecodeEffective(modelId: string, effective: boolean) {
  gpuDecodeEffectiveByModelId.set(modelId, effective);
}

export function isGpuDecodeEffective(modelId: string): boolean | undefined {
  return gpuDecodeEffectiveByModelId.get(modelId);
}

export function shouldSkipGpuLoad(modelId: string) {
  return gpuDecodeEffectiveByModelId.get(modelId) === false;
}

export function resetGpuDecodeProbe(modelId?: string) {
  if (modelId) {
    gpuDecodeEffectiveByModelId.delete(modelId);
    gpuLayerTierByModelId.delete(modelId);
  } else {
    gpuDecodeEffectiveByModelId.clear();
    gpuLayerTierByModelId.clear();
  }
}

export function gpuDecodeStatusLabel(modelId: string) {
  const effective = gpuDecodeEffectiveByModelId.get(modelId);
  if (effective === true) return "GPU decode active";
  if (effective === false) return "GPU load only — decode on CPU";
  return undefined;
}

export function gpuProfileHaHint(profileId: DeviceGpuProfileId = activeGpuProfile): string {
  if (profileId === "mali_vulkan") {
    return "Mali/MediaTek: CPU path is the default because this device has crashed during Vulkan backend allocation. Turn HA on only for profiling.";
  }
  if (profileId === "adreno_opencl") {
    return "Adreno/Qualcomm: OpenCL offload with full layer count when drivers allow.";
  }
  return "Unknown GPU class: CPU path recommended until profile improves.";
}
