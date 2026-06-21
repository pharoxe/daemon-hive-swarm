# Inference audit log

Structured JSON Lines log of QVAC model loads, unloads, and inference performance. Required for QVAC hackathon submission reproducibility.

## Committed demo run

**File:** [`demo-audit-log.jsonl`](demo-audit-log.jsonl)

Captured from the **Profile Inference** flow on a **Google Pixel 8** (see device table in README / reproducibility notes). One model (`qwen35-08b-q4km`) loaded, one profiler inference, then unload.

## Schema

Each line is one JSON object.

| Field | Type | Events | Description |
| --- | --- | --- | --- |
| `ts` | ISO-8601 string | all | UTC timestamp |
| `event` | string | all | `model_load` \| `model_unload` \| `inference` |
| `device` | object | all | `{ brand, model, soc, ramGb, storageGb }` |
| `modelId` | string | all | Runtime model id (`src/runtime/modelManifest.ts`) |
| `modelTitle` | string | all | Display name |
| `source` | string | load/unload | QVAC registry id or HTTPS GGUF URL |
| `loadPath` | string | load/inference | `gpu`, `cpu`, or `cpu-fallback` |
| `wallMs` | number | load/inference | Wall-clock milliseconds |
| `qvacModelInstanceId` | string | load/unload/inference | QVAC loaded-model instance id |
| `promptSystem` | string | inference | System prompt (truncated in export if >512 chars) |
| `promptUser` | string | inference | User prompt |
| `promptTokens` | number | inference | Prompt token count when reported by QVAC profiler |
| `generatedTokens` | number | inference | Output tokens |
| `ttftMs` | number | inference | Time to first token (ms) |
| `tokensPerSec` | number | inference | Decode throughput (tok/s) |
| `decodeBackend` | string | inference | `cpu` or `gpu` from QVAC stats |
| `mode` | string | inference | Profiler read mode (`nonstream`, `stream-smoke`, etc.) |

## How to capture a new run

1. Install on device: `npm run android:install-device`
2. Open Daemon → **Models** → select a downloaded QVAC model (e.g. Qwen 3.5 Mobile 0.8B).
3. Tap **Profile Inference** (runs load → inference → optional unload). Or chat `/profile`.
4. Pull audit file from device:

```powershell
adb shell run-as io.daemon.mobile cat files/daemon-audit/inference.jsonl
```

5. Copy output to `docs/demo-audit-log.jsonl` for submission.

Runtime logging also emits `[DaemonAudit]` lines to logcat (`npm run android:logs`).

Implementation: `src/runtime/inferenceAudit.ts`, wired in `src/runtime/qvacClient.ts`.
