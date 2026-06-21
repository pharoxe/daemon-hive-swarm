#!/data/data/com.termux/files/usr/bin/bash
# Daemon Termux GPU benchmark — logs to /sdcard/Download/daemon-bench-results.txt
set -u
export PATH="/data/data/com.termux/files/usr/bin:$PATH"
export HOME="${HOME:-/data/data/com.termux/files/home}"

LOG="/sdcard/Download/daemon-bench-results.txt"
LLAMA_TAG="b9295"
LLAMA_URL="https://github.com/ggml-org/llama.cpp/releases/download/${LLAMA_TAG}/llama-${LLAMA_TAG}-bin-android-arm64.tar.gz"
MODEL_URL="https://huggingface.co/unsloth/Qwen3.5-0.8B-GGUF/resolve/main/Qwen3.5-0.8B-Q4_K_M.gguf"
MODEL="$HOME/models/Qwen3.5-0.8B-Q4_K_M.gguf"
LLAMA_DIR="$HOME/llama/llama-${LLAMA_TAG}-android-arm64"
PROMPT="Summarize in one sentence: local models are faster when prompts are compact."

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG"
}

section() {
  echo "" | tee -a "$LOG"
  echo "========== $* ==========" | tee -a "$LOG"
}

run_case() {
  local label="$1"
  shift
  section "$label"
  log "CMD: $*"
  local start end elapsed
  start=$(date +%s)
  if "$@" >>"$LOG" 2>&1; then
    end=$(date +%s)
    elapsed=$((end - start))
    log "EXIT: 0  WALL: ${elapsed}s"
  else
    end=$(date +%s)
    elapsed=$((end - start))
    log "EXIT: $?  WALL: ${elapsed}s (failed)"
  fi
}

: >"$LOG"
touch /sdcard/Download/daemon-bench-started.marker 2>/dev/null || true
section "Environment"
log "HOME=$HOME"
log "USER=$(whoami 2>/dev/null || echo ?)"
log "UNAME=$(uname -a)"
log "SOC=$(getprop ro.soc.model 2>/dev/null || echo n/a)"
log "VULKAN_HW=$(getprop ro.hardware.vulkan 2>/dev/null || echo n/a)"
log "EGL_HW=$(getprop ro.hardware.egl 2>/dev/null || echo n/a)"

if ! command -v pkg >/dev/null 2>&1; then
  log "ERROR: Termux pkg not found — run this script inside Termux."
  exit 1
fi

section "Packages"
pkg install -y wget tar curl 2>&1 | tee -a "$LOG" || true

mkdir -p "$HOME/llama" "$HOME/models"

LLAMA_TAR_SDCARD="/sdcard/Download/llama-android.tar.gz"
LLAMA_TAR_HOME="$HOME/llama/llama-android.tar.gz"

if [ -f "$LLAMA_DIR/bin/llama-cli" ]; then
  log "Using existing llama extract at $LLAMA_DIR"
elif [ -f "$LLAMA_TAR_SDCARD" ]; then
  section "Extract llama from sdcard"
  cp "$LLAMA_TAR_SDCARD" "$LLAMA_TAR_HOME"
  mkdir -p "$HOME/llama"
  tar -xzf "$LLAMA_TAR_HOME" -C "$HOME/llama" 2>&1 | tee -a "$LOG"
elif [ -f "$LLAMA_TAR_HOME" ]; then
  section "Extract llama from home cache"
  mkdir -p "$HOME/llama"
  tar -xzf "$LLAMA_TAR_HOME" -C "$HOME/llama" 2>&1 | tee -a "$LOG"
else
  section "Download llama.cpp ${LLAMA_TAG} android-arm64"
  wget -O "$LLAMA_TAR_HOME" "$LLAMA_URL" 2>&1 | tee -a "$LOG"
  mkdir -p "$HOME/llama"
  tar -xzf "$LLAMA_TAR_HOME" -C "$HOME/llama" 2>&1 | tee -a "$LOG"
fi

CLI="$LLAMA_DIR/bin/llama-cli"
BENCH="$LLAMA_DIR/bin/llama-bench"
for candidate in \
  "$LLAMA_DIR/bin/llama-cli" \
  "$HOME/llama/bin/llama-cli" \
  "$(find "$HOME/llama" -type f -name llama-cli 2>/dev/null | head -n 1)"; do
  if [ -n "$candidate" ] && [ -f "$candidate" ]; then
    CLI="$candidate"
    break
  fi
done
chmod +x "$CLI" 2>/dev/null || true
[ -f "$BENCH" ] && chmod +x "$BENCH" 2>/dev/null || true

section "Binaries"
log "CLI=$CLI"
log "BENCH=$BENCH"
"$CLI" --version 2>&1 | tee -a "$LOG" || log "llama-cli --version failed"
"$CLI" --help 2>&1 | tee -a "$LOG" | grep -iE 'ngl|vulkan|opencl|gpu|device' | tee -a "$LOG" || true

if [ ! -f "$MODEL" ]; then
  section "Download model"
  wget -c "$MODEL_URL" -O "$MODEL" 2>&1 | tee -a "$LOG"
fi
log "MODEL=$(ls -lh "$MODEL" 2>/dev/null || echo missing)"

if [ ! -f "$MODEL" ]; then
  log "ERROR: model missing, aborting benchmarks."
  exit 1
fi

section "CPU baseline (-ngl 0)"
run_case "CPU llama-cli" "$CLI" -m "$MODEL" -p "$PROMPT" -n 48 -ngl 0 --no-display-prompt --single-turn

section "Vulkan / GPU (-ngl 99)"
export GGML_VK_DISABLE_COOPMAT=1
export GGML_VK_DISABLE_GRAPH_OPTIMIZE=1
run_case "GPU llama-cli" "$CLI" -m "$MODEL" -p "$PROMPT" -n 48 -ngl 99 --no-display-prompt --single-turn -v

section "GPU verbose grep"
grep -iE 'vulkan|opencl|offload|gpu|cpu|mali|backend|layer|error|warn|ggml' "$LOG" | tail -n 80 | tee -a "$LOG" || true

if [ -x "$BENCH" ]; then
  section "llama-bench CPU"
  run_case "bench CPU" "$BENCH" -m "$MODEL" -ngl 0 -p 128 -n 32 -r 1
  section "llama-bench GPU"
  run_case "bench GPU" "$BENCH" -m "$MODEL" -ngl 99 -p 128 -n 32 -r 1
fi

section "DONE"
log "Full log: $LOG"
