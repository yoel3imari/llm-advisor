#!/usr/bin/env bash
# ==============================================================================
# ModelSift — macOS Clean Uninstallation Script
# Completely removes app bundle, multi-GB GGUF models, cache, and Keychain tokens.
# ==============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${BOLD}${CYAN}=====================================================${NC}"
echo -e "${BOLD}${CYAN}  ModelSift — macOS Clean Uninstaller        ${NC}"
echo -e "${BOLD}${CYAN}=====================================================${NC}\n"

# 1. Terminate running processes
echo -e "${YELLOW}[1/4] Checking for running instances...${NC}"
if pgrep -x "llm-advisor" >/dev/null 2>&1 || pgrep -x "modelsift" >/dev/null 2>&1 || pgrep -f "llama-server" >/dev/null 2>&1; then
    echo "Stopping running ModelSift and sidecar processes..."
    pkill -x "llm-advisor" >/dev/null 2>&1 || true
    pkill -x "modelsift" >/dev/null 2>&1 || true
    pkill -f "llama-server" >/dev/null 2>&1 || true
    sleep 1
    echo -e "${GREEN}✓ Processes stopped.${NC}"
else
    echo "✓ No running processes found."
fi

# 2. Paths to clean
# Keep the pre-rename identifier directory so existing models and settings
# are removed by this script as well.
DATA_DIR="$HOME/Library/Application Support/dev.yoel3imari.llm-advisor"
CACHE_DIR="$HOME/Library/Caches/dev.yoel3imari.llm-advisor"
SAVED_STATES=(
    "$HOME/Library/Saved Application State/dev.yoel3imari.llm-advisor.savedState"
    "$HOME/Library/Saved Application State/ModelSift.savedState"
)
APP_BUNDLES=(
    "/Applications/ModelSift.app"
    "/Applications/LLM Advisor.app"
    "$HOME/Applications/ModelSift.app"
    "$HOME/Applications/LLM Advisor.app"
)

# Calculate space to be reclaimed
RECLAIM_SIZE="0 MB"
if [ -d "$DATA_DIR" ]; then
    RECLAIM_SIZE=$(du -sh "$DATA_DIR" 2>/dev/null | cut -f1 || echo "0 MB")
fi

echo -e "\n${YELLOW}[2/4] Storage to be reclaimed:${NC}"
echo "  • App Data & Models: $DATA_DIR ($RECLAIM_SIZE)"
echo "  • Application Bundles: ${APP_BUNDLES[*]}"

read -p "$(echo -e "${BOLD}Are you sure you want to permanently delete all models and data? [y/N]: ${NC}")" -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}Uninstallation aborted by user.${NC}"
    exit 1
fi

# 3. Clean files
echo -e "\n${YELLOW}[3/4] Removing files and directories...${NC}"
rm -rf "$DATA_DIR"
rm -rf "$CACHE_DIR"
for saved_state in "${SAVED_STATES[@]}"; do
    rm -rf "$saved_state"
done
for app_bundle in "${APP_BUNDLES[@]}"; do
    if [ -d "$app_bundle" ]; then
        rm -rf "$app_bundle"
        echo -e "${GREEN}✓ Removed $app_bundle${NC}"
    fi
done
echo -e "${GREEN}✓ Removed application data & model storage (${RECLAIM_SIZE} reclaimed).${NC}"

# 4. Clean Keychain credentials
echo -e "\n${YELLOW}[4/4] Clearing secure tokens from macOS Keychain...${NC}"
security delete-generic-password -s "llm-advisor" >/dev/null 2>&1 || true
security delete-generic-password -s "modelsift" >/dev/null 2>&1 || true
echo -e "${GREEN}✓ Keychain credentials cleared.${NC}"

echo -e "\n${BOLD}${GREEN}=====================================================${NC}"
echo -e "${BOLD}${GREEN}  Uninstallation complete! All data cleanly removed. ${NC}"
echo -e "${BOLD}${GREEN}=====================================================${NC}"
