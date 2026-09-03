# Contributing to LLM Advisor

Thank you for your interest in contributing to **LLM Advisor**! 🚀

LLM Advisor is a local-first, privacy-focused open-source project dedicated to providing deterministic hardware recommendations, verified GGUF downloads, and high-performance supervised inference.

We welcome contributions of all types:
* 🐛 **Bug reports & fixes**
* ✨ **New features & enhancements**
* 📐 **Hardware probing improvements** (Apple Silicon, AMD ROCm, Intel Arc, NVIDIA CUDA)
* 📖 **Documentation & guides**
* 🧪 **Test cases & golden validation suites**

---

## 🛠️ Code of Conduct

Please help us foster an open, welcoming, and inclusive community:
* Be respectful and considerate in communications and code reviews.
* Focus on constructive, actionable feedback.
* Respect privacy and security standards (never commit proprietary API keys, model weights, or sensitive telemetry).

---

## 💻 Local Development Setup

### 1. Prerequisites
* **Rust**: `1.80+` (`rustup update stable`)
* **Node.js**: `v18+` or `v20+` with `npm` or `bun`
* **Platform Dependencies**:
  * **macOS**: Xcode Command Line Tools (`xcode-select --install`)
  * **Linux (Ubuntu/Debian)**:
    ```bash
    sudo apt update && sudo apt install -y \
      build-essential pkg-config libssl-dev libgtk-3-dev \
      libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev
    ```
  * **Windows**: Visual Studio 2022 C++ Build Tools

### 2. Getting the Code & Installing Dependencies
```bash
git clone https://github.com/yoel3imari/llm-advisor.git
cd llm-advisor

# Install frontend dependencies
npm install

# Fetch platform-specific llama-server sidecar binaries
npm run sidecar:fetch
```

### 3. Launching Development Mode
Run the application with Vite HMR frontend and live Tauri 2 IPC bindings:
```bash
npm run tauri dev
```

---

## 🧪 Testing & Quality Standards

Before submitting a Pull Request, please ensure all test suites pass and your code is properly formatted:

### 1. Backend Rust Suite
```bash
# Run unit and integration tests across all workspace crates
cargo test --workspace

# Check formatting
cargo fmt --check

# Check linter warnings
cargo clippy --workspace --all-targets -- -D warnings
```

### 2. Frontend React Suite
```bash
# Run Vitest test suites
npm test

# Verify production Vite asset bundling and TypeScript types
npm run build
```

---

## 🏛️ Architectural Guardrails

Please review [`AGENTS.md`](AGENTS.md) for critical architectural rules:
1. **Zero Binaries in Git**: Never commit `.so`, `.dylib`, `.dll`, `.exe`, `llama-server*`, `.gguf`, or `.bin` files.
2. **Reverse Proxy Strict Port Binding**: The local gateway strictly binds to `127.0.0.1:13370`. External tools depend on this predictable address.
3. **Memory-Fit Math Integrity**:
   * Always calculate KV cache bytes using `n_kv_heads`, **never** total attention heads (`n_heads`), to avoid 4× inflation on Grouped-Query Attention models.
   * Respect explicit `head_dim` (such as Gemma 2's `256`).
4. **Member Crate Dependencies**: Any dependency defined in root `[workspace.dependencies]` must be explicitly imported in child crates via `dep.workspace = true`.

---

## 🌿 Pull Request Process

1. **Branch Naming**:
   * `feat/short-description` for new features
   * `fix/short-description` for bug fixes
   * `docs/short-description` for documentation improvements
   * `refactor/short-description` for internal cleanups
2. **Commit Messages**:
   We follow [Conventional Commits](https://www.conventionalcommits.org/):
   * `feat(scope): add support for Qwen2.5-Coder GQA profiles`
   * `fix(gateway): resolve SSE chunk buffering issue on Firefox`
   * `docs(readme): add Cursor setup instructions`
3. **Review**:
   * Maintainers will review your PR and provide feedback.
   * All CI checks (formatting, clippy, unit tests) must be green prior to merge.

---

## 🐛 Reporting Issues

If you find a bug or run into unexpected behavior:
1. Search [Existing Issues](https://github.com/yoel3imari/llm-advisor/issues) to avoid duplicates.
2. When creating a new issue, include:
   * **OS & Version** (e.g. macOS Sonoma 14.5, Ubuntu 24.04, Windows 11)
   * **Hardware Details** (CPU, RAM, GPU model & VRAM)
   * **Model Identifier** (e.g. `llama-3.1-8b-instruct-q4_k_m`)
   * **Steps to Reproduce**
   * **Relevant Logs** from the Server Logs UI or local data directory (`~/.local/share/dev.yoel3imari.llm-advisor/`).

Thank you for helping make LLM Advisor better! 🌟
