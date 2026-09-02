#!/usr/bin/env bash
set -euo pipefail

BOLD="\033[1m"
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
CYAN="\033[0;36m"
RESET="\033[0m"

echo -e "${BOLD}${CYAN}=== LLM Advisor: System Dependency Preflight (Doctor) ===${RESET}\n"

OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"

echo -e "Platform: ${BOLD}${OS} (${ARCH})${RESET}"

MISSING_DEPS=()
FIX_COMMAND=""
DISTRO="unknown"

check_cmd() {
    local cmd="$1"
    local name="$2"
    if command -v "$cmd" &>/dev/null; then
        echo -e "  [${GREEN}✓${RESET}] $name (${CYAN}$cmd${RESET}: $($cmd --version 2>&1 | head -n 1))"
        return 0
    else
        echo -e "  [${RED}✗${RESET}] $name (${BOLD}$cmd${RESET} not found in PATH)"
        return 1
    fi
}

echo -e "\n${BOLD}1. Toolchain & Runtime:${RESET}"
check_cmd "node" "Node.js" || MISSING_DEPS+=("nodejs")
check_cmd "npm" "NPM Package Manager" || MISSING_DEPS+=("npm")
check_cmd "rustc" "Rust Compiler" || MISSING_DEPS+=("rustc")
check_cmd "cargo" "Cargo Package Manager" || MISSING_DEPS+=("cargo")
check_cmd "curl" "cURL Transfer Tool" || MISSING_DEPS+=("curl")

if [ "$OS" = "linux" ]; then
    echo -e "\n${BOLD}2. Linux System Libraries (WebKitGTK, GTK3, SSL):${RESET}"
    
    # Detect Distro
    if [ -f /etc/os-release ]; then
        # shellcheck disable=SC1091
        . /etc/os-release
        DISTRO="${ID:-linux}"
        DISTRO_LIKE="${ID_LIKE:-}"
    fi

    check_pkg_config=true
    if ! command -v pkg-config &>/dev/null; then
        echo -e "  [${RED}✗${RESET}] ${BOLD}pkg-config${RESET} (needed to locate system C/GTK libraries)"
        MISSING_DEPS+=("pkg-config")
        check_pkg_config=false
    else
        echo -e "  [${GREEN}✓${RESET}] pkg-config ($(pkg-config --version))"
    fi

    # Check shared libraries via pkg-config if available
    check_lib() {
        local pkg="$1"
        local label="$2"
        local apt_pkg="$3"
        local dnf_pkg="$4"
        local pacman_pkg="$5"

        if [ "$check_pkg_config" = true ] && pkg-config --exists "$pkg" 2>/dev/null; then
            local ver
            ver="$(pkg-config --modversion "$pkg" 2>/dev/null || echo "detected")"
            echo -e "  [${GREEN}✓${RESET}] $label ($pkg: ${CYAN}$ver${RESET})"
        else
            echo -e "  [${RED}✗${RESET}] $label (${BOLD}$pkg${RESET})"
            if [[ "$DISTRO" =~ (ubuntu|debian|pop|mint) ]] || [[ "$DISTRO_LIKE" =~ (ubuntu|debian) ]]; then
                MISSING_DEPS+=("$apt_pkg")
            elif [[ "$DISTRO" =~ (fedora|rhel|centos) ]]; then
                MISSING_DEPS+=("$dnf_pkg")
            elif [[ "$DISTRO" =~ (arch|manjaro) ]]; then
                MISSING_DEPS+=("$pacman_pkg")
            else
                MISSING_DEPS+=("$pkg")
            fi
        fi
    }

    check_lib "gtk+-3.0" "GTK 3 GUI Toolkit" "libgtk-3-dev" "gtk3-devel" "gtk3"
    
    # WebKitGTK check (prefer 4.1, fallback 4.0)
    if [ "$check_pkg_config" = true ] && (pkg-config --exists "webkit2gtk-4.1" 2>/dev/null || pkg-config --exists "webkit2gtk-4.0" 2>/dev/null); then
        w_ver="$(pkg-config --modversion webkit2gtk-4.1 2>/dev/null || pkg-config --modversion webkit2gtk-4.0 2>/dev/null)"
        echo -e "  [${GREEN}✓${RESET}] WebKitGTK Webview Engine (${CYAN}$w_ver${RESET})"
    else
        echo -e "  [${RED}✗${RESET}] WebKitGTK Webview Engine (${BOLD}webkit2gtk-4.1${RESET})"
        if [[ "$DISTRO" =~ (ubuntu|debian|pop|mint) ]] || [[ "$DISTRO_LIKE" =~ (ubuntu|debian) ]]; then
            MISSING_DEPS+=("libwebkit2gtk-4.1-dev")
        elif [[ "$DISTRO" =~ (fedora|rhel|centos) ]]; then
            MISSING_DEPS+=("webkit2gtk4.1-devel")
        elif [[ "$DISTRO" =~ (arch|manjaro) ]]; then
            MISSING_DEPS+=("webkit2gtk-4.1")
        fi
    fi

    check_lib "openssl" "OpenSSL Cryptographic Library" "libssl-dev" "openssl-devel" "openssl"
    check_lib "ayatana-appindicator3-0.1" "Ayatana AppIndicator" "libayatana-appindicator3-dev" "libayatana-appindicator-devel" "libayatana-appindicator"
    check_lib "librsvg-2.0" "RSVG Icon Renderer" "librsvg2-dev" "librsvg2-devel" "librsvg"

elif [ "$OS" = "darwin" ]; then
    echo -e "\n${BOLD}2. macOS System Frameworks:${RESET}"
    echo -e "  [${GREEN}✓${RESET}] Native WKWebView (Built-in)"
    echo -e "  [${GREEN}✓${RESET}] Apple Metal API (Built-in)"
    echo -e "  [${GREEN}✓${RESET}] Security Keychain (Built-in)"
fi

echo -e "\n${BOLD}3. Embedded Inference Sidecar (llama-server):${RESET}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

SIDECAR_FOUND=false
for path in \
    "${ROOT_DIR}/src-tauri/binaries/llama-server-x86_64-unknown-linux-gnu" \
    "${ROOT_DIR}/src-tauri/binaries/llama-server-x86_64-apple-darwin" \
    "${ROOT_DIR}/src-tauri/binaries/llama-server-aarch64-apple-darwin" \
    "${ROOT_DIR}/sidecars/binaries/llama-server"; do
    if [ -f "$path" ] && [ -x "$path" ]; then
        if [ ! -s "$path" ] || grep -q '^#!/bin/sh' "$path" 2>/dev/null; then
            continue
        fi
        echo -e "  [${GREEN}✓${RESET}] Found sidecar: ${CYAN}$path${RESET}"
        SIDECAR_FOUND=true
        break
    fi
done

if [ "$SIDECAR_FOUND" = false ]; then
    echo -e "  [${YELLOW}!${RESET}] Sidecar binary not fetched yet. Run: ${BOLD}./scripts/fetch-sidecar.sh${RESET}"
fi

echo -e "\n${BOLD}=== Summary & Next Steps ===${RESET}"

# Deduplicate missing deps
UNIQUE_DEPS=()
if [ ${#MISSING_DEPS[@]} -gt 0 ]; then
    # Read unique items into array
    while IFS= read -r dep; do
        [ -n "$dep" ] && UNIQUE_DEPS+=("$dep")
    done < <(printf '%s\n' "${MISSING_DEPS[@]}" | sort -u)
fi

if [ ${#UNIQUE_DEPS[@]} -eq 0 ]; then
    echo -e "${GREEN}${BOLD}✓ All core dependencies and libraries are satisfied!${RESET}"
    echo -e "You can now run:"
    echo -e "  ${CYAN}npm run tauri dev${RESET}   (Launch development app)"
    echo -e "  ${CYAN}npm run tauri build${RESET} (Package production desktop installer)"
else
    echo -e "${YELLOW}${BOLD}! Missing required dependencies:${RESET} ${UNIQUE_DEPS[*]}"
    echo -e "\n${BOLD}To install missing dependencies on your system:${RESET}\n"

    if [[ "$DISTRO" =~ (ubuntu|debian|pop|mint) ]] || [[ "$DISTRO_LIKE" =~ (ubuntu|debian) ]]; then
        FIX_COMMAND="sudo apt update && sudo apt install -y build-essential ${UNIQUE_DEPS[*]}"
    elif [[ "$DISTRO" =~ (fedora|rhel|centos) ]]; then
        FIX_COMMAND="sudo dnf install -y gcc-c++ make ${UNIQUE_DEPS[*]}"
    elif [[ "$DISTRO" =~ (arch|manjaro) ]]; then
        FIX_COMMAND="sudo pacman -S --needed base-devel ${UNIQUE_DEPS[*]}"
    else
        FIX_COMMAND="Please install: ${UNIQUE_DEPS[*]}"
    fi

    echo -e "  ${CYAN}${BOLD}${FIX_COMMAND}${RESET}\n"

    # If --install passed and user has sudo
    if [[ "${1:-}" == "--install" ]]; then
        echo -e "Executing fix command..."
        eval "$FIX_COMMAND"
    fi
fi
