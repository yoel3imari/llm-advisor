#!/usr/bin/env bash
# Quick launcher script for LLM Advisor Inference Streaming Demo
set -euo pipefail

PORT="${1:-3333}"
DEMO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "======================================================="
echo "   LLM Advisor — Inference Streaming Studio Demo"
echo "======================================================="
echo "Serving directory: ${DEMO_DIR}"
echo "URL: http://127.0.0.1:${PORT}"
echo ""

if command -v python3 >/dev/null 2>&1; then
  echo "Starting Python HTTP Server on port ${PORT}..."
  exec python3 -m http.server "${PORT}" --directory "${DEMO_DIR}"
elif command -v bun >/dev/null 2>&1; then
  echo "Starting Bun HTTP Server on port ${PORT}..."
  exec bun x serve "${DEMO_DIR}" -l "${PORT}"
elif command -v npx >/dev/null 2>&1; then
  echo "Starting npx serve on port ${PORT}..."
  exec npx serve "${DEMO_DIR}" -l "${PORT}"
else
  echo "No server runtime found. You can open ${DEMO_DIR}/index.html directly in your browser."
  exit 1
fi
