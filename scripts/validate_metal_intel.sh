#!/bin/bash
# Validation script for llama.cpp Metal backend on Intel Macs + AMD dGPU
# Usage: ./scripts/validate_metal_intel.sh [path-to-llama-server]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
BIN_PATH="${1:-}"

if [[ -z "$BIN_PATH" ]]; then
    if [[ -f "${ROOT_DIR}/src-tauri/binaries/llama-server-x86_64-apple-darwin" ]]; then
        BIN_PATH="${ROOT_DIR}/src-tauri/binaries/llama-server-x86_64-apple-darwin"
    elif [[ -f "${ROOT_DIR}/src-tauri/binaries/llama-server-x86_64-unknown-linux-gnu" ]]; then
        BIN_PATH="${ROOT_DIR}/src-tauri/binaries/llama-server-x86_64-unknown-linux-gnu"
    elif command -v llama-server &>/dev/null; then
        BIN_PATH="$(command -v llama-server)"
    else
        echo "Error: llama-server binary not found. Please provide path as argument." >&2
        echo "Usage: $0 <path-to-llama-server>" >&2
        exit 1
    fi
fi

echo "========================================================"
echo "Metal on Intel Mac Validation Spike"
echo "Binary: $BIN_PATH"
echo "Host: $(uname -sm)"
echo "Date: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "========================================================"

MODELS_DIR="${ROOT_DIR}/data/models_spike"
mkdir -p "$MODELS_DIR"

# Test model: Small Llama 3.2 1B or 3B for fast iteration
TEST_URL="https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf"
MODEL_FILE="${MODELS_DIR}/Llama-3.2-1B-Instruct-Q4_K_M.gguf"

if [[ ! -f "$MODEL_FILE" ]]; then
    echo "Downloading validation model: $TEST_URL ..."
    curl -L "$TEST_URL" -o "$MODEL_FILE"
fi

NGLS=(0 8 16 32 99)
PROMPT="Write a short haiku about artificial intelligence."
PORT=18099

echo ""
echo "Starting GPU layer offload benchmark across NGL values: ${NGLS[*]}"
echo ""

for NGL in "${NGLS[@]}"; do
    echo "--- Testing -ngl $NGL ---"
    
    # Start server in background
    "$BIN_PATH" -m "$MODEL_FILE" \
        -ngl "$NGL" \
        -c 2048 \
        --port "$PORT" \
        --host 127.0.0.1 \
        --metrics &
    SERVER_PID=$!

    # Wait for server readiness
    READY=false
    for i in {1..30}; do
        if curl -s "http://127.0.0.1:${PORT}/health" | grep -q '"status":'; then
            READY=true
            break
        fi
        sleep 0.5
    done

    if [[ "$READY" != "true" ]]; then
        echo "❌ Server failed to start with -ngl $NGL"
        kill "$SERVER_PID" 2>/dev/null || true
        wait "$SERVER_PID" 2>/dev/null || true
        continue
    fi

    echo "  Server healthy on port $PORT. Executing test prompts..."
    START_TIME=$(date +%s%N)
    
    SUCCESS_COUNT=0
    for i in {1..5}; do
        RESP=$(curl -s -X POST "http://127.0.0.1:${PORT}/v1/chat/completions" \
            -H "Content-Type: application/json" \
            -d "{\"messages\":[{\"role\":\"user\",\"content\":\"$PROMPT\"}],\"max_tokens\":64}")
        
        if echo "$RESP" | grep -q '"content"'; then
            SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
        fi
    done

    END_TIME=$(date +%s%N)
    ELAPSED_MS=$(( (END_TIME - START_TIME) / 1000000 ))

    # Fetch metrics
    METRICS=$(curl -s "http://127.0.0.1:${PORT}/metrics" || echo "{}")
    echo "$METRICS" > "${MODELS_DIR}/metrics_ngl_${NGL}.json"

    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true

    echo "  ✓ $SUCCESS_COUNT/5 prompts succeeded in ${ELAPSED_MS}ms"
    echo ""
done

echo "========================================================"
echo "✅ Spike test complete. Metrics saved to ${MODELS_DIR}/"
echo "========================================================"
