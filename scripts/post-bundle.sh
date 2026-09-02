#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
BINARIES_DIR="${ROOT_DIR}/src-tauri/binaries"
MACOS_APP_DIR="${ROOT_DIR}/target/release/bundle/macos/LLM Advisor.app/Contents/MacOS"

if [ -d "${MACOS_APP_DIR}" ]; then
    echo "==> Post-bundle: Copying shared libraries, shaders, and symlinks into ${MACOS_APP_DIR}..."
    cp -a "${BINARIES_DIR}"/*.dylib* "${MACOS_APP_DIR}/" 2>/dev/null || true
    cp -a "${BINARIES_DIR}"/*.so* "${MACOS_APP_DIR}/" 2>/dev/null || true
    cp -a "${BINARIES_DIR}"/*.metal* "${MACOS_APP_DIR}/" 2>/dev/null || true

    if command -v install_name_tool &>/dev/null; then
        echo "==> Post-bundle: Configuring @loader_path and @executable_path RPATHs in macOS bundle..."
        for bin in "${MACOS_APP_DIR}/llama-server" "${MACOS_APP_DIR}/LLM Advisor"; do
            [ -f "$bin" ] || continue
            install_name_tool -add_rpath "@loader_path" "$bin" 2>/dev/null || true
            install_name_tool -add_rpath "@executable_path" "$bin" 2>/dev/null || true
            install_name_tool -add_rpath "@loader_path/." "$bin" 2>/dev/null || true
        done
        for dylib in "${MACOS_APP_DIR}"/*.dylib*; do
            [ -f "$dylib" ] || continue
            install_name_tool -id "@rpath/$(basename "$dylib")" "$dylib" 2>/dev/null || true
            install_name_tool -add_rpath "@loader_path" "$dylib" 2>/dev/null || true
            install_name_tool -add_rpath "@executable_path" "$dylib" 2>/dev/null || true
        done
    fi
    echo "==> Post-bundle: Shared libraries successfully synchronized into macOS bundle."
fi
