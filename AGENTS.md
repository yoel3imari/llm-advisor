# Local LLM Advisor — Development Guidelines & Lessons Learned

This document records architectural conventions, project lessons learned, and guardrails to prevent regressions in future sessions.

---

## 1. Tauri 2 & Sidecar Management

* **`externalBin` Build Guardrail**:
  * Tauri 2 requires `src-tauri/binaries/llama-server-<target-triple>` to physically exist before `tauri_build::build()` executes in `src-tauri/build.rs`.
  * **Solution**: `src-tauri/build.rs` auto-generates an executable placeholder stub if the binary has not been fetched yet.
  * **Provisioning**: Real binaries are downloaded via `npm run sidecar:fetch` or `scripts/fetch-sidecar.sh`.
* **Multi-Platform Target Detection**:
  * macOS targets: `x86_64-apple-darwin` (Intel) or `aarch64-apple-darwin` (Apple Silicon).
  * Linux targets: `x86_64-unknown-linux-gnu`.
  * Always inspect `uname -s` and `uname -m` when writing download or launch scripts.
  * On Linux, `llama-server` dynamic dependencies (`libggml.so`, `libllama.so`, `libmtmd.so`, `libllama-server-impl.so`) must be placed in `src-tauri/binaries/` with `LD_LIBRARY_PATH` configured on child spawn.
  * **AppImage / linuxdeploy Guardrail**: When bundling `.AppImage`, `linuxdeploy` traces ELF dynamic dependencies. Ensure `LD_LIBRARY_PATH="$PWD/src-tauri/binaries:$LD_LIBRARY_PATH"` is set so `linuxdeploy` discovers internal `.so` files and avoids `Could not find dependency: libllama-server-impl.so`.
* **macOS Dynamic Library Bundling Guardrail**:
  * Tauri 2 only copies the single binary in `externalBin` into `Contents/MacOS/llama-server`.
  * Because `llama-server` is dynamically linked against `.dylib` files (`libllama-server-impl.dylib`, `libllama.dylib`, `libggml.dylib`, `libllama-common.dylib`, `libmtmd.dylib`, etc.) resolving via `@loader_path`, all `.dylib` files and their version symlinks must be synchronized into `Contents/MacOS/` via `scripts/post-bundle.sh`.
  * Precompiled GitHub release binaries for `llama.cpp` require macOS 13.3+ Accelerate ILP64 symbols; on macOS 12 (Monterey), `scripts/fetch-sidecar.sh` performs automated verification and compiles natively if needed.

---

## 2. Cargo Workspace Dependencies

* **Subcrate Dependency Declaration**:
  * Declaring a crate in root `[workspace.dependencies]` (e.g. `chrono`, `tokio-util`) makes the version available to the workspace, but **does NOT** automatically expose it to member crates.
  * Every member crate (e.g., `src-tauri/Cargo.toml`, `crates/gateway/Cargo.toml`) that imports a crate must explicitly declare:
    ```toml
    [dependencies]
    chrono.workspace = true
    tokio-util.workspace = true
    ```

---

## 3. Reverse Proxy & Port Strategy (ADR-3a)

* **Strict Port 13370 Binding**:
  * External developer tools (Cursor, Continue, Cline, Aider, OpenAI SDKs) hardcode `http://127.0.0.1:13370/v1`.
  * The gateway must **strictly bind to port 13370**. Never loop or auto-increment to 13371 on collision.
  * On port collision, return `AppError::ServerPortBind` and surface an actionable error dialog.
* **Internal Sidecar Port**:
  * `llama-server` sidecar binds to an ephemeral OS-assigned free port (e.g., `18080+`). External clients never communicate directly with the sidecar.

---

## 4. Memory-Fit Math & GGUF Metadata Integrity

* **Grouped-Query Attention (GQA)**:
  * Always use `n_kv_heads` (e.g., `8` for Llama 3.1 8B), **never** total attention heads (`n_heads = 32`), when calculating KV cache bytes. Using `n_heads` inflates KV cache size by 4×.
* **Gemma 2 `head_dim`**:
  * Gemma 2 decouples `head_dim` (explicitly `256`) from `hidden_size / n_heads`. Always respect explicit `head_dim`.
* **Binary Header Verification**:
  * `crates/downloader/src/gguf.rs` reads GGUF binary headers post-download to verify `n_layers`, `n_kv_heads`, and `head_dim` against catalog records.

---

## 5. Git & Storage Guardrails

* **Zero Binaries in Git**:
  * Never commit `.so`, `.dylib`, `.dll`, `.exe`, `llama-server*`, or `.tar.gz` archives.
  * Never commit `.gguf`, `.bin`, or `.part` model weights.
  * All binaries and weights are ignored via `.gitignore` and provisioned on demand.
