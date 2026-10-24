#!/usr/bin/env bash
# ==============================================================================
# ModelSift — One-Command Installer (macOS & Linux)
#
# Installs the latest prebuilt release from GitHub Releases:
#
#   curl -fsSL https://raw.githubusercontent.com/yoel3imari/modelsift/main/install.sh | bash
#
# Pinned version:
#
#   curl -fsSL https://raw.githubusercontent.com/yoel3imari/modelsift/main/install.sh | bash -s -- --version v0.1.91
#
# Options:
#   --version TAG     Release tag (e.g. v0.1.91 or 0.1.91). Default: latest.
#   --format FMT      linux: auto|deb|rpm|appimage (default: auto).
#                     macos: dmg only (flag accepted and ignored).
#   --dry-run         Resolve release + print selected asset without installing.
#   --yes             Non-interactive (default; kept for explicitness).
#   -h, --help        Show this help.
#
# Requirements (prebuilt binaries):
#   Linux:  glibc >= 2.39 — Ubuntu 24.04+, Debian 13+, Fedora 40+,
#           RHEL/Rocky/Alma 10+, openSUSE Leap 16+/Tumbleweed.
#   macOS:  15.0+ (Sequoia).
#   Older systems: build from source —
#   https://github.com/yoel3imari/modelsift#option-c-build-from-source
#
# Windows users: this script cannot install natively. Download the .exe/.msi
# from https://github.com/yoel3imari/modelsift/releases instead.
# ==============================================================================
set -euo pipefail

REPO="yoel3imari/modelsift"
APP_NAME="ModelSift"
APP_BIN="llm-advisor"
API_BASE="https://api.github.com/repos/${REPO}"

# Minimum supported system versions for the prebuilt binaries. Keep in sync:
#   - Linux floor is set by the release build host (ubuntu-24.04 -> glibc 2.39);
#     see .github/workflows/release.yml (runs-on) and AGENTS.md section 8.
#   - macOS floor must match bundle.macOS.minimumSystemVersion in
#     src-tauri/tauri.conf.json (upstream llama.cpp sidecar build floor).
MIN_GLIBC="2.39"
MIN_MACOS="15.0"

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

# True when dotted numeric version $1 >= $2 (pure awk; BSD/macOS portable).
version_ge() {
    awk -v a="$1" -v b="$2" 'BEGIN {
        na = split(a, A, "."); nb = split(b, B, ".")
        n = (na > nb) ? na : nb
        for (i = 1; i <= n; i++) {
            x = (i <= na) ? A[i] + 0 : 0
            y = (i <= nb) ? B[i] + 0 : 0
            if (x != y) exit (x > y) ? 0 : 1
        }
        exit 0
    }'
}

# Enforce the macOS floor (matches bundle.macOS.minimumSystemVersion).
require_macos_version() {
    local ver
    ver="$(sw_vers -productVersion 2>/dev/null || true)"
    if [ -z "${ver}" ]; then
        warn "Could not detect the macOS version; ${APP_NAME} requires macOS ${MIN_MACOS}+."
        return 0
    fi
    if version_ge "${ver}" "${MIN_MACOS}"; then
        ok "macOS ${ver} (minimum supported: ${MIN_MACOS})"
    else
        die "macOS ${ver} is not supported. The app and its bundled llama.cpp sidecar require macOS ${MIN_MACOS}+ (Sequoia). Upgrade macOS, or build from source: https://github.com/${REPO}#option-c-build-from-source"
    fi
}

# Enforce the glibc floor imposed by the Linux release build host (ubuntu-24.04).
require_linux_glibc() {
    local ver

    if ldd --version 2>&1 | head -n 1 | grep -qi 'musl'; then
        die "musl libc detected (e.g. Alpine). The prebuilt binaries are linked against glibc — build from source instead: https://github.com/${REPO}#option-c-build-from-source"
    fi

    ver="$(getconf GNU_LIBC_VERSION 2>/dev/null | awk '{print $NF}' || true)"
    if [ -z "${ver}" ]; then
        ver="$(ldd --version 2>/dev/null | head -n 1 | grep -oE '[0-9]+\.[0-9]+(\.[0-9]+)?' | tail -n 1 || true)"
    fi
    if [ -z "${ver}" ]; then
        warn "Could not detect the glibc version; ${APP_NAME} requires glibc ${MIN_GLIBC}+."
        return 0
    fi
    if version_ge "${ver}" "${MIN_GLIBC}"; then
        ok "glibc ${ver} (minimum supported: ${MIN_GLIBC})"
    else
        die "glibc ${ver} is too old. The prebuilt binaries require glibc ${MIN_GLIBC}+ — Ubuntu 24.04+, Debian 13+, Fedora 40+, RHEL/Rocky/Alma 10+, openSUSE Leap 16+ or Tumbleweed. Upgrade, or build from source: https://github.com/${REPO}#option-c-build-from-source"
    fi
}

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
    local rc=0
    local install_log="${TMP_DIR}/rpm-install.log"
    if command -v dnf >/dev/null 2>&1; then
        sudo dnf install -y "${pkg}" 2>&1 | tee "${install_log}" || rc=${PIPESTATUS[0]}
    elif command -v zypper >/dev/null 2>&1; then
        sudo zypper --non-interactive install "${pkg}" 2>&1 | tee "${install_log}" || rc=${PIPESTATUS[0]}
    else
        sudo rpm -Uvh "${pkg}" 2>&1 | tee "${install_log}" || rc=${PIPESTATUS[0]}
    fi
    if [ "${rc}" -eq 0 ]; then
        ok "Installed via rpm."
        return 0
    fi

    # Releases up to v0.2.3 declare Requires: libayatana-appindicator — the
    # openSUSE *source* package name, which no distribution provides — so
    # dnf/zypper abort with "nothing provides libayatana-appindicator" even
    # though the library itself is also required via a portable soname.
    # The metadata is fixed for the next release; offer remediation paths.
    if rpm -qpR "${pkg}" 2>/dev/null | grep -qx 'libayatana-appindicator' &&
        grep -q 'libayatana-appindicator' "${install_log}"; then
        warn "Known packaging bug in this release: the .rpm requires"
        warn "'libayatana-appindicator', a package name that does not exist on"
        warn "Fedora/RHEL/openSUSE. Fixed in the next release."
        echo ""
        echo -e "  ${BOLD}Option 1${NC} — install the self-contained build instead:"
        echo -e "      curl -fsSL https://raw.githubusercontent.com/${REPO}/main/install.sh | bash -s -- --format appimage"
        echo ""
        echo -e "  ${BOLD}Option 2${NC} — install the runtime library, then force the .rpm:"
        echo -e "      # Fedora/RHEL:  sudo dnf install -y libayatana-appindicator-gtk3"
        echo -e "      # openSUSE:     sudo zypper install -y libayatana-appindicator3-1"
        echo -e "      curl -fSL -o /tmp/llm-advisor.rpm '${url}'"
        echo -e "      sudo rpm -Uvh --nodeps /tmp/llm-advisor.rpm"
        die "RPM install failed due to the packaging bug above."
    fi
    die "RPM install failed. Check the resolver output above, or browse https://github.com/${REPO}/issues."
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
    warn "If the AppImage fails to launch, install FUSE: sudo apt install -y libfuse2t64 (Ubuntu 24.04+), libfuse2 (older), or sudo dnf install -y fuse-libs (Fedora)."
    case ":${PATH}:" in
        *":${dest_dir}:"*) ;;
        *) warn "Add ${dest_dir} to your PATH to launch from terminal." ;;
    esac
}

echo -e "${BOLD}${CYAN}=====================================================${NC}"
echo -e "${BOLD}${CYAN}  ${APP_NAME} — One-Command Installer (${OS}/${ARCH})${NC}"
echo -e "${BOLD}${CYAN}=====================================================${NC}"

# Refuse to install on systems the prebuilt binaries cannot run on.
if [ "${OS}" = "darwin" ]; then
    require_macos_version
elif [ "${OS}" = "linux" ]; then
    require_linux_glibc
fi

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
