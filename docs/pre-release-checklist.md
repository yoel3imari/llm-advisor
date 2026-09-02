# LLM Advisor — Pre-Release Manual QA Checklist

This document details all verification procedures and acceptance criteria that must be validated manually before cutting a production release of LLM Advisor.

---

## 1. Build & Environment Pre-Flight

- [X] **System Dependency Preflight (Doctor)**:
  ```bash
  npm run doctor
  ```
  *Verify that all toolchains (Node, NPM, Rust, Cargo, curl), platform libraries (WebKitGTK, GTK3, OpenSSL, RSVG, AppIndicator), and embedded sidecars report `[✓]`.*

- [X] **Inference Sidecar Provisioning**:
  ```bash
  npm run sidecar:fetch
  ```
  *Verify that the real `llama-server` binary and all required shared libraries (`libggml.so`, `libllama.so`, or `.dylib`/`.dll`) are downloaded into `src-tauri/binaries/` and execute cleanly.*

- [X] **Automated Test Suite**:
  ```bash
  cargo test
  npm test
  ```
  *Ensure all unit, property, and golden tests pass across all workspace crates and frontend components.*

- [ ] **Clean Production Build**:
  ```bash
  npm run build:bundle   # Bundles all supported packages (deb, AppImage)
  # or target-specific:
  npm run build:deb
  npm run build:appimage
  ```
  *Verify that the bundle compiles and packages without missing assets or build errors.*

---

## 2. First Launch & Hardware Probing

- [ ] **Clean Install Boot**: Launch the application on a clean environment without existing user data.
  - [ ] App launches without white-screen or missing resource errors.
  - [ ] Default OS app-data directory (`~/data` or OS config path) and `settings.json` are initialized automatically.
- [ ] **Hardware Probe Accuracy**:
  - [ ] **macOS (Apple Silicon)**: Verify chip name (e.g., *Apple M3 Max*), unified RAM, and Metal backend are detected accurately.
  - [ ] **macOS (Intel)**: Verify discrete AMD Radeon/Intel GPU VRAM or host RAM fallback.
  - [ ] **Linux**: Verify discrete GPU (NVIDIA CUDA / AMD ROCm / Intel Arc) and VRAM are detected via `nvidia-smi` / DRM sysfs / `lspci`.
  - [ ] **Host Memory Budget**: Verify that host budget displays bounded at $\le 75\%$ of total physical RAM.

---

## 3. Catalog, Fit Engine & Memory Calculations

- [ ] **Catalog Loading & Search**:
  - [ ] Bundled catalog entries load instantly on startup.
  - [ ] Category filters (All, Coding, General, Lightweight, Vision/MoE) and search queries filter the table smoothly.
- [ ] **Fit Badges (`FIT`, `TIGHT`, `NO_FIT`)**:
  - [ ] High-parameter models (e.g., Llama 70B on 16GB RAM) correctly display `NO_FIT` with descriptive explanations.
  - [ ] Lightweight models (e.g., SmolLM2, Qwen 2.5 1.5B/3B) correctly display green `FIT` badges.
  - [ ] Context size slider adjusts KV cache estimation dynamically and warns when memory headroom drops below safety thresholds.

---

## 4. Download Lifecycle & Integrity

- [ ] **Happy-Path Download**:
  - [ ] Download a small model (e.g., SmolLM2 or Qwen 2.5 1.5B).
  - [ ] Progress bar updates smoothly with downloaded MB, total MB, transfer speed, and percentage.
  - [ ] System notification fires upon download completion.
- [ ] **Resumable Range Download**:
  - [ ] Start downloading a model and interrupt the network (or click *Cancel* midway).
  - [ ] Verify that a `.part` file remains on disk with partial size.
  - [ ] Resume download and verify it continues from the partial byte offset rather than restarting from 0.
- [ ] **SHA-256 Checksum Verification**:
  - [ ] Downloaded file is automatically verified against the catalog hash.
  - [ ] Corrupted `.part` files are deleted automatically with a clear error prompt rather than renaming to `.gguf`.
- [ ] **Gated Model Authentication**:
  - [ ] Attempt downloading a gated model without an HF token $\rightarrow$ verify prompt directs user to add token in Settings.
  - [ ] Add valid HuggingFace Token in Settings $\rightarrow$ verify download succeeds with `Authorization: Bearer <token>`.

---

## 5. Sidecar Inference & Server Pool

- [ ] **Single Instance Serving**:
  - [ ] Click **"Start Server"** on a downloaded model.
  - [ ] UI shows transition state `Starting` $\rightarrow$ `Serving` with internal port assigned (`:18080+`).
  - [ ] Verify live logs stream into the Server Logs viewer.
- [ ] **Multi-Instance Serving**:
  - [ ] Start a second model while the first is running.
  - [ ] Verify both instances appear in the Running Pool with distinct ports and context allocations.
- [ ] **Process Termination & Zombie Prevention**:
  - [ ] Stop an instance from the UI $\rightarrow$ check `ps aux | grep llama-server` (or Task Manager) to verify PID is killed.
  - [ ] Close the app $\rightarrow$ verify all spawned `llama-server` sidecar processes terminate cleanly without orphan processes.

---

## 6. OpenAI-Compatible Gateway (`http://127.0.0.1:13370`)

- [ ] **Health & Models Endpoints**:
  ```bash
  curl -s http://127.0.0.1:13370/healthz | jq
  curl -s http://127.0.0.1:13370/v1/models | jq
  ```
  *Verify JSON response lists active models and system health.*
- [ ] **Non-Streaming Chat Completion**:
  ```bash
  curl -s http://127.0.0.1:13370/v1/chat/completions \
    -H "Content-Type: application/json" \
    -d '{"messages":[{"role":"user","content":"Hello!"}]}' | jq
  ```
- [ ] **Zero-Buffering SSE Streaming**:
  ```bash
  curl -N http://127.0.0.1:13370/v1/chat/completions \
    -H "Content-Type: application/json" \
    -d '{"messages":[{"role":"user","content":"Write a haiku about Rust."}],"stream":true}'
  ```
  *Verify tokens stream immediately with no buffering delay.*
- [ ] **Third-Party Client Integration**:
  - [ ] Connect **Cursor**, **Continue.dev**, **Cline**, or **Aider** pointing to `http://127.0.0.1:13370/v1` with API key `local`.
  - [ ] Run an inline code completion and chat query to verify end-to-end routing.
- [ ] **Port Collision Handling**:
  - [ ] Run a dummy process on port 13370 (`nc -l 13370` or `python3 -m http.server 13370`).
  - [ ] Launch LLM Advisor $\rightarrow$ verify it surfaces an actionable error dialog explaining port 13370 is in use.

---

## 7. Settings, Storage & Automated Uninstaller

- [ ] **Preferences Persistence**:
  - [ ] Modify Gateway Port, Default Context Size, and Default KV Type (e.g., `Q8_0`).
  - [ ] Restart the application and verify updated preferences persist from `settings.json`.
- [ ] **Custom Models Directory**:
  - [ ] Change models directory in Settings to a custom path.
  - [ ] Move a `.gguf` file to the new folder $\rightarrow$ verify Library Reconcile indexes it.
- [ ] **Automated Deep Uninstaller**:
  - [ ] Open Settings $\rightarrow$ click **"Uninstall & Clean Data"**.
  - [ ] Test granular checkmarks (e.g., delete models only, clear cache, or full factory reset).
  - [ ] Verify deleted files free actual disk space and reset application state gracefully.

---

## 8. System Tray, Window State & Background Mode

- [ ] **Background Execution**:
  - [ ] Enable **"Run in Background"** in Settings.
  - [ ] Close the main window $\rightarrow$ verify window hides, the system tray icon remains active, and gateway `:13370` continues serving requests.
- [ ] **Tray Actions**:
  - [ ] Left-click tray icon $\rightarrow$ restores and focuses main window.
  - [ ] Right-click tray menu $\rightarrow$ test **"Show LLM Advisor"**, **"Stop Inference Server"**, and **"Quit"**.
  - [ ] Clicking **"Quit"** terminates gateway and all child sidecars immediately.

---

## 9. Platform-Specific Installer & Packaging Checks

- [ ] **macOS Bundle**:
  - [ ] Double-click generated `.dmg` $\rightarrow$ drag to `/Applications`.
  - [ ] Launch app and verify no Gatekeeper / quarantine blocking (if code signed/notarized).
  - [ ] Test Metal GPU offloading with a 7B/8B model.
- [ ] **Linux Bundle**:
  - [ ] Test installation of `.deb` (`sudo dpkg -i ...`) or `.rpm`.
  - [ ] Run `.AppImage` on an unmodified Ubuntu/Fedora installation.
  - [ ] Test `/dev/shm` low-memory fallback behavior under heavy load.
- [ ] **Windows Bundle**:
  - [ ] Run `.msi` / setup `.exe` installer.
  - [ ] Verify desktop shortcut and Start Menu entry work.
  - [ ] Verify firewall prompt allows localhost loopback binding.
