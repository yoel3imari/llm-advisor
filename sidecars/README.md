# LLM Advisor — Sidecar Management

This directory contains the pinned `llama-server` binary utilized by the desktop app for local inference.

## Pinned Release Specification
- **Upstream Repository**: `https://github.com/ggml-org/llama.cpp`
- **Pinned Release Tag**: `b10645`
- **Target Architecture**: macOS Apple Intel (`x86_64-apple-darwin`) & Linux x86_64 (`x86_64-unknown-linux-gnu`)
- **Tauri 2 Target Triples**:
  - `src-tauri/binaries/llama-server-x86_64-apple-darwin`
  - `src-tauri/binaries/llama-server-x86_64-unknown-linux-gnu`

## Provisioning
Run the fetch script:
```bash
./scripts/fetch-sidecar.sh
```
The script will download, extract, and link the executable into `src-tauri/binaries/` with the appropriate Tauri triple.
