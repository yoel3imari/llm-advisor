#!/usr/bin/env bash
set -euo pipefail

PINNED_TAG="b10645"
MACOS_X64_URL="https://github.com/ggml-org/llama.cpp/releases/download/${PINNED_TAG}/llama-${PINNED_TAG}-bin-macos-x64.tar.gz"
MACOS_ARM64_URL="https://github.com/ggml-org/llama.cpp/releases/download/${PINNED_TAG}/llama-${PINNED_TAG}-bin-macos-arm64.tar.gz"
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
    if [ "${ARCH}" = "arm64" ] || [ "${ARCH}" = "aarch64" ]; then
        TARGET_URL="${MACOS_ARM64_URL}"
        TAURI_BIN_NAME="llama-server-aarch64-apple-darwin"
    else
        TARGET_URL="${MACOS_X64_URL}"
        TAURI_BIN_NAME="llama-server-x86_64-apple-darwin"
    fi
elif [ "${OS}" = "linux" ]; then
    if [ "${ARCH}" = "arm64" ] || [ "${ARCH}" = "aarch64" ]; then
        TARGET_URL="https://github.com/ggml-org/llama.cpp/releases/download/${PINNED_TAG}/llama-${PINNED_TAG}-bin-ubuntu-arm64.tar.gz"
        TAURI_BIN_NAME="llama-server-aarch64-unknown-linux-gnu"
    else
        TARGET_URL="${LINUX_X64_URL}"
        TAURI_BIN_NAME="llama-server-x86_64-unknown-linux-gnu"
    fi
elif [[ "${OS}" == *"mingw"* ]] || [[ "${OS}" == *"msys"* ]] || [[ "${OS}" == *"cygwin"* ]] || [[ "${OS}" == "windows_nt" ]]; then
    TARGET_URL="https://github.com/ggml-org/llama.cpp/releases/download/${PINNED_TAG}/llama-${PINNED_TAG}-bin-win-avx2-x64.zip"
    TAURI_BIN_NAME="llama-server-x86_64-pc-windows-msvc.exe"
else
    echo "Unsupported OS: ${OS}"
    exit 1
fi

ARCHIVE_FILE="${TMP_DIR}/llama-${PINNED_TAG}.tar.gz"

# Check if real binary already exists and works
if [ -f "${BINARIES_DIR}/${TAURI_BIN_NAME}" ] && [ -f "${SIDECAR_DIR}/llama-server" ] && [ ! -s "${BINARIES_DIR}/${TAURI_BIN_NAME}" -o "$(head -n 1 "${BINARIES_DIR}/${TAURI_BIN_NAME}" 2>/dev/null)" != "#!/bin/sh" ]; then
    echo "==> Real sidecar binary already present at ${BINARIES_DIR}/${TAURI_BIN_NAME}"
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
find "${TMP_DIR}/extracted" \( -type f -o -type l \) \( -name "*.so*" -o -name "*.dylib*" -o -name "*.dll*" -o -name "*.metal*" -o -name "*.metallib*" \) | while read -r lib; do
    cp -a "${lib}" "${SIDECAR_DIR}/" 2>/dev/null || true
    cp -a "${lib}" "${BINARIES_DIR}/" 2>/dev/null || true
done

# Create so version symlinks if on Linux or dylib version symlinks on macOS
for dir in "${SIDECAR_DIR}" "${BINARIES_DIR}"; do
    (cd "$dir" && \
     ln -sf libllama-server-impl.so.0.3.0 libllama-server-impl.so.0 2>/dev/null || true && \
     ln -sf libllama-server-impl.so.0.3.0 libllama-server-impl.so 2>/dev/null || true && \
     ln -sf libllama-server-impl.0.3.0.dylib libllama-server-impl.0.dylib 2>/dev/null || true && \
     ln -sf libllama-server-impl.0.3.0.dylib libllama-server-impl.dylib 2>/dev/null || true && \
     ln -sf libllama-common.so.0.3.0 libllama-common.so.0 2>/dev/null || true && \
     ln -sf libllama-common.so.0.3.0 libllama-common.so 2>/dev/null || true && \
     ln -sf libllama.so.0.3.0 libllama.so.0 2>/dev/null || true && \
     ln -sf libllama.so.0.3.0 libllama.so 2>/dev/null || true && \
     ln -sf libggml-base.so.0.22.0 libggml-base.so.0 2>/dev/null || true && \
     ln -sf libggml-base.so.0.22.0 libggml-base.so 2>/dev/null || true && \
     ln -sf libggml.so.0.22.0 libggml.so.0 2>/dev/null || true && \
     ln -sf libggml.so.0.22.0 libggml.so 2>/dev/null || true && \
     ln -sf libmtmd.so.0.3.0 libmtmd.so.0 2>/dev/null || true && \
     ln -sf libmtmd.so.0.3.0 libmtmd.so 2>/dev/null || true && \
     ln -sf libllama-common.0.3.0.dylib libllama-common.0.dylib 2>/dev/null || true && \
     ln -sf libllama-common.0.3.0.dylib libllama-common.dylib 2>/dev/null || true && \
     ln -sf libllama.0.3.0.dylib libllama.0.dylib 2>/dev/null || true && \
     ln -sf libllama.0.3.0.dylib libllama.dylib 2>/dev/null || true && \
     ln -sf libggml-base.0.22.0.dylib libggml-base.0.dylib 2>/dev/null || true && \
     ln -sf libggml-base.0.22.0.dylib libggml-base.dylib 2>/dev/null || true && \
     ln -sf libggml.0.22.0.dylib libggml.0.dylib 2>/dev/null || true && \
     ln -sf libggml.0.22.0.dylib libggml.dylib 2>/dev/null || true && \
     ln -sf libggml-cpu.0.22.0.dylib libggml-cpu.0.dylib 2>/dev/null || true && \
     ln -sf libggml-cpu.0.22.0.dylib libggml-cpu.dylib 2>/dev/null || true && \
     ln -sf libggml-blas.0.22.0.dylib libggml-blas.0.dylib 2>/dev/null || true && \
     ln -sf libggml-blas.0.22.0.dylib libggml-blas.dylib 2>/dev/null || true && \
     ln -sf libggml-metal.0.22.0.dylib libggml-metal.0.dylib 2>/dev/null || true && \
     ln -sf libggml-metal.0.22.0.dylib libggml-metal.dylib 2>/dev/null || true && \
     ln -sf libmtmd.0.3.0.dylib libmtmd.0.dylib 2>/dev/null || true && \
     ln -sf libmtmd.0.3.0.dylib libmtmd.dylib 2>/dev/null || true)
done

if [ "${OS}" = "darwin" ] && command -v install_name_tool &>/dev/null; then
    echo "==> Configuring Mach-O @rpath and @loader_path on macOS..."
    for bin in "${SIDECAR_DIR}/llama-server" "${BINARIES_DIR}/${TAURI_BIN_NAME}"; do
        [ -f "$bin" ] || continue
        install_name_tool -add_rpath "@loader_path" "$bin" 2>/dev/null || true
        install_name_tool -add_rpath "@executable_path" "$bin" 2>/dev/null || true
        install_name_tool -add_rpath "@loader_path/." "$bin" 2>/dev/null || true
    done
    for dylib in "${BINARIES_DIR}"/*.dylib* "${SIDECAR_DIR}"/*.dylib*; do
        [ -f "$dylib" ] || continue
        install_name_tool -id "@rpath/$(basename "$dylib")" "$dylib" 2>/dev/null || true
        install_name_tool -add_rpath "@loader_path" "$dylib" 2>/dev/null || true
        install_name_tool -add_rpath "@executable_path" "$dylib" 2>/dev/null || true
    done
fi

echo "==> Verifying binary execution..."
if ! LD_LIBRARY_PATH="${SIDECAR_DIR}:${BINARIES_DIR}:${LD_LIBRARY_PATH:-}" DYLD_LIBRARY_PATH="${SIDECAR_DIR}:${BINARIES_DIR}:${DYLD_LIBRARY_PATH:-}" "${SIDECAR_DIR}/llama-server" --version >/dev/null 2>&1; then
    echo "==> Precompiled binary failed verification on this system (e.g. SDK version / symbol mismatch)."
    if command -v cmake &>/dev/null && command -v clang &>/dev/null; then
        echo "==> Compiling native llama-server from source (tag ${PINNED_TAG})..."
        BUILD_DIR="${TMP_DIR}/native-build"
        git clone --depth 1 --branch "${PINNED_TAG}" https://github.com/ggml-org/llama.cpp.git "${BUILD_DIR}"
        cmake -B "${BUILD_DIR}/build" -S "${BUILD_DIR}" \
            -DGGML_BUILD_TESTS=OFF -DGGML_BUILD_EXAMPLES=OFF \
            -DLLAMA_BUILD_TESTS=OFF -DLLAMA_BUILD_EXAMPLES=OFF \
            -DLLAMA_BUILD_SERVER=ON -DCMAKE_BUILD_TYPE=Release \
            -DCMAKE_BUILD_WITH_INSTALL_RPATH=ON \
            -DCMAKE_INSTALL_RPATH="@loader_path;@executable_path" \
            -DCMAKE_INSTALL_RPATH_USE_LINK_PATH=ON \
            -DCMAKE_MACOSX_RPATH=ON
        cmake --build "${BUILD_DIR}/build" --config Release --target llama-server -j4
        
        NATIVE_SERVER_BIN="$(find "${BUILD_DIR}/build" -type f \( -name "llama-server" -o -name "server" \) | head -n 1)"
        if [ -n "${NATIVE_SERVER_BIN}" ]; then
            chmod +x "${NATIVE_SERVER_BIN}"
            cp "${NATIVE_SERVER_BIN}" "${SIDECAR_DIR}/llama-server"
            cp "${NATIVE_SERVER_BIN}" "${BINARIES_DIR}/${TAURI_BIN_NAME}"
        fi
        
        find "${BUILD_DIR}/build" \( -type f -o -type l \) \( -name "*.so*" -o -name "*.dylib*" -o -name "*.dll*" -o -name "*.metal*" -o -name "*.metallib*" \) | while read -r lib; do
            cp -a "${lib}" "${SIDECAR_DIR}/" 2>/dev/null || true
            cp -a "${lib}" "${BINARIES_DIR}/" 2>/dev/null || true
        done

        for dir in "${SIDECAR_DIR}" "${BINARIES_DIR}"; do
            (cd "$dir" && \
             ln -sf libllama-server-impl.so.0.3.0 libllama-server-impl.so.0 2>/dev/null || true && \
             ln -sf libllama-server-impl.so.0.3.0 libllama-server-impl.so 2>/dev/null || true && \
             ln -sf libllama-server-impl.0.3.0.dylib libllama-server-impl.0.dylib 2>/dev/null || true && \
             ln -sf libllama-server-impl.0.3.0.dylib libllama-server-impl.dylib 2>/dev/null || true && \
             ln -sf libllama-common.so.0.3.0 libllama-common.so.0 2>/dev/null || true && \
             ln -sf libllama-common.so.0.3.0 libllama-common.so 2>/dev/null || true && \
             ln -sf libllama.so.0.3.0 libllama.so.0 2>/dev/null || true && \
             ln -sf libllama.so.0.3.0 libllama.so 2>/dev/null || true && \
             ln -sf libggml-base.so.0.22.0 libggml-base.so.0 2>/dev/null || true && \
             ln -sf libggml-base.so.0.22.0 libggml-base.so 2>/dev/null || true && \
             ln -sf libggml.so.0.22.0 libggml.so.0 2>/dev/null || true && \
             ln -sf libggml.so.0.22.0 libggml.so 2>/dev/null || true && \
             ln -sf libmtmd.so.0.3.0 libmtmd.so.0 2>/dev/null || true && \
             ln -sf libmtmd.so.0.3.0 libmtmd.so 2>/dev/null || true && \
             ln -sf libllama-common.0.3.0.dylib libllama-common.0.dylib 2>/dev/null || true && \
             ln -sf libllama-common.0.3.0.dylib libllama-common.dylib 2>/dev/null || true && \
             ln -sf libllama.0.3.0.dylib libllama.0.dylib 2>/dev/null || true && \
             ln -sf libllama.0.3.0.dylib libllama.dylib 2>/dev/null || true && \
             ln -sf libggml-base.0.22.0.dylib libggml-base.0.dylib 2>/dev/null || true && \
             ln -sf libggml-base.0.22.0.dylib libggml-base.dylib 2>/dev/null || true && \
             ln -sf libggml.0.22.0.dylib libggml.0.dylib 2>/dev/null || true && \
             ln -sf libggml.0.22.0.dylib libggml.dylib 2>/dev/null || true && \
             ln -sf libggml-cpu.0.22.0.dylib libggml-cpu.0.dylib 2>/dev/null || true && \
             ln -sf libggml-cpu.0.22.0.dylib libggml-cpu.dylib 2>/dev/null || true && \
             ln -sf libggml-blas.0.22.0.dylib libggml-blas.0.dylib 2>/dev/null || true && \
             ln -sf libggml-blas.0.22.0.dylib libggml-blas.dylib 2>/dev/null || true && \
             ln -sf libggml-metal.0.22.0.dylib libggml-metal.0.dylib 2>/dev/null || true && \
             ln -sf libggml-metal.0.22.0.dylib libggml-metal.dylib 2>/dev/null || true && \
             ln -sf libmtmd.0.3.0.dylib libmtmd.0.dylib 2>/dev/null || true && \
             ln -sf libmtmd.0.3.0.dylib libmtmd.dylib 2>/dev/null || true)
        done

        if [ "${OS}" = "darwin" ] && command -v install_name_tool &>/dev/null; then
            for bin in "${SIDECAR_DIR}/llama-server" "${BINARIES_DIR}/${TAURI_BIN_NAME}"; do
                [ -f "$bin" ] || continue
                install_name_tool -add_rpath "@loader_path" "$bin" 2>/dev/null || true
                install_name_tool -add_rpath "@executable_path" "$bin" 2>/dev/null || true
                install_name_tool -add_rpath "@loader_path/." "$bin" 2>/dev/null || true
            done
            for dylib in "${BINARIES_DIR}"/*.dylib* "${SIDECAR_DIR}"/*.dylib*; do
                [ -f "$dylib" ] || continue
                install_name_tool -id "@rpath/$(basename "$dylib")" "$dylib" 2>/dev/null || true
                install_name_tool -add_rpath "@loader_path" "$dylib" 2>/dev/null || true
                install_name_tool -add_rpath "@executable_path" "$dylib" 2>/dev/null || true
            done
        fi
        echo "==> Native build completed successfully."
    else
        echo "Warning: cmake/clang not found to compile native fallback. Please ensure build dependencies are installed."
    fi
fi

# Synchronize to target directories if present
for target_dir in "${ROOT_DIR}/target/debug" "${ROOT_DIR}/target/release"; do
    if [ -d "$target_dir" ]; then
        echo "==> Synchronizing libraries to ${target_dir}..."
        cp -a "${BINARIES_DIR}"/*.dylib* "$target_dir/" 2>/dev/null || true
        cp -a "${BINARIES_DIR}"/*.so* "$target_dir/" 2>/dev/null || true
        cp -a "${BINARIES_DIR}"/*.dll* "$target_dir/" 2>/dev/null || true
        cp -a "${BINARIES_DIR}"/*.metal* "$target_dir/" 2>/dev/null || true
    fi
done

echo "==> Successfully installed sidecar to:"
echo "    - ${SIDECAR_DIR}/llama-server"
echo "    - ${BINARIES_DIR}/${TAURI_BIN_NAME}"

SHA="$((sha256sum "${SIDECAR_DIR}/llama-server" 2>/dev/null || shasum -a 256 "${SIDECAR_DIR}/llama-server") | awk '{print $1}')"
echo "==> Computed SHA256: ${SHA}"

rm -rf "${TMP_DIR}"

