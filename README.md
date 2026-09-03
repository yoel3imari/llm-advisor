<div align="center">

<img src="public/app-icon.png" alt="LLM Advisor Logo" width="96" height="96" />

# LLM Advisor

**Deterministic Hardware-Fit Calculator, Model Library & Supervised Local LLM Gateway**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Tauri 2.0](https://img.shields.io/badge/Tauri-2.0-24C8D8?logo=tauri&logoColor=white)](https://tauri.app/)
[![Rust 2021](https://img.shields.io/badge/Rust-1.80%2B-orange?logo=rust&logoColor=white)](https://www.rust-lang.org/)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Linux%20%7C%20Windows-lightgrey)](https://github.com/yoel3imari/llm-advisor/releases)

<p align="center">
  <a href="#-why-llm-advisor">Why LLM Advisor</a> •
  <a href="#-key-features">Key Features</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-connecting-your-developer-tools">Connect Tools</a> •
  <a href="#-architecture">Architecture</a> •
  <a href="#-contributing">Contributing</a> •
  <a href="#-reporting-issues">Reporting Issues</a>
</p>

</div>

---

## 💡 Why LLM Advisor?

Finding the best open-weight Large Language Models (LLM) and running it locally is frustrating:
* **Guesswork & Out-of-Memory Crashes**: You download a 14 GB model, only to crash when KV cache allocations overflow your VRAM or system RAM.
* **Bloated Runtimes**: Existing desktop wrappers frequently ship 500 MB – 1 GB+ Electron builds bundling redundant Chromium runtimes.
* **Complex CLI Flags**: Manually configuring `llama.cpp` arguments (`-ngl`, `-c`, `-fa`, `-ctk`, `-ctv`, port bindings) requires deep familiarity with quantization internals.

**LLM Advisor solves this.** Built with **Tauri 2**, **Rust**, and **React 19**, it profiles your host hardware (Apple Silicon unified memory, discrete NVIDIA/AMD GPUs, or CPU RAM budgets), solves exact memory formulas (weights + GQA KV cache + activation buffers), downloads verified GGUF weights, and runs an embedded `llama.cpp` sidecar behind a zero-buffering **OpenAI-compatible gateway on `http://127.0.0.1:13370/v1`**.

---

## ✨ Key Features

* 🧮 **Deterministic Memory-Fit Math**: Real-time evaluation of GQA (Grouped-Query Attention) KV cache sizing, context window targets (2K – 32K+), and GPU offload layers (`-ngl`). Clear status badges indicate **Fits**, **Tight Fit**, or **Exceeds Limits**.
* ⚡ **Ultra-Lean & High-Performance**: Native Rust backend with a ThinLTO-optimized release footprint (~13 MB core binary, ~30 MB installer).
* 📥 **Resumable GGUF Downloader**: Multi-stream HTTP Range downloads directly from HuggingFace Hub with SHA-256 checksum verification and binary GGUF header inspection (`n_layers`, `n_kv_heads`, `head_dim`).
* 🔌 **Zero-Buffering OpenAI Gateway**: Strictly bound to `http://127.0.0.1:13370/v1`. Instantly connects to **Cursor**, **Continue**, **Cline**, **Aider**, **OpenAI Python/TS SDKs**, or standard `curl`.
* 🛡️ **Supervised Sidecar Execution**: Automatic child process lifecycle management (`llama-server`) with health-polling timeouts, dynamic port isolation, and automated cleanup on app exit.
* 💻 **Cross-Platform**: Tailored optimizations for macOS (Metal / Accelerate), Linux (AVX2 / Zen4 runtime kernels), and Windows.

---

## 🚀 Quick Start

### Option A: Download Pre-Built Releases
Grab the latest signed installer for your operating system from [Releases](https://github.com/yoel3imari/llm-advisor/releases):
* **macOS**: `.dmg` (Universal Apple Silicon & Intel)
* **Linux**: `.AppImage` (portable standalone) or `.deb` / `.rpm`
* **Windows**: `.exe` / `.msi` (x64)

### Option B: Build from Source

#### Prerequisites
1. **Rust toolchain** (1.80+):
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```
2. **Node.js** (v18+) & `npm`:
   ```bash
   node -v
   ```
3. **Platform Build Libraries**:
   * **Linux (Ubuntu/Debian)**:
     ```bash
     sudo apt update && sudo apt install -y build-essential pkg-config libssl-dev libgtk-3-dev libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev
     ```
   * **macOS**: Xcode Command Line Tools (`xcode-select --install`)
   * **Windows**: Visual Studio 2022 with C++ Build Tools

#### Development Setup
```bash
# 1. Clone the repository
git clone https://github.com/yoel3imari/llm-advisor.git
cd llm-advisor

# 2. Install web frontend dependencies
npm install

# 3. Provision the pinned llama.cpp sidecar
npm run sidecar:fetch

# 4. Launch in development mode with hot reloading
npm run tauri dev
```

#### Production Packaging
```bash
# Builds the production web frontend and packages platform bundles
npm run tauri build
```

---

## 🔌 Connecting Your Developer Tools

When a model is running, LLM Advisor exposes a standard OpenAI-compatible API on **`http://127.0.0.1:13370/v1`**.

### 1. Coding Agents
Configure your AI coding assistant to point to LLM Advisor:
* **Base URL**: `http://127.0.0.1:13370/v1`
* **API Key**: Any placeholder (e.g. `local` or `not-needed`)
* **Model**: Use the ID of your loaded model (or `default`)

### 2. Python (Official `openai` SDK)
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

## 🏗️ Architecture

LLM Advisor is architected as a modular Rust Cargo workspace coupled with an accessible React 19 webview:

```
llm-advisor/
├── crates/
│   ├── domain/           # Shared domain types, ServeConfig, FitResult, and error taxonomy
│   ├── hw_probe/         # Hardware inspection (sysinfo, macOS Metal sysctl, GPU bandwidth tables)
│   ├── fit_engine/       # Mathematical memory-fit calculations, GQA KV sizing & roofline models
│   ├── catalog/          # Curated GGUF catalog parsing, validation, and CDN synchronization
│   ├── downloader/       # Resumable Range downloader, streaming SHA-256 hasher & GGUF header parser
│   ├── library/          # Local model filesystem management, state storage & reconciliation
│   ├── server_manager/   # Supervised child process manager for llama-server
│   └── gateway/          # Axum HTTP/SSE reverse proxy gateway bound strictly to port 13370
├── src-tauri/            # Tauri 2 application shell, capabilities, and IPC commands
├── src/                  # React 19 + TypeScript + Vite + Tailwind CSS + shadcn/ui frontend
├── public/               # Static assets & application icon
├── scripts/              # Automated sidecar provisioning and bundle preparation scripts
└── docs/                 # Architectural Decision Records (ADRs) and technical guides
```

---

## 🧪 Testing & Verification

Automated test suites are maintain across both the Rust backend and React frontend:

```bash
# Run all Rust unit and integration tests across member crates
cargo test --workspace

# Run TypeScript type checks and Vitest component test suites
npm test

# Verify production Vite asset bundling
npm run build

# Code formatting & linting
cargo fmt --check
cargo clippy --workspace --all-targets -- -D warnings
```

---

## 🤝 Contributing

Community contributions are welcomed! Whether you are adding support for new model architectures, improving hardware probing on BSD/ARM, refining the UI, or fixing bugs, here is how you can get started:

### Development Workflow
1. **Fork the repository** on GitHub.
2. **Create a descriptive feature branch**:
   ```bash
   git checkout -b feat/your-feature-name
   ```
3. **Set up local development**:
   ```bash
   npm install
   npm run sidecar:fetch
   npm run tauri dev
   ```
4. **Adhere to Code Standards**:
   * Format Rust code with `cargo fmt`.
   * Ensure `cargo clippy --workspace --all-targets` produces zero warnings.
   * Ensure all tests pass (`cargo test` and `npm test`).
   * Preserve architectural guardrails documented in [`AGENTS.md`](AGENTS.md).
5. **Submit a Pull Request**:
   * Provide a clear description of the problem solved and test cases added.
   * Reference any related open issues.

For more details, see our [Contributing Guide](CONTRIBUTING.md).

---

## 🐛 Reporting Issues & Feature Requests

Encountered a bug, hardware detection glitch, or have an idea for a feature? I want to hear from you!

* **Search Existing Issues**: Please check the [GitHub Issues](https://github.com/yoel3imari/llm-advisor/issues) tracker before creating a new report to avoid duplicates.
* **Filing a Bug Report**:
  When submitting a bug, please include:
  1. **Operating System & Architecture**: (e.g., macOS 14.5 Apple Silicon M3, Ubuntu 24.04 x86_64, Windows 11).
  2. **Hardware Specs**: Total RAM, GPU model, and VRAM amount.
  3. **Model & Context**: The exact model ID and context size you were attempting to run.
  4. **Logs**: Check the **Server Logs** tab inside the app or inspect logs in:
     * **Linux**: `~/.local/share/dev.yoel3imari.llm-advisor/`
     * **macOS**: `~/Library/Application Support/dev.yoel3imari.llm-advisor/`
     * **Windows**: `%LOCALAPPDATA%\dev.yoel3imari.llm-advisor\`
  5. **Steps to Reproduce**: Clear, numbered steps to trigger the behavior.
* **Feature Requests**: Open an issue describing the proposed feature, the use case, and any alternatives you have considered.

---

## 📄 License

LLM Advisor is open-source software licensed under the [MIT License](LICENSE).
Inference sidecars utilize upstream binaries from [`llama.cpp`](https://github.com/ggml-org/llama.cpp) (MIT License).
