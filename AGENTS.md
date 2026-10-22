# LLM Advisor — Development Guidelines & Lessons Learned

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
* **macOS Dynamic Library Bundling & Dev Guardrail**:
  * Tauri 2 only copies the single binary in `externalBin` into `Contents/MacOS/llama-server` (or `target/debug/llama-server`).
  * Because `llama-server` is dynamically linked against `.dylib` files (`libllama-server-impl.dylib`, `libllama.dylib`, `libggml.dylib`, `libllama-common.dylib`, `libmtmd.dylib`, etc.) resolving via `@rpath` / `@loader_path`, all `.dylib` files, metal shaders, and their version symlinks must be synchronized into `Contents/MacOS/` via `scripts/post-bundle.sh` and into `target/debug/` via `src-tauri/build.rs` and `server_manager::ensure_sidecar_dependencies`.
  * **macOS Floor Is 15.0 — Do Not Lower It Without Rebuilding the Sidecar**:
  * Upstream `llama.cpp` prebuilts (`minos 15.0`, SDK 15.5) link Accelerate ILP64 symbols (`_cblas_sgemm$NEWLAPACK$ILP64`, present only in macOS 13.3+) and newer `libc++`/`libSystem`; on anything older `dyld` aborts at sidecar load. `tauri.conf.json` `macOS.minimumSystemVersion` must therefore stay at `"15.0"` (enforced by the OS via `LSMinimumSystemVersion`).
  * Supporting an older floor again would require either a natively rebuilt sidecar (`-DGGML_BLAS=OFF -DCMAKE_OSX_DEPLOYMENT_TARGET=<floor>`, plus a `nm -m | grep NEWLAPACK` gate in `scripts/fetch-sidecar.sh`) or a dual-variant bundle — all previously prototyped and deliberately removed in favor of the 15.0 floor.

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

---

## 6. Binary Size & Packaging Guardrails

* **Release Profile Optimizations**:
  * Workspace root `Cargo.toml` must declare `[profile.release]` with `lto = "thin"`, `codegen-units = 1`, `panic = "abort"`, and `strip = true`. This cuts the core binary size from 25 MB down to 13 MB.
* **Tauri Packaging Deduplication**:
  * In `src-tauri/tauri.conf.json`, `"resources": ["binaries/*"]` already provisions dynamic libraries into the application resource path (`/usr/lib/llm-advisor/`).
  * Do NOT add `"files": { "/usr/lib/llm-advisor": "binaries" }` in `linux.deb` or `linux.rpm`. Doing so duplicates the 37 MB `.so` tree into a redundant 62 MB nested folder where version symlinks are dereferenced into full duplicate files.
* **Sidecar Auxiliary Library Pruning**:
  * Upstream `llama.cpp` releases contain implementation shared libraries for unrelated CLI tools (`libllama-bench-impl.so`, `libllama-cli-impl.so`, `libllama-perplexity-impl.so`, etc.).
  * `scripts/fetch-sidecar.sh` filters these out during download, preserving only `llama-server` and its dynamic runtime dependencies.

---

## 7. Linux Package Dependency Metadata (deb/rpm)

* **Tauri CLI auto-injects linked runtime deps — do not duplicate them manually**:
  * When bundling on Linux, `tauri-cli` appends dependencies for the libraries it links (see `src/interface/rust.rs` in the published `tauri-cli` crate):
    * `deb`: `libwebkit2gtk-4.1-0`, `libgtk-3-0`, plus `libayatana-appindicator3-1` when the `tray-icon` feature is enabled.
    * `rpm`: the portable soname form `libwebkit2gtk-4.1.so.0()(64bit)`, `libgtk-3.so.0()(64bit)`, `libayatana-appindicator3.so.1()(64bit)` (`()(64bit)` suffix on 64-bit targets).
* **`bundle.linux.rpm.depends` must contain sonames, never distro package names**:
  * Fedora-only names (`webkit2gtk4.1`, `gtk3`, `librsvg2`, `openssl`) do not resolve on openSUSE, and openSUSE source-package names such as `libayatana-appindicator` resolve nowhere. On Fedora the latter surfaces as `nothing provides libayatana-appindicator needed by llm-advisor` and `dnf` refuses the whole transaction.
  * Use `libfoo.so.N()(64bit)` (with the 64-bit suffix — all release targets are 64-bit). Fedora mapping examples: `libayatana-appindicator3.so.1()(64bit)` → `libayatana-appindicator-gtk3`, `libcrypto.so.3()(64bit)` → `openssl-libs`.
  * v0.2.3 shipped the broken `libayatana-appindicator` requires; `install.sh` detects that metadata on failure and prints AppImage / force-install remedies until users upgrade.
* **`bundle.linux.deb.depends`** keeps Debian/Ubuntu binary package names (auto-injected duplicates are harmless).

---

## 8. Minimum System Version Floors

* **Linux floor = release build host**: `release.yml` builds on `ubuntu-24.04`, so the binaries require **glibc >= 2.39** (verified with `objdump -T`: the app binary imports `GLIBC_2.39`; the pinned llama.cpp sidecar only needs 2.34, so the app governs).
  * Measure per release: `objdump -T target/release/llm-advisor | grep -oE 'GLIBC_[0-9]+\.[0-9]+' | sort -Vu | tail -1`.
  * `install.sh` enforces it via `MIN_GLIBC`; `release.yml` fails the release when the built app or sidecar libs require a newer glibc than `install.sh` advertises (guards silent runner-image bumps). musl systems (Alpine) are refused by the installer.
  * Supported minimums: Ubuntu 24.04+, Debian 13+ (glibc 2.41), Fedora 40+ (2.39), RHEL/Rocky/Alma 10+ (2.39; EPEL for the tray dependency), openSUSE Leap 16+ (2.40)/Tumbleweed.
* **macOS floor = 15.0**, declared in `src-tauri/tauri.conf.json` (`bundle.macOS.minimumSystemVersion`) and dictated by the upstream llama.cpp prebuilt (`minos 15.0`, Accelerate ILP64 symbols — see section 1). `install.sh` enforces the same value via `MIN_MACOS`; `release.yml` verifies both stay in sync.
* Bumping the runner image or the sidecar pin can raise these floors — update `MIN_GLIBC`/`MIN_MACOS` in `install.sh`, the README note, and this section in the same commit.

---

## 9. Embedding Model Serving

* **Catalog contract**: embedding entries must set `output_type: "embedding"` and an explicit `pooling` (`mean`, `cls`, `last`, or `rank`). `catalog::parse_catalog_json` rejects invalid pooling values and pooling on non-embedding entries; `scripts/update-catalog.py` and `scripts/build-catalog.mjs` enforce the same rules.
* **Sidecar flags**: embedding instances launch with `--embeddings`, plus `--pooling <value>` when the catalog declares one. They must **not** receive `-ctk`/`-ctv` (there is no KV cache). Text instances keep the existing KV flags.
* **Context clamp**: `-c` for an embedding model is the maximum input length, so `src-tauri/src/lib.rs` clamps it to `entry.context_train` with a floor of 256 tokens (e.g. MiniLM stays at 512).
* **Capability-aware routing**: `ServerManager::route_model(requested, ModelCapability)` is the single routing entry point. Chat (`/v1/chat/completions`, `/v1/completions`) and embeddings (`/v1/embeddings`) must never cross capabilities. Explicitly naming the wrong type returns `WrongCapability` → HTTP 400 `invalid_request_error`; an empty capability pool returns `NoMatchingModel` → HTTP 503.
* **Runtime metadata**: `RunningProcess`/`RunningInstanceInfo`, `GET /v1/models`, and `ServerState::Serving.instances` expose `output_type` so the UI can badge instances and the gateway can keep capabilities separate.
* **Fit math**: the fit engine still returns zero KV bytes for embedding models. BERT-family GGUFs often omit `head_count_kv`/`key_length`; the downloader skips those header checks rather than failing verification.
* **Nomic v2 MoE**: `nomic-embed-text-v2-moe-q8_0` has a real 512-token context limit and is documented as such in the README.

---

## 10. Cross-Platform Window Chrome

* **Frameless by design**: `src-tauri/tauri.conf.json` sets `decorations: false` on every OS. `src/components/layout/TitleBar.tsx` is the only title bar; do not reintroduce OS-specific native chrome (the old GTK header-bar CSS override and its `gtk` crate were removed as obsolete).
* **Drag region**: the title bar uses `data-tauri-drag-region="deep"` (Tauri 2.11+) so the entire bar drags, while buttons/inputs opt out automatically. Double-click toggling comes from Tauri's injected script (`core:window:allow-internal-toggle-maximize`, included in `core:default`).
* **Window permissions** in `src-tauri/capabilities/default.json` must keep `allow-minimize`, `allow-toggle-maximize`, `allow-close`, `allow-start-dragging`, and `allow-start-resize-dragging`; `allow-is-maximized` also comes from `core:default`.
* **Resize border**: `decorations: false` removes the native resize frame, so `WindowResizeHandles.tsx` provides invisible 8-direction hit areas backed by `startResizeDragging`. Keep them mounted at the app shell (hidden when maximized); without them edge resizing breaks on Linux/X11.
* **Trade-off**: macOS loses native traffic lights and system window-menu behaviors (move/align) in exchange for identical chrome across OSes. This is intentional.

