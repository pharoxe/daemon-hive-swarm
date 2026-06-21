import * as FileSystem from "expo-file-system/legacy";

export type StoredChatMessage = { role: "user" | "agent"; text: string };
export type StoredChatThread = {
  id: string;
  title: string;
  messages: StoredChatMessage[];
  createdAt: string;
  updatedAt: string;
};

export type CredentialsVault = {
  telegramBotToken: string;
  solanaRpcUrl: string;
  openaiApiKey: string;
  anthropicApiKey: string;
  geminiApiKey: string;
  openRouterApiKey: string;
  customApiName: string;
  customApiKey: string;
  /** Google Programmable Search Engine (Custom Search JSON API) */
  googleCustomSearchApiKey: string;
  /** Search engine ID (cx) from programmablesearchengine.google.com */
  googleSearchEngineId: string;
};

export type StoredDaemonState = {
  chatMessages?: StoredChatMessage[];
  chatThreads?: StoredChatThread[];
  activeChatId?: string;
  credentialsVault?: Partial<CredentialsVault>;
  onboardingComplete?: boolean;
  activeModelId?: string;
  installedModelIds?: string[];
  backgroundMode?: boolean;
  hiveJoined?: boolean;
  enabledHiveDatasetIds?: string[];
  agentWalletSecretKey?: number[];
  /** User preference for Fabric GPU inference when the build supports it. */
  fabricGpuEnabled?: boolean;
  /** Cached startup GPU profile (`mali_vulkan`, `adreno_opencl`, `cpu_safe`). */
  deviceGpuProfileId?: string;
};

export const defaultCredentialsVault: CredentialsVault = {
  telegramBotToken: "",
  solanaRpcUrl: "",
  openaiApiKey: "",
  anthropicApiKey: "",
  geminiApiKey: "",
  openRouterApiKey: "",
  customApiName: "",
  customApiKey: "",
  googleCustomSearchApiKey: "",
  googleSearchEngineId: "",
};

const storagePath = `${FileSystem.documentDirectory ?? ""}daemon-state.json`;

export async function readDaemonState(): Promise<StoredDaemonState> {
  try {
    const info = await FileSystem.getInfoAsync(storagePath);
    if (!info.exists) return {};
    const raw = await FileSystem.readAsStringAsync(storagePath);
    return JSON.parse(raw) as StoredDaemonState;
  } catch (error) {
    console.warn("[DaemonStore] read failed", error);
    return {};
  }
}

export async function writeDaemonState(patch: StoredDaemonState) {
  const current = await readDaemonState();
  const next: StoredDaemonState = {
    ...current,
    ...patch,
    credentialsVault: {
      ...current.credentialsVault,
      ...patch.credentialsVault,
    },
  };
  await FileSystem.writeAsStringAsync(storagePath, JSON.stringify(next, null, 2));
}

export function mergeCredentialsVault(vault?: Partial<CredentialsVault>): CredentialsVault {
  return { ...defaultCredentialsVault, ...(vault ?? {}) };
}
