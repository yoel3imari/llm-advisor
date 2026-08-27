#!/usr/bin/env bash
set -euo pipefail

PINNED_TAG="b10645"
MACOS_X64_URL="https://github.com/ggml-org/llama.cpp/releases/download/${PINNED_TAG}/llama-${PINNED_TAG}-bin-macos-x64.tar.gz"
LINUX_X64_URL="https://github.com/ggml-org/llama.cpp/releases/download/${PINNED_TAG}/llama-${PINNED_TAG}-bin-ubuntu-x64.tar.gz"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
BINARIES_DIR="${ROOT_DIR}/src-tauri/binaries"
SIDECAR_DIR="${ROOT_DIR}/sidecars/binaries"
TMP_DIR="${ROOT_DIR}/target/sidecar-tmp"

mkdir -p "${BINARIES_DIR}" "${SIDECAR_DIR}" "${TMP_DIR}"

OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"

echo "==> Fetching pinned llama-server for OS=${OS}, ARCH=${ARCH} (Tag: ${PINNED_TAG})"

if [ "${OS}" = "darwin" ]; then
    TARGET_URL="${MACOS_X64_URL}"
    TAURI_BIN_NAME="llama-server-x86_64-apple-darwin"
elif [ "${OS}" = "linux" ]; then
    TARGET_URL="${LINUX_X64_URL}"
    TAURI_BIN_NAME="llama-server-x86_64-unknown-linux-gnu"
else
    echo "Unsupported OS: ${OS}"
    exit 1
fi

ARCHIVE_FILE="${TMP_DIR}/llama-${PINNED_TAG}.tar.gz"

# Check if binary already exists and works
if [ -f "${BINARIES_DIR}/${TAURI_BIN_NAME}" ] && [ -f "${SIDECAR_DIR}/llama-server" ]; then
    echo "==> Sidecar binary already present at ${BINARIES_DIR}/${TAURI_BIN_NAME}"
    echo "==> Verifying binary execution..."
    LD_LIBRARY_PATH="${SIDECAR_DIR}:${BINARIES_DIR}:${LD_LIBRARY_PATH:-}" "${SIDECAR_DIR}/llama-server" --version || true
    exit 0
fi

echo "==> Downloading from ${TARGET_URL}..."
curl -sSL -o "${ARCHIVE_FILE}" "${TARGET_URL}"

echo "==> Extracting archive..."
mkdir -p "${TMP_DIR}/extracted"
tar -xzf "${ARCHIVE_FILE}" -C "${TMP_DIR}/extracted"

# Locate llama-server / server binary in extracted files
SERVER_BIN="$(find "${TMP_DIR}/extracted" -type f \( -name "llama-server" -o -name "server" \) | head -n 1)"
if [ -z "${SERVER_BIN}" ]; then
    echo "Error: llama-server binary not found in downloaded archive!"
    exit 1
fi

chmod +x "${SERVER_BIN}"
cp "${SERVER_BIN}" "${SIDECAR_DIR}/llama-server"
cp "${SERVER_BIN}" "${BINARIES_DIR}/${TAURI_BIN_NAME}"

# Also copy shared libs (libggml, etc.) into binaries dirs
find "${TMP_DIR}/extracted" -type f \( -name "*.so*" -o -name "*.dylib*" \) | while read -r lib; do
    cp "${lib}" "${SIDECAR_DIR}/" 2>/dev/null || true
    cp "${lib}" "${BINARIES_DIR}/" 2>/dev/null || true
done

# Create so version symlinks if on Linux
for dir in "${SIDECAR_DIR}" "${BINARIES_DIR}"; do
    (cd "$dir" && \
     ln -sf libllama-common.so.0.3.0 libllama-common.so.0 2>/dev/null || true && \
     ln -sf libllama-common.so.0.3.0 libllama-common.so 2>/dev/null || true && \
     ln -sf libllama.so.0.3.0 libllama.so.0 2>/dev/null || true && \
     ln -sf libllama.so.0.3.0 libllama.so 2>/dev/null || true && \
     ln -sf libggml-base.so.0.22.0 libggml-base.so.0 2>/dev/null || true && \
     ln -sf libggml-base.so.0.22.0 libggml-base.so 2>/dev/null || true && \
     ln -sf libggml.so.0.22.0 libggml.so.0 2>/dev/null || true && \
     ln -sf libggml.so.0.22.0 libggml.so 2>/dev/null || true && \
     ln -sf libmtmd.so.0.3.0 libmtmd.so.0 2>/dev/null || true && \
     ln -sf libmtmd.so.0.3.0 libmtmd.so 2>/dev/null || true)
done

echo "==> Successfully installed sidecar to:"
echo "    - ${SIDECAR_DIR}/llama-server"
echo "    - ${BINARIES_DIR}/${TAURI_BIN_NAME}"

SHA="$((sha256sum "${SIDECAR_DIR}/llama-server" 2>/dev/null || shasum -a 256 "${SIDECAR_DIR}/llama-server") | awk '{print $1}')"
echo "==> Computed SHA256: ${SHA}"

echo "==> Verifying execution..."
LD_LIBRARY_PATH="${SIDECAR_DIR}:${BINARIES_DIR}:${LD_LIBRARY_PATH:-}" "${SIDECAR_DIR}/llama-server" --version || true

rm -rf "${TMP_DIR}"
