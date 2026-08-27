# Original User Request

## 2026-08-27T00:02:39Z

This is a single self-contained fix; keep it small and focused. Build the Local LLM Advisor MVP: a cross-platform Tauri 2 desktop application with a Rust backend that profiles local hardware, provides explainable RAM/VRAM-fit model recommendations, manages verified GGUF downloads, and runs an embedded llama-server with an OpenAI-compatible reverse proxy gateway on `127.0.0.1:13370`.

Working directory: /home/xozev/projects/llm-advisor
Integrity mode: development

## Requirements

### R1. Hardware Profiling & GPU/Memory Detection
Implement local hardware inspection to detect host CPU, total system RAM, GPU details, and VRAM/Metal working-set limits. Hardware probe queries must run safely with fallback heuristics and must not block application startup.

### R2. Deterministic Memory-Fit Engine & Model Catalog
Implement a mathematical fit estimation engine that evaluates model memory requirements (weights, KV cache with GQA support, activations, and runtime overhead) against detected hardware budgets. Provide a curated catalog of standard GGUF models with Hugging Face metadata (SHA256 checksums, architecture parameters, file sizes) and calculate exact fit tiers, maximum fitting context size, and recommended GPU layer offloading.

### R3. Resumable Chunked Downloader & Model Library Management
Implement an HTTP downloader supporting resumable Range requests and streaming SHA256 verification against catalog metadata. Downloaded models must be managed in a local library store tracking download states (`Queued`, `Downloading`, `Verifying`, `Ready`, `Paused`, `Failed`) and file locations.

### R4. Inference Sidecar Process Management & Gateway Reverse Proxy
Manage the lifecycle of a bundled `llama-server` sidecar process (spawning, health polling, single-instance enforcement, and graceful teardown on exit or model switch). Expose an OpenAI-compatible HTTP reverse proxy gateway bound strictly to `127.0.0.1:13370` supporting Server-Sent Events (SSE) streaming for `/v1/chat/completions` and `/v1/models`, returning structured 503 responses when no model is loaded.

### R5. Desktop UI & End-to-End Workflow Integration
Deliver a responsive desktop application interface (Specs Dashboard, Recommendations & Fit Breakdown, Model Library/Downloads Manager, and Server Control Panel) communicating with the Rust backend via Tauri IPC, enabling users to inspect hardware, download models, start/stop inference, and test API completions.

## Verification Resources & Strategy
- Reference specifications and architectural plans available in `.sisyphus/plans/local-llm-advisor-mvp.md` and `.sisyphus/plans/local-llm-advisor-design.md`.
- Automated test suites: `cargo test --workspace` for backend crates and `npm run test` / `vitest` for frontend units.
- Automated end-to-end QA validation script executing: model catalog verification, simulated or real small GGUF download with SHA256 check, sidecar launch, health check, and SSE chat completion via `curl` against `http://127.0.0.1:13370/v1/chat/completions`.

## Acceptance Criteria

### Code Quality & Automated Tests
- [ ] `cargo test --workspace` passes all unit, golden calculation, and integration tests.
- [ ] `cargo clippy --workspace --all-targets` and `cargo fmt --check` pass with zero warnings or errors.
- [ ] `npm run build` succeeds without TypeScript or bundling errors.

### Hardware & Fit Engine
- [ ] Hardware probing accurately retrieves system RAM and GPU/VRAM limits without panicking on unsupported environments.
- [ ] Fit engine calculations accurately calculate weights, KV cache sizing (using `n_kv_heads`), and recommended GPU layers for given context windows matching reference fixtures.

### Download & Library Integrity
- [ ] Downloader correctly resumes interrupted downloads via Range headers and computes SHA256 on the fly.
- [ ] Downloader refuses to mark corrupted or incomplete downloads as Ready if SHA256 mismatches the catalog record.

### Sidecar Management & Gateway Proxy
- [ ] Server manager starts `llama-server`, waits for `/health` readiness, and terminates old instances before starting new ones or on app exit.
- [ ] Gateway on `127.0.0.1:13370` streams SSE tokens with zero buffering when serving, and returns clean HTTP 503 JSON when idle.
- [ ] Network listeners bind exclusively to loopback (`127.0.0.1`), never `0.0.0.0`.

### Integration & End-to-End Functionality
- [ ] The desktop UI launches and renders hardware specs, model recommendations, library state, and server controls.
- [ ] An end-to-end integration test successfully proves the full pipeline: detect hardware -> verify fit -> download/verify GGUF -> serve model -> stream chat completion through the gateway.
