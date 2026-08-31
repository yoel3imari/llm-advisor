#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
BINARIES_DIR="${ROOT_DIR}/src-tauri/binaries"
MACOS_APP_DIR="${ROOT_DIR}/target/release/bundle/macos/Local LLM Advisor.app/Contents/MacOS"

if [ -d "${MACOS_APP_DIR}" ]; then
    echo "==> Post-bundle: Copying shared libraries and symlinks into ${MACOS_APP_DIR}..."
    cp -a "${BINARIES_DIR}"/*.dylib* "${MACOS_APP_DIR}/" 2>/dev/null || true
    cp -a "${BINARIES_DIR}"/*.so* "${MACOS_APP_DIR}/" 2>/dev/null || true
    echo "==> Post-bundle: Shared libraries successfully synchronized into macOS bundle."
fi
