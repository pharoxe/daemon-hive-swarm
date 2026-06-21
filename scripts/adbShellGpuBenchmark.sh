#!/system/bin/sh
# Runs on device via: adb shell sh /data/local/tmp/adbShellGpuBenchmark.sh
# CPU llama.cpp benchmark (official android-arm64 release is CPU-only).
set -u

LOG=/sdcard/Download/daemon-adb-bench-results.txt
LLAMA=/data/local/tmp/llama-b9295
MODEL=/sdcard/Download/Qwen3.5-0.8B-Q4_K_M.gguf
PROMPT="Summarize in one sentence: local models are faster when prompts are compact."

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG"; }
section() { echo "" | tee -a "$LOG"; echo "========== $* ==========" | tee -a "$LOG"; }

: >"$LOG"
section "ADB shell benchmark (CPH2423 / Mali)"
log "SOC=$(getprop ro.soc.model 2>/dev/null || echo n/a)"
log "VULKAN_HW=$(getprop ro.hardware.vulkan 2>/dev/null || echo n/a)"
log "EGL_HW=$(getprop ro.hardware.egl 2>/dev/null || echo n/a)"
log "BOARD=$(getprop ro.board.platform 2>/dev/null || echo n/a)"

export LD_LIBRARY_PATH="$LLAMA"

CLI="$LLAMA/llama-cli"
BENCH="$LLAMA/llama-bench"

if [ ! -x "$CLI" ]; then
  log "ERROR: missing $CLI — extract llama-b9295 to /data/local/tmp first."
  exit 1
fi

section "llama-cli --version"
"$CLI" --version 2>&1 | tee -a "$LOG"

section "llama-cli --list-devices"
"$CLI" --list-devices 2>&1 | tee -a "$LOG"

if [ ! -f "$MODEL" ]; then
  log "ERROR: model missing at $MODEL"
  exit 1
fi
log "MODEL=$(ls -lh "$MODEL" 2>/dev/null || echo missing)"

section "CPU baseline (-ngl 0)"
log "CMD: $CLI -m $MODEL -p ... -n 48 -ngl 0"
START=$(date +%s)
"$CLI" -m "$MODEL" -p "$PROMPT" -n 48 -ngl 0 --no-display-prompt --single-turn -v >>"$LOG" 2>&1
log "EXIT=$? WALL=$(( $(date +%s) - START ))s"

section "GPU attempt (-ngl 99)"
export GGML_VK_DISABLE_COOPMAT=1
export GGML_VK_DISABLE_GRAPH_OPTIMIZE=1
START=$(date +%s)
"$CLI" -m "$MODEL" -p "$PROMPT" -n 48 -ngl 99 --no-display-prompt --single-turn -v >>"$LOG" 2>&1
log "EXIT=$? WALL=$(( $(date +%s) - START ))s"

if [ -x "$BENCH" ]; then
  section "llama-bench CPU (-ngl 0)"
  "$BENCH" -m "$MODEL" -ngl 0 -p 128 -n 32 -r 1 >>"$LOG" 2>&1 || true
  section "llama-bench GPU (-ngl 99)"
  "$BENCH" -m "$MODEL" -ngl 99 -p 128 -n 32 -r 1 >>"$LOG" 2>&1 || true
fi

section "QVAC OpenCL libs in Daemon APK (reference)"
APK=$(pm path io.daemon.mobile 2>/dev/null | cut -d: -f2)
if [ -n "$APK" ]; then
  unzip -l "$APK" 2>/dev/null | grep -E 'qvac-ggml|vulkan' | tee -a "$LOG" || true
fi

section "DONE"
log "Full log: $LOG"
