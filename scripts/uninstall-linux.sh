#!/usr/bin/env bash
# ==============================================================================
# Local LLM Advisor — Linux Clean Uninstallation Script
# Completely removes application data, multi-GB GGUF models, and config.
# ==============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${BOLD}${CYAN}=====================================================${NC}"
echo -e "${BOLD}${CYAN}  Local LLM Advisor — Linux Clean Uninstaller        ${NC}"
echo -e "${BOLD}${CYAN}=====================================================${NC}\n"

# 1. Terminate running processes
echo -e "${YELLOW}[1/3] Checking for running instances...${NC}"
if pgrep -x "local-llm-advisor" >/dev/null 2>&1 || pgrep -f "llama-server" >/dev/null 2>&1; then
    echo "Stopping running Local LLM Advisor and sidecar processes..."
    pkill -x "local-llm-advisor" >/dev/null 2>&1 || true
    pkill -f "llama-server" >/dev/null 2>&1 || true
    sleep 1
    echo -e "${GREEN}✓ Processes stopped.${NC}"
else
    echo "✓ No running processes found."
fi

# 2. Paths to clean
XDG_DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}"
XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}"

DATA_DIR="$XDG_DATA_HOME/dev.portfolio.local-llm-advisor"
CONFIG_DIR="$XDG_CONFIG_HOME/dev.portfolio.local-llm-advisor"
DESKTOP_FILE="$XDG_DATA_HOME/applications/local-llm-advisor.desktop"

RECLAIM_SIZE="0 MB"
if [ -d "$DATA_DIR" ]; then
    RECLAIM_SIZE=$(du -sh "$DATA_DIR" 2>/dev/null | cut -f1 || echo "0 MB")
fi

echo -e "\n${YELLOW}[2/3] Storage to be reclaimed:${NC}"
echo "  • App Data & Models: $DATA_DIR ($RECLAIM_SIZE)"
echo "  • Configuration:     $CONFIG_DIR"

read -p "$(echo -e "${BOLD}Are you sure you want to permanently delete all models and data? [y/N]: ${NC}")" -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}Uninstallation aborted by user.${NC}"
    exit 1
fi

# 3. Clean files
echo -e "\n${YELLOW}[3/3] Removing files and directories...${NC}"
rm -rf "$DATA_DIR"
rm -rf "$CONFIG_DIR"
rm -f "$DESKTOP_FILE"
echo -e "${GREEN}✓ Removed application data & model storage (${RECLAIM_SIZE} reclaimed).${NC}"

echo -e "\n${BOLD}${GREEN}=====================================================${NC}"
echo -e "${BOLD}${GREEN}  Uninstallation complete! All data cleanly removed. ${NC}"
echo -e "${BOLD}${GREEN}=====================================================${NC}"
