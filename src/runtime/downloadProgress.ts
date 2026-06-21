export type DownloadProgressPhase = "downloading" | "loading" | "finalizing";

export function normalizeDownloadPercent(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.max(0, Math.min(100, value));
}

/** Keep UI progress monotonic — QVAC may reset per shard or when GPU→CPU fallback restarts. */
export function nextMonotonicDownloadProgress(currentMax: number, incoming?: number): number {
  const next = normalizeDownloadPercent(incoming);
  if (next === undefined) return currentMax;
  return Math.max(currentMax, next);
}

export function downloadProgressLabel(phase: DownloadProgressPhase, percent: number) {
  if (phase === "loading") return percent >= 99 ? "Finalizing install" : "Loading model into runtime";
  if (phase === "finalizing") return "Finalizing install";
  return "Downloading model weights";
}
