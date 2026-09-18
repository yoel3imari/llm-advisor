<div align="center">

<img src="./public/app-icon.png" alt="LLM Advisor Logo" width="96" height="96" />

# LLM Advisor

**Know before you download: will that model actually run on your machine?**

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Tauri 2.0](https://img.shields.io/badge/Tauri-2.0-24C8D8?logo=tauri&logoColor=white)](https://tauri.app/)
[![Rust 2021](https://img.shields.io/badge/Rust-1.80%2B-orange?logo=rust&logoColor=white)](https://www.rust-lang.org/)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Linux%20%7C%20Windows-lightgrey)](https://github.com/yoel3imari/llm-advisor/releases)

<p align="center">
  <a href="#why-llm-advisor">Why LLM Advisor</a> •
  <a href="#key-features">Key Features</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#connecting-your-developer-tools">Connect Tools</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#contributing">Contributing</a> •
  <a href="#reporting-issues">Reporting Issues</a>
</p>

</div>

---

## Why LLM Advisor?

Running open-weight LLMs locally sounds simple until you actually try it. We've all been there:

* **The 14 GB surprise:** You wait an hour for a download to finish, hit run, and the whole thing crashes because the KV cache pushed you past your VRAM limit. Nobody warned you.
* **Heavyweight wrappers:** A lot of existing desktop apps ship 500 MB to 1 GB+ Electron bundles just to launch a local model. That feels wrong for a tool developers keep open all day.
* **Cryptic CLI flags:** Getting `llama.cpp` tuned right means juggling `-ngl`, `-c`, `-fa`, context sizes, and port bindings — and actually understanding what quantization does to memory.

LLM Advisor exists to take that guesswork out. It's a small, fast desktop app built with **Tauri 2**, **Rust**, and **React 19**. It looks at your actual hardware — Apple Silicon unified memory, an NVIDIA/AMD GPU, or plain CPU RAM — does the real memory math (weights + KV cache + overhead), fetches verified GGUF files for you, and serves the model through a plain **OpenAI-compatible API at `http://127.0.0.1:13370/v1`**.

No trial and error. You know before you download whether a model fits.

---

## Key Features

* **Honest memory math:** Real-time fit calculation using proper GQA (Grouped-Query Attention) KV cache sizing, your chosen context window (2K up to 32K+), and GPU offload layers. You get a straight answer: Fits, Tight Fit, or Exceeds Limits.
* **Small and fast:** Native Rust backend, ThinLTO-optimized — roughly a 13 MB core binary and a ~30 MB installer. No bundled Chromium.
* **Downloads you can trust:** Resumable multi-stream downloads straight from HuggingFace Hub, with SHA-256 verification and a check of the actual GGUF header (`n_layers`, `n_kv_heads`, `head_dim`) so a bad file never slips through.
* **Works with the tools you already use:** A zero-buffering OpenAI gateway fixed at `http://127.0.0.1:13370/v1`. Point Cursor, Continue, Cline, Aider, the OpenAI Python/TS SDKs, or plain `curl` at it and it just works.
* **It manages the server for you:** Spawns and watches the `llama-server` sidecar, waits for it to become healthy, isolates its port, and cleans everything up when you quit.
* **Cross-platform:** Tuned for macOS (Metal / Accelerate), Linux (AVX2 / Zen4 kernels), and Windows.

---

## Quick Start

### Option A: One-Command Install (macOS and Linux)

The fastest way — grabs the latest release from GitHub:

```bash
curl -fsSL https://raw.githubusercontent.com/yoel3imari/llm-advisor/main/install.sh | bash
```

A few useful variations:

```bash
curl -fsSL https://raw.githubusercontent.com/yoel3imari/llm-advisor/main/install.sh | bash -s -- --version v0.1.91
curl -fsSL https://raw.githubusercontent.com/yoel3imari/llm-advisor/main/install.sh | bash -s -- --dry-run
curl -fsSL https://raw.githubusercontent.com/yoel3imari/llm-advisor/main/install.sh | bash -s -- --format appimage
```

> **Windows:** grab the `.exe` / `.msi` from [Releases](https://github.com/yoel3imari/llm-advisor/releases) directly.

### Option B: Download a Release Manually

Head to [Releases](https://github.com/yoel3imari/llm-advisor/releases) and pick your installer:

* **macOS:** `.dmg` (Apple Silicon)
* **Linux:** `.AppImage` (portable) or `.deb` / `.rpm`
* **Windows:** `.exe` / `.msi` (x64)

### Option C: Build from Source

#### Prerequisites

1. **Rust toolchain** (1.80+):
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```
2. **Node.js** (v18+) and `npm`:
   ```bash
   node -v
   ```
3. **Platform build dependencies:**
   * **Linux (Ubuntu/Debian):**
     ```bash
     sudo apt update && sudo apt install -y build-essential pkg-config libssl-dev libgtk-3-dev libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev
     ```
   * **macOS:** Xcode Command Line Tools (`xcode-select --install`)
   * **Windows:** Visual Studio 2022 with C++ Build Tools

#### Development Setup

```bash
# 1. Clone the repo
git clone https://github.com/yoel3imari/llm-advisor.git
cd llm-advisor

# 2. Install frontend dependencies
npm install

# 3. Fetch the pinned llama.cpp sidecar
npm run sidecar:fetch

# 4. Run in dev mode with hot reload
npm run tauri dev
```

#### Production Packaging

```bash
# Builds the frontend and packages a release bundle
npm run tauri build
```

---

## Connecting Your Developer Tools

Once a model is running, LLM Advisor speaks plain OpenAI protocol at **`http://127.0.0.1:13370/v1`**. Anything that talks to OpenAI can talk to it.

### 1. Coding Agents

Point your assistant at LLM Advisor:

* **Base URL:** `http://127.0.0.1:13370/v1`
* **API Key:** anything works, e.g. `local` or `not-needed`
* **Model:** the ID of the model you loaded (or `default`)

### 2. Python (official `openai` SDK)

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://127.0.0.1:13370/v1",
    api_key="not-needed",
)

response = client.chat.completions.create(
    model="llama-3.1-8b-instruct-q4_k_m",
    messages=[
        {"role": "system", "content": "You are a concise software architect."},
        {"role": "user", "content": "Explain Grouped-Query Attention in 2 sentences."},
    ],
    stream=True,
)

for chunk in response:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="", flush=True)
print()
```

### 3. Streaming cURL

```bash
curl -N http://127.0.0.1:13370/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "active-model",
    "messages": [{"role": "user", "content": "Hello LLM Advisor!"}],
    "stream": true
  }'
```

### 4. Health Check

```bash
curl http://127.0.0.1:13370/healthz
# Returns: {"status":"ok","state":"serving","model":"qwen2.5-coder-7b-instruct-q4_k_m","internal_port":18421}
```

---

## Architecture

Under the hood it's a modular Rust workspace with a React 19 frontend:

```
llm-advisor/
├── crates/
│   ├── domain/           # Shared domain types, ServeConfig, FitResult, and error taxonomy
│   ├── hw_probe/         # Hardware inspection (sysinfo, macOS Metal sysctl, GPU bandwidth tables)
│   ├── fit_engine/       # Memory-fit math, GQA KV sizing and roofline models
│   ├── catalog/          # Curated GGUF catalog parsing, validation, and CDN sync
│   ├── downloader/       # Resumable Range downloader, streaming SHA-256 hasher and GGUF header parser
│   ├── library/          # Local model files, state storage and reconciliation
│   ├── server_manager/   # Supervised child process manager for llama-server
│   └── gateway/          # Axum HTTP/SSE reverse proxy, strictly bound to port 13370
├── src-tauri/            # Tauri 2 shell, capabilities, and IPC commands
├── src/                  # React 19 + TypeScript + Vite + Tailwind CSS + shadcn/ui frontend
├── public/               # Static assets and app icon
├── scripts/              # Sidecar provisioning and bundle helpers
└── docs/                 # Architecture Decision Records (ADRs) and technical guides
```

---

## Testing and Verification

Tests cover both the Rust backend and the React frontend:

```bash
# All Rust unit and integration tests
cargo test --workspace

# TypeScript type checks and Vitest suites
npm test

# Sanity-check the production frontend bundle
npm run build

# Formatting and linting
cargo fmt --check
cargo clippy --workspace --all-targets -- -D warnings
```

---

## Contributing

Contributions are welcome — whether that's adding a new model architecture, improving hardware detection, polishing the UI, or fixing a bug you ran into.

### Development Workflow

1. **Fork the repo** on GitHub.
2. **Create a feature branch:**
   ```bash
   git checkout -b feat/your-feature-name
   ```
3. **Set things up locally:**
   ```bash
   npm install
   npm run sidecar:fetch
   npm run tauri dev
   ```
4. **Keep the standards:**
   * Format Rust with `cargo fmt`.
   * Keep `cargo clippy --workspace --all-targets` warning-free.
   * Make sure tests pass (`cargo test` and `npm test`).
   * Respect the guardrails in [`AGENTS.md`](AGENTS.md).
5. **Open a pull request:**
   * Say clearly what you fixed and what tests you added.
   * Link any related issues.

More detail in the [Contributing Guide](CONTRIBUTING.md).

---

## Reporting Issues and Feature Requests

Found a bug, hit a hardware detection quirk, or have an idea? We'd genuinely like to hear about it.

* **Check first:** have a quick look at [GitHub Issues](https://github.com/yoel3imari/llm-advisor/issues) to avoid duplicates.
* **Filing a bug report** — it helps a lot if you include:
  1. **OS and architecture:** e.g. macOS 14.5 on M3, Ubuntu 24.04 x86_64, Windows 11.
  2. **Hardware:** total RAM, GPU model, VRAM size.
  3. **Model and context:** the exact model ID and context size you tried.
  4. **Logs:** check the **Server Logs** tab in the app, or look in:
     * **Linux:** `~/.local/share/dev.yoel3imari.llm-advisor/`
     * **macOS:** `~/Library/Application Support/dev.yoel3imari.llm-advisor/`
     * **Windows:** `%LOCALAPPDATA%\dev.yoel3imari.llm-advisor\`
  5. **Steps to reproduce:** numbered steps work best.
* **Feature requests:** open an issue with what you want, why you want it, and any alternatives you've considered.

---

## License

LLM Advisor is open source under the [GNU General Public License v3.0](LICENSE).
Inference sidecars use upstream binaries from [`llama.cpp`](https://github.com/ggml-org/llama.cpp) (MIT License).
