#!/usr/bin/env bash
# ==============================================================================
# LLM Advisor — One-Command Installer (macOS & Linux)
#
# Installs the latest prebuilt release from GitHub Releases:
#
#   curl -fsSL https://raw.githubusercontent.com/yoel3imari/llm-advisor/main/install.sh | bash
#
# Pinned version:
#
#   curl -fsSL https://raw.githubusercontent.com/yoel3imari/llm-advisor/main/install.sh | bash -s -- --version v0.1.91
#
# Options:
#   --version TAG     Release tag (e.g. v0.1.91 or 0.1.91). Default: latest.
#   --format FMT      linux: auto|deb|rpm|appimage (default: auto).
#                     macos: dmg only (flag accepted and ignored).
#   --dry-run         Resolve release + print selected asset without installing.
#   --yes             Non-interactive (default; kept for explicitness).
#   -h, --help        Show this help.
#
# Windows users: this script cannot install natively. Download the .exe/.msi
# from https://github.com/yoel3imari/llm-advisor/releases instead.
# ==============================================================================
set -euo pipefail

REPO="yoel3imari/llm-advisor"
APP_NAME="LLM Advisor"
APP_BIN="llm-advisor"
API_BASE="https://api.github.com/repos/${REPO}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

VERSION="${INSTALL_VERSION:-latest}"
FORMAT="auto"
DRY_RUN=false

usage() {
    sed -n '2,/^# ===/p' "$0" | sed 's/^# \{0,1\}//'
}

log() { echo -e "${CYAN}==>${NC} $*"; }
ok() { echo -e "${GREEN}✓${NC} $*"; }
warn() { echo -e "${YELLOW}!${NC} $*" >&2; }
die() { echo -e "${RED}Error:${NC} $*" >&2; exit 1; }

while [ $# -gt 0 ]; do
    case "$1" in
        --version)
            [ $# -ge 2 ] || die "--version requires a value (e.g. --version v0.1.91)"
            VERSION="$2"; shift 2
            ;;
        --version=*)
            VERSION="${1#--version=}"; shift
            ;;
        --format)
            [ $# -ge 2 ] || die "--format requires a value (auto|deb|rpm|appimage)"
            FORMAT="$2"; shift 2
            ;;
        --format=*)
            FORMAT="${1#--format=}"; shift
            ;;
        --dry-run)
            DRY_RUN=true; shift
            ;;
        --yes)
            shift
            ;;
        -h|--help)
            usage; exit 0
            ;;
        *)
            die "Unknown argument: $1 (see --help)"
            ;;
    esac
done

case "${FORMAT}" in
    auto|deb|rpm|appimage|dmg) ;;
    *) die "--format must be one of: auto, deb, rpm, appimage" ;;
esac

command -v curl >/dev/null 2>&1 || die "curl is required but not installed."
command -v uname >/dev/null 2>&1 || die "uname is required but not installed."

OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"

# Normalize release tag: "0.1.91" -> "v0.1.91", "latest" stays as-is.
if [ "${VERSION}" != "latest" ] && [ "${VERSION#v}" = "${VERSION}" ]; then
    VERSION="v${VERSION}"
fi

# Windows Subsystem / Git-Bash cannot be served by a .sh installer.
case "${OS}" in
    *mingw*|*msys*|*cygwin*|windows_nt)
        die "Windows detected. Download the .exe/.msi from https://github.com/${REPO}/releases instead."
        ;;
esac

TMP_DIR="$(mktemp -d 2>/dev/null || mktemp -d -t llm-advisor-install)"
trap 'rm -rf "${TMP_DIR}"' EXIT

# Fetch release JSON (latest or pinned tag) into $1.
fetch_release_json() {
    local out="$1" url
    if [ "${VERSION}" = "latest" ]; then
        url="${API_BASE}/releases/latest"
    else
        url="${API_BASE}/releases/tags/${VERSION}"
    fi
    log "Querying release metadata (${VERSION})..."
    curl -fsSL --retry 3 --retry-delay 3 --connect-timeout 30 \
        -H "Accept: application/vnd.github+json" \
        -o "${out}" "${url}" \
        || die "Could not fetch release '${VERSION}'. Check the tag exists at https://github.com/${REPO}/releases."
}

# List browser_download_urls from release JSON ($1). Prefers python3, falls back to grep.
list_asset_urls() {
    local json="$1"
    if command -v python3 >/dev/null 2>&1; then
        python3 -c 'import json,sys; print("\n".join(a.get("browser_download_url","") for a in json.load(open(sys.argv[1])).get("assets",[]) if a.get("browser_download_url")))' "${json}"
    else
        grep -o '"browser_download_url": *"[^"]*"' "${json}" | cut -d'"' -f4
    fi
}

# Pick first URL from stdin matching extended regex $1 (case-insensitive).
pick_asset() {
    grep -i -E -m1 "$1" || true
}

resolve_asset_url() {
    local json="$1" urls asset=""
    urls="$(list_asset_urls "${json}")"
    [ -n "${urls}" ] || die "Release has no downloadable assets."

    if [ "${OS}" = "darwin" ]; then
        if [ "${ARCH}" = "arm64" ] || [ "${ARCH}" = "aarch64" ]; then
            asset="$(printf '%s\n' "${urls}" | pick_asset 'aarch64.*\.dmg$|arm64.*\.dmg$')"
        else
            asset="$(printf '%s\n' "${urls}" | pick_asset 'x86_64.*\.dmg$|x64.*\.dmg$|intel.*\.dmg$')"
            [ -n "${asset}" ] && warn "Intel macOS build selected. Official builds target Apple Silicon; Intel is best-effort."
        fi
        [ -z "${asset}" ] && asset="$(printf '%s\n' "${urls}" | pick_asset '\.dmg$')"
    elif [ "${OS}" = "linux" ]; then
        if [ "${ARCH}" = "arm64" ] || [ "${ARCH}" = "aarch64" ]; then
            die "Linux ARM64 has no prebuilt asset in this release (only x86_64). Build from source instead."
        fi
        case "${FORMAT}" in
            deb)
                asset="$(printf '%s\n' "${urls}" | pick_asset '\.deb$')"
                ;;
            rpm)
                asset="$(printf '%s\n' "${urls}" | pick_asset '\.rpm$')"
                ;;
            appimage)
                asset="$(printf '%s\n' "${urls}" | pick_asset '\.appimage$')"
                ;;
            auto)
                if [ -f /etc/os-release ]; then
                    # shellcheck disable=SC1091
                    . /etc/os-release
                    case "${ID:-unknown} ${ID_LIKE:-}" in
                        *fedora*|*rhel*|*centos*|*suse*)
                            asset="$(printf '%s\n' "${urls}" | pick_asset '\.rpm$')"
                            ;;
                        *)
                            asset="$(printf '%s\n' "${urls}" | pick_asset '\.deb$')"
                            ;;
                    esac
                fi
                [ -z "${asset}" ] && asset="$(printf '%s\n' "${urls}" | pick_asset '\.deb$')"
                [ -z "${asset}" ] && asset="$(printf '%s\n' "${urls}" | pick_asset '\.rpm$')"
                [ -z "${asset}" ] && asset="$(printf '%s\n' "${urls}" | pick_asset '\.appimage$')"
                ;;
        esac
    else
        die "Unsupported OS: ${OS} (${ARCH}). See https://github.com/${REPO}/releases for manual downloads."
    fi

    [ -n "${asset}" ] || die "No suitable asset found for ${OS}/${ARCH} (format=${FORMAT}). Browse https://github.com/${REPO}/releases manually."
    printf '%s' "${asset}"
}

install_macos_dmg() {
    local url="$1" dmg="$2"
    log "Downloading ${APP_NAME} for macOS (${ARCH})..."
    curl -fSL --retry 3 --retry-delay 3 --connect-timeout 30 -o "${dmg}" "${url}"
    [ -s "${dmg}" ] || die "Downloaded .dmg is empty."

    log "Mounting disk image..."
    local mount
    mount="$(hdiutil attach -nobrowse "${dmg}" | grep -E '/Volumes/' | tail -n1 | cut -f3- | sed 's/^ *//')"
    [ -n "${mount}" ] || die "Could not mount .dmg."
    # shellcheck disable=SC2064
    trap "hdiutil detach \"${mount}\" -quiet 2>/dev/null || true; rm -rf \"${TMP_DIR}\"" EXIT

    local app_src
    app_src="$(find "${mount}" -maxdepth 2 -name '*.app' | head -n1)"
    [ -n "${app_src}" ] || die "No .app bundle found inside the disk image."

    log "Copying $(basename "${app_src}") to /Applications (may prompt for password)..."
    if [ -d "/Applications/$(basename "${app_src}")" ]; then
        rm -rf "/Applications/$(basename "${app_src}")"
    fi
    cp -R "${app_src}" /Applications/ || sudo cp -R "${app_src}" /Applications/
    xattr -dr com.apple.quarantine "/Applications/$(basename "${app_src}")" 2>/dev/null || true

    hdiutil detach "${mount}" -quiet 2>/dev/null || true
    trap 'rm -rf "${TMP_DIR}"' EXIT
    ok "Installed to /Applications/$(basename "${app_src}")"
}

install_linux_deb() {
    local url="$1" pkg="$2"
    log "Downloading ${APP_NAME} (.deb)..."
    curl -fSL --retry 3 --retry-delay 3 --connect-timeout 30 -o "${pkg}" "${url}"
    [ -s "${pkg}" ] || die "Downloaded .deb is empty."

    log "Installing package (may prompt for sudo password)..."
    if sudo dpkg -i "${pkg}"; then
        ok "Installed via dpkg."
    else
        warn "Resolving missing runtime dependencies..."
        sudo apt-get update && sudo apt-get install -f -y
        ok "Installed via dpkg (dependencies resolved)."
    fi
}

install_linux_rpm() {
    local url="$1" pkg="$2"
    log "Downloading ${APP_NAME} (.rpm)..."
    curl -fSL --retry 3 --retry-delay 3 --connect-timeout 30 -o "${pkg}" "${url}"
    [ -s "${pkg}" ] || die "Downloaded .rpm is empty."

    log "Installing package (may prompt for sudo password)..."
    if command -v dnf >/dev/null 2>&1; then
        sudo dnf install -y "${pkg}"
    elif command -v zypper >/dev/null 2>&1; then
        sudo zypper --non-interactive install "${pkg}"
    else
        sudo rpm -Uvh "${pkg}"
    fi
    ok "Installed via rpm."
}

install_linux_appimage() {
    local url="$1" file="$2"
    local dest_dir="${HOME}/.local/bin"
    mkdir -p "${dest_dir}"
    log "Downloading ${APP_NAME} (.AppImage)..."
    curl -fSL --retry 3 --retry-delay 3 --connect-timeout 30 -o "${file}" "${url}"
    [ -s "${file}" ] || die "Downloaded .AppImage is empty."
    chmod +x "${file}"
    cp "${file}" "${dest_dir}/${APP_BIN}.AppImage"
    chmod +x "${dest_dir}/${APP_BIN}.AppImage"

    # Desktop entry so it appears in app launchers.
    local desktop_dir="${HOME}/.local/share/applications"
    mkdir -p "${desktop_dir}"
    cat > "${desktop_dir}/${APP_BIN}.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=${APP_NAME}
Exec=${dest_dir}/${APP_BIN}.AppImage
Terminal=false
Categories=Development;
EOF
    ok "Installed to ${dest_dir}/${APP_BIN}.AppImage"
    warn "If the AppImage fails to launch, install FUSE: sudo apt install -y libfuse2t64 (Ubuntu 24.04+) or libfuse2 (older)."
    case ":${PATH}:" in
        *":${dest_dir}:"*) ;;
        *) warn "Add ${dest_dir} to your PATH to launch from terminal." ;;
    esac
}

echo -e "${BOLD}${CYAN}=====================================================${NC}"
echo -e "${BOLD}${CYAN}  ${APP_NAME} — One-Command Installer (${OS}/${ARCH})${NC}"
echo -e "${BOLD}${CYAN}=====================================================${NC}"

RELEASE_JSON="${TMP_DIR}/release.json"
fetch_release_json "${RELEASE_JSON}"
TAG="$(grep -o '"tag_name": *"[^"]*"' "${RELEASE_JSON}" | head -n1 | cut -d'"' -f4)"
TAG="${TAG:-${VERSION}}"
ASSET_URL="$(resolve_asset_url "${RELEASE_JSON}")"
ASSET_FILE="$(basename "${ASSET_URL}")"

echo -e "Release: ${BOLD}${TAG}${NC}"
echo -e "Asset:   ${CYAN}${ASSET_FILE}${NC}"

if [ "${DRY_RUN}" = true ]; then
    echo -e "URL:     ${CYAN}${ASSET_URL}${NC}"
    log "Dry run — nothing installed."
    exit 0
fi

case "${ASSET_FILE}" in
    *.dmg)
        install_macos_dmg "${ASSET_URL}" "${TMP_DIR}/${ASSET_FILE}"
        ;;
    *.deb)
        install_linux_deb "${ASSET_URL}" "${TMP_DIR}/${ASSET_FILE}"
        ;;
    *.rpm)
        install_linux_rpm "${ASSET_URL}" "${TMP_DIR}/${ASSET_FILE}"
        ;;
    *.AppImage|*.appimage)
        install_linux_appimage "${ASSET_URL}" "${TMP_DIR}/${ASSET_FILE}"
        ;;
    *)
        die "Unknown asset type: ${ASSET_FILE}"
        ;;
esac

echo ""
ok "${APP_NAME} ${TAG} installed."
echo -e "Gateway (when a model is running): ${CYAN}http://127.0.0.1:13370/v1${NC}"
echo -e "Health check: ${CYAN}curl http://127.0.0.1:13370/healthz${NC}"
echo -e "Releases page: ${CYAN}https://github.com/${REPO}/releases${NC}"
