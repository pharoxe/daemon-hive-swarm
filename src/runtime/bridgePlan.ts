export type BridgeTask = {
  id: string;
  title: string;
  owner: "android-app" | "local-runtime" | "qvac" | "spectrum";
  status: "prototype" | "next";
};

export const bridgePlan: BridgeTask[] = [
  {
    id: "runtime-status",
    title: "Detect Daemon local runtime and background policy status",
    owner: "local-runtime",
    status: "next",
  },
  {
    id: "qvac-download",
    title: "Start, pause, and resume QVAC model add-on downloads",
    owner: "qvac",
    status: "next",
  },
  {
    id: "telegram-gateway",
    title: "Store Telegram bot token locally and launch Daemon channel bridge",
    owner: "local-runtime",
    status: "next",
  },
  {
    id: "spectrum-imessage",
    title: "Issue Photon credentials and connect the Spectrum iMessage provider",
    owner: "spectrum",
    status: "next",
  },
  {
    id: "mcp-confirm",
    title: "Persist MCP tool confirmations before agent access",
    owner: "android-app",
    status: "prototype",
  },
];
