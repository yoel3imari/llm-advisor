# Local LLM Advisor (`llm-advisor`)

> **Intelligent, explainable local LLM recommendations, verified GGUF downloads, and an embedded high-performance inference engine with an OpenAI-compatible gateway.**

---

## 🌟 Overview

**Local LLM Advisor** is a self-contained desktop application built with **Tauri 2**, **Rust**, and **React 19**. It inspects host hardware (CPU, system RAM, discrete/integrated GPU VRAM, Metal working sets), calculates mathematically rigorous model-fit recommendations, manages verified GGUF model downloads directly from HuggingFace, and serves an embedded `llama-server` inference sidecar behind a zero-buffering OpenAI-compatible HTTP proxy on `127.0.0.1:13370`.

---

## 🚀 Key Features

* **🔍 Hardware Inspection & Profiling**:
  * Real-time detection of host CPU cores, total system RAM, GPU brand/VRAM, and macOS Metal working-set limits without blocking startup.
* **🧮 Deterministic Memory-Fit Engine**:
  * Explainable calculations modeling model weights, **Grouped-Query Attention (GQA)** KV cache sizing, activation safety margins, and runtime overhead.
  * Solves `max_context_that_fits` and recommended GPU layer offload (`-ngl`) targets based on available memory budgets.
* **📥 Resumable Downloader & Integrity Verification**:
  * Range-request resumption against HuggingFace Hub CDN.
  * Streaming SHA256 checksum verification against HuggingFace LFS ETags.
  * Binary GGUF header parser validating `n_layers`, `n_kv_heads`, and `head_dim` post-download.
* **⚡ Sidecar Lifecycle Management**:
  * Supervised single-instance `llama-server` sidecar process management with automatic free internal port selection and graceful termination (`SIGTERM` → `SIGKILL`).
  * Dynamic health-polling timeouts (60s–300s) proportional to model file size.
* **🔌 OpenAI-Compatible Reverse Proxy Gateway**:
  * Bound strictly to `127.0.0.1:13370` for security and client determinism.
  * SSE token streaming with zero buffering for `/v1/chat/completions` and `/v1/completions`.
  * Structured JSON HTTP 503 envelopes when idle.
  * Fully compatible with standard OpenAI SDKs, `curl`, Cursor, Continue, Cline, and Aider.

---

## 🏗️ Architecture & Monorepo Structure

```
llm-advisor/
├── crates/
│   ├── domain/           # Core domain types, ServeConfig, FitResult, and AppError taxonomy
│   ├── hw_probe/         # Hardware detection (sysinfo, Metal queries, system_profiler)
│   ├── fit_engine/       # Mathematical memory-fit calculation engine & golden test suites
│   ├── catalog/          # Curated GGUF model catalog loader & metadata
│   ├── downloader/       # Resumable Range downloader, SHA256 hasher & GGUF header parser
│   ├── library/          # Local GGUF file store, state management & disk reconciliation
│   ├── server_manager/   # Child process supervisor for llama-server with health polling
│   └── gateway/          # Axum HTTP/SSE reverse proxy gateway bound to 127.0.0.1:13370
├── src-tauri/            # Tauri 2 application shell, capabilities, and IPC commands
├── src/                  # React 19 + TypeScript + Vite + Tailwind CSS frontend UI
├── docs/                 # System architecture diagrams, ADRs, and technical analyses
└── scripts/              # Sidecar fetchers, catalog build utilities, and validation spikes
```

---

## 💻 System Prerequisites & Setup

### 🍎 macOS (Apple Silicon & Apple Intel)

1. **Install Xcode Command Line Tools**:
   ```bash
   xcode-select --install
   ```
2. **Install Rust**:
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   source "$HOME/.cargo/env"
   ```
3. **Install Node.js (v18+)**:
   ```bash
   # Via Homebrew or fnm/nvm
   brew install node
   ```

---

### 🐧 Linux (Ubuntu, Debian, Fedora, Arch)

1. **Install System Dependencies**:
   * **Ubuntu / Debian**:
     ```bash
     sudo apt update && sudo apt install -y \
       build-essential \
       pkg-config \
       libssl-dev \
       libgtk-3-dev \
       libwebkit2gtk-4.1-dev \
       libayatana-appindicator3-dev \
       librsvg2-dev \
       curl \
       wget
     ```
   * **Fedora / RHEL**:
     ```bash
     sudo dnf install -y \
       gcc-c++ \
       pkgconfig \
       openssl-devel \
       gtk3-devel \
       webkit2gtk4.1-devel \
       libayatana-appindicator-devel \
       librsvg2-devel
     ```
   * **Arch Linux**:
     ```bash
     sudo pacman -S --needed \
       base-devel \
       pkgconf \
       openssl \
       gtk3 \
       webkit2gtk-4.1 \
       libayatana-appindicator \
       librsvg
     ```
2. **Install Rust & Node.js**:
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   sudo apt install -y nodejs npm   # Or use nvm / fnm
   ```

---

### 🪟 Windows (10/11 x86_64)

1. **Install Visual Studio C++ Build Tools**:
   * Download and install the Visual Studio Installer with the **"Desktop development with C++"** workload.
2. **WebView2 Runtime**: Pre-installed on Windows 10/11.
3. **Install Rust**:
   * Download `rustup-init.exe` from [rustup.rs](https://rustup.rs/) (choose `x86_64-pc-windows-msvc`).
4. **Install Node.js (v18+)**:
   * Download from [nodejs.org](https://nodejs.org/).

---

## 🛠️ Quick Start & Development

### 1. Clone Repository & Install Node Dependencies
```bash
git clone https://github.com/yoel3imari/llm-advisor.git
cd llm-advisor
npm install
```

### 2. Fetch Pinned `llama-server` Sidecar Binary
Download and unpack the pinned `llama.cpp` sidecar binary for your platform:
```bash
./scripts/fetch-sidecar.sh
```

### 3. Run in Development Mode
Launch the full desktop application with Vite Hot-Module-Replacement (HMR) and Tauri IPC backend:
```bash
npm run tauri dev
```

### 4. Build Production Desktop Application
Package a distributable native desktop binary/bundle:
```bash
npm run tauri build
```

---

## 🧪 Testing & Code Quality

### Run Backend Rust Unit & Golden Tests
```bash
cargo test --workspace
```
*(Or test specific core crates:)*
```bash
cargo test --package domain --package hw_probe --package fit_engine \
           --package catalog --package downloader --package library \
           --package server_manager --package gateway
```

### Format & Lint Checks
```bash
cargo fmt --check
cargo clippy --workspace --all-targets -- -D warnings
```

### Run Frontend Build & Tests
```bash
npm test
npm run build
```

---

## 🔌 Using the OpenAI-Compatible API

Once a model is started in the app, the gateway is available at `http://127.0.0.1:13370/v1`.

### Streaming Chat Completion (`curl`)
```bash
curl -N http://127.0.0.1:13370/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "active-model",
    "messages": [
      {"role": "system", "content": "You are a helpful coding assistant."},
      {"role": "user", "content": "Write a Rust function to compute Fibonacci numbers."}
    ],
    "stream": true
  }'
```

### Python OpenAI SDK Integration
```python
from openai import OpenAI

client = OpenAI(
    base_url="http://127.0.0.1:13370/v1",
    api_key="not-needed"  # Localhost gateway requires no key
)

response = client.chat.completions.create(
    model="local-model",
    messages=[{"role": "user", "content": "Explain KV-cache quantization."}],
    stream=True
)

for chunk in response:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="", flush=True)
print()
```

### Check Gateway Health & Active State
```bash
curl http://127.0.0.1:13370/healthz
# Returns: {"status":"ok","state":"serving","model":"llama-3.1-8b-instruct-q4_k_m","internal_port":18421}
```

---

## 📜 License

This project is open-source and released under the [MIT License](LICENSE).
