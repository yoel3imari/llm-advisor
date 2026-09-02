# LLM Advisor — MVP Implementation Plan

## TL;DR

> **Quick Summary**: Build Phase 1–3 of the system designed in [`llm-advisor-design.md`](./llm-advisor-design.md): hardware profiling → RAM/VRAM-fit recommendations → GGUF download/library → bundled llama-server serving an OpenAI-compatible endpoint on `127.0.0.1:13370`.
>
> **Deliverables**:
> - Working Tauri 2 desktop app (macOS Apple Intel x86_64) with Specs Dashboard, Recommendations, Library, Server Control views
> - Rust core crates: `hw_probe`, `fit_engine`, `catalog`, `downloader`, `library`, `server_manager`, `gateway`
> - Pinned llama-server x86_64 sidecar bundled into the app
> - Design docs materialized into repo (`docs/architecture.md`)
>
> **Estimated Effort**: Large
> **Parallel Execution**: YES — 4 implementation waves + final review wave
> **Critical Path**: T1 → T2 → T4/T5 → T6 → T9 → T10 → T11 → UI wave → F1-F4

---

## Context

### Original Request
Build a desktop app that retrieves local machine specs, suggests open LLM models that can run on it, and provides an Ollama-like inference endpoint. User explicitly requested design-first workflow (use cases + UML), which is complete in `llm-advisor-design.md`.

### Interview Summary (confirmed decisions)
- **Stack**: Tauri 2.x · Rust · React+TS+Vite webview
- **Platform v1**: macOS Apple Intel (x86_64) ONLY (Apple Silicon deferred to v2)
- **Inference**: embedded llama.cpp x86_64 sidecar (own GGUF downloader; NOT wrapping Ollama; llmfit is reference only)
- **Catalog**: static bundled JSON with author-time HuggingFace metadata; online refresh deferred to v2
- **API**: OpenAI-compatible via thin axum gateway (ADR-3 rationale: stable port + CORS bypass + idle-state semantics)
- **Tests**: TDD for pure logic modules; every task additionally gets agent-executed QA scenarios

### Research Findings (embedded in design doc §1, §9)
Key operational facts the executor MUST honor:
- KV cache uses `n_kv_heads` (GQA), never `n_head`
- HF LFS ETag == sha256 of file → checksum verification is free
- llama-server: single model per process, `-np` slots multiply KV memory, caps ctx at training length, `/health` endpoint for readiness
- Sidecar naming convention: `llama-server-x86_64-apple-darwin`

### Metis Review (gaps already folded into design + this plan)
Distribution/signing excluded (local-build only); one-model-at-a-time locked; gated-model token flow included; serve-time available-RAM preflight added; fit engine parameterized by ServeConfig; `max_context_that_fits` and `recommended_gpu_layers` output required.

---

## Work Objectives

### Core Objective
Ship a demonstrable self-contained LLM Advisor + server where every recommendation number is explainable and every downloaded model verifiably matches its source.

### Concrete Deliverables
- Repo: Tauri workspace `src-tauri/` (Rust) + `src/` (React UI) + `docs/architecture.md` (materialized from the design doc) + pinned `sidecars/` provisioning script
- App flows: detect specs → browse/rank recommendations → download+verify GGUF → serve → curl `/v1/chat/completions` successfully

### Definition of Done
- [x] `cargo test --workspace` green (fit_engine goldens, parsers, downloader unit tests)
- [x] `cargo fmt --check` clean; `cargo clippy` no warnings
- [x] `npm run build` (frontend) succeeds
- [x] End-to-end QA: download a ≤1GB public GGUF, serve it, stream a completion via curl through the gateway
- [x] Evidence files present under `.sisyphus/evidence/`

### Must Have
- Apple-Intel-aware memory budget: Host RAM budget + dGPU VRAM offload detection (`min(Metal working-set query, total RAM)` with runtime Metal call)
- Fit results include per-component memory breakdown + `max_context_that_fits` + `recommended_gpu_layers` + speed estimate
- Download integrity: sha256 == HF ETag before Ready; resume via Range
- Gateway: SSE passthrough with zero buffering; structured 503 envelope when idle; binds localhost only
- Guaranteed sidecar teardown on stop/switch/app-quit

### Must NOT Have (Guardrails)
- NO bundling of GGUF weights in the repo/app
- NO llmfit (or any third-party fit calculator) as a dependency
- NO Apple Silicon / Windows / Linux code paths in v1 (graceful unsupported screen only)
- NO LAN binding anywhere (127.0.0.1 only)
- NO auto-downloads without explicit user action
- NO multi-model concurrent serving / router mode
- NO placeholder estimates: every number traces to catalog fields or measured values
- NO `unwrap()` on fallible IPC/process paths; typed errors surfaced to UI

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — all verification agent-executed.

### Test Decision
- **Infrastructure exists**: NO (greenfield) — setup is Task 1
- **Automated tests**: YES — TDD for `fit_engine`, parsers (`hw_probe`, catalog), downloader chunk/checksum logic
- **Framework**: built-in `cargo test` + frontend `vitest` for utility units
- **Golden tests**: known-model fixtures asserting exact byte math (see T6)

### QA Policy
Every task includes agent-executed QA scenarios. Evidence to `.sisyphus/evidence/task-{N}-{slug}.{ext}`.
- **Rust logic**: Bash (`cargo test`, targeted binaries)
- **Processes/APIs**: Bash (curl, lsof, shasum, sysctl)
- **UI**: Playwright against Vite dev server (mocked IPC) + `tauri dev` + macOS `screencapture -x` for native-window evidence

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (foundation — start immediately):
├── T1: Tauri scaffold + test infra [quick]
├── T2: Domain types + errors [quick]
├── T3: Catalog data authoring (network: HF metadata) [unspecified-high]
└── T4: Metal working-set shim [unspecified-high]

Wave 2 (core engines — after T1/T2):
├── T5: hw_probe (TDD) [deep]          (needs T2; benefits from T4)
├── T6: fit_engine (TDD goldens) [ultrabrain]  (needs T2)
├── T7: downloader (TDD) [deep]        (needs T2)
└── T8: library store [quick]          (needs T2)

Wave 3 (serving — after T8/T7):
├── T9: sidecar acquisition + bundling [unspecified-high]
├── T10: server_manager [deep]         (needs T9)
└── T11: axum gateway [unspecified-high]

Wave 4 (UI — after T5-T8, T11):
├── T12: App shell + nav + IPC bindings [visual-engineering]
├── T13: Specs dashboard [visual-engineering]   (needs T5, T12)
├── T14: Recommendations view [visual-engineering] (needs T6, T13)
├── T15: Library/downloads view [visual-engineering] (needs T7, T8, T13)
├── T16: Server control panel [visual-engineering] (needs T10, T11, T14)
└── T17: Settings (token/ports/config) [quick]     (needs T12)

Wave FINAL (after ALL):
├── F1: Plan compliance audit [oracle]
├── F2: Code quality review [unspecified-high]
├── F3: Real manual QA end-to-end [unspecified-high]
└── F4: Scope fidelity check [deep]
-> Present results -> explicit user okay
```

Critical Path: T1 → T2 → T4 → T5 → T6 → T9 → T10 → T11 → T16 → F1-F4
Parallel Speedup: ~55% vs sequential (17 tasks, max concurrency 4)

### Dependency Matrix

| Task | Depends On | Blocks |
|------|-----------|--------|
| T1 | — | T2,T3,T4,T12 |
| T2 | T1 | T5,T6,T7,T8 |
| T3 | T1 | T6(goldens),T14,T15 |
| T4 | T1 | T5 |
| T5 | T2,(T4) | T13 |
| T6 | T2,T3 | T14 |
| T7 | T2 | T8,T15 |
| T8 | T2,T7 | T15,T10 |
| T9 | T1 | T10 |
| T10 | T8,T9 | T11,T16 |
| T11 | T10 | T16,F3 |
| T12 | T1 | T13..T17 |
| T13 | T5,T12 | T14 |
| T14 | T6,T13 | T16 |
| T15 | T7,T8,T13 | T16 |
| T16 | T10,T11,T14,T15 | F-wave |
| T17 | T12 | F-wave |

### Agent Dispatch Summary
- Wave 1: T1 `quick` · T2 `quick` · T3 `unspecified-high` · T4 `unspecified-high`
- Wave 2: T5 `deep` · T6 `ultrabrain` · T7 `deep` · T8 `quick`
- Wave 3: T9 `unspecified-high` · T10 `deep` · T11 `unspecified-high`
- Wave 4: T12–T16 `visual-engineering` · T17 `quick`
- FINAL: F1 `oracle` · F2 `unspecified-high` · F3 `unspecified-high` · F4 `deep`

---

## TODOs

- [x] T1. Tauri 2 Scaffold + Test Infrastructure

  **What to do**:
  - `npm create tauri-app@latest` (or manual equivalent): Tauri 2.x, React + TypeScript + Vite template, app id `dev.yoel3imari.llm-advisor`
  - Rust workspace layout under `src-tauri/`: crates as modules (`domain`, `hw_probe`, `fit_engine`, `catalog`, `downloader`, `library`, `server_manager`, `gateway`) — separate lib crate or well-separated modules; document choice in repo README
  - Frontend: add `vitest`; one trivial passing test
  - Rust: one trivial passing test per crate module stub; `cargo fmt` config; clippy clean baseline
  - `.gitignore`: model files (*.gguf), `sidecars/binaries/`, secrets

  **Must NOT do**: UI feature work; any business logic; adding state management libs yet

  **Recommended Agent Profile**: Category `quick` — scaffolding only. Skills: [`nextjs16-skills` not applicable] → none required; plain Tauri/Vite knowledge suffices.
  **Parallelization**: Wave 1 · parallel with T2? NO — T2 depends on it · Blocks T2,T3,T4,T12 · Blocked By: none

  **References**:
  - Design doc §3 Component Architecture → module naming/layout must match
  - Tauri 2 docs: https://tauri.app/start/ — project structure & config (`tauri.conf.json`)
  - Vite default dev port for Tauri = 1420 (keep default; Playwright will target it)

  **Acceptance Criteria**:
  - [x] `cargo test --workspace` passes (stub tests)
  - [x] `npx vitest run` passes
  - [x] `npm run tauri dev` opens a window titled "LLM Advisor" (evidence via screencapture)

  **QA Scenarios**:
  ```
  Scenario: Scaffold builds and runs
    Tool: Bash
    Steps:
      1. npm install && cargo test --workspace → exit 0
      2. npm run tauri dev in background; sleep 45
      3. screencapture -x .sisyphus/evidence/task-1-window.png ; kill dev process
    Expected Result: PNG exists and is non-trivial size (>50KB); tests green
  Scenario: Negative — gitignore guards weights
    Tool: Bash
    Steps: echo dummy > test.gguf && git status --porcelain | grep gguf || echo IGNORED
    Expected Result: prints IGNORED (file not tracked)
    Evidence: .sisyphus/evidence/task-1-gitignore.txt
  ```
  **Commit**: YES — `chore(scaffold): tauri2 react-ts workspace with test infra`

---

- [x] T2. Domain Types + Error Taxonomy

  **What to do**:
  - Implement `domain` module exactly matching design doc §4 class diagram: `HardwareProfile` (incl. `cpu_name`, `arch: "x86_64"`, `gpu_name`, `gpu_vram_bytes`, `has_unified_memory`, `total_ram_bytes`, `metal_working_set_bytes`), `CatalogEntry` (incl. `n_kv_heads`, `head_dim`, `file_size_bytes`, `sha256`, `gated`, `quality_tier`, `active_params_b`), `ServeConfig` (ctx=4096 default, n_parallel=1, KvType F16/Q8_0), `FitResult` (incl. `max_context_that_fits`, `recommended_gpu_layers`), `DownloadTask`/`DownloadState` enum {Queued,Downloading{bytes_done,total},Verifying,Ready,Paused,Failed{reason}}, `ModelRecord`
  - Serde derive on all; unit type for byte counts = `u64` newtype `Bytes`
  - Error taxonomy: `AppError` thiserror enum (HwProbe, CatalogParse, Download{Network,Checksum,DiskFull,GatedNoToken}, Server{Spawn,HealthTimeout,PortBind,Crash}, Gateway) with user-presentable messages

  **Must NOT do**: business logic; IO; UI types leaking into domain

  **Recommended Agent Profile**: `quick` — pure data modeling.
  **Parallelization**: Wave 1 (after T1) · Blocks T5-T8 · Blocked By: T1

  **References**:
  - Design doc §4 class diagram — field names/types are contractual
  - Design doc §1 Ground-Truth Math — units and semantics of fields
  - Metis catch: `n_kv_heads` GQA semantics documented on the struct field

  **Acceptance Criteria**:
  - [x] `cargo test -p domain` roundtrip serde fixtures pass (JSON→struct→JSON stable)
  - [x] No `unwrap()` outside tests

  **QA Scenarios**:
  ```
  Scenario: Serde roundtrip of representative fixture
    Tool: Bash (cargo test)
    Steps: include tests/fixtures/catalog_entry.json modeled on Llama-3.1-8B-Q4_K_M (params_b=8.03, n_layers=32, n_kv_heads=8, head_dim=128); assert roundtrip equality
    Expected Result: test passes
    Evidence: .sisyphus/evidence/task-2-serde.txt
  Scenario: Negative — unknown DownloadState rejects
    Tool: Bash (cargo test)
    Steps: serde_json::from_str::<DownloadState>("\"Exploded\"") → Err
    Expected Result: deserialization error asserted in test
    Evidence: .sisyphus/evidence/task-2-negative.txt
  ```
  **Commit**: YES — `feat(domain): core types and error taxonomy`

---

- [x] T3. Static Model Catalog Authoring (~35 entries)

  **What to do**:
  - Script `scripts/build-catalog.mjs` (or Rust bin): for each curated model+quant, fetch HuggingFace metadata via public API (`https://huggingface.co/api/models/{repo_id}?blobs=true`) and resolve URL HEAD to capture: exact `file_size_bytes`, LFS `etag`(sha256), gated flag
  - Curate ~35 entries across families/sizes optimized for Apple Intel Mac hardware tiers (focus on 0.5B–14B models for usable CPU/dGPU speeds): `Qwen2.5-0.5B-Instruct-Q4_K_M` (~0.4GB), `TinyLlama-1.1B-Chat-Q4_K_M` (~0.7GB), `Llama-3.2-1B/3B`, `Qwen2.5-1.5B/3B/7B`, `Llama-3.1-8B`, `Gemma-2-2B/9B`, `Mistral-7B`, `Phi-3.5-mini`, plus higher tiers up to 32B/70B for high-RAM Intel Mac Pros (64GB–128GB); MoE example (e.g., Mixtral-8x7B Q3/Q4) with `active_params_b`
  - Populate architecture params (n_layers, n_kv_heads, head_dim, context_train) from each model's config.json — **GQA kv heads, verified manually per family**
  - Output `src-tauri/catalog/catalog.json`; typed loader module validating against `CatalogEntry` schema at startup; quality_tier assigned by quant map {Q4_K_M:4, Q5_K_M:5, Q6_K:5, Q8_0:5, Q3_K_M:3, Q2_K:2}
  - Commit the generated JSON (it's metadata, allowed)

  **Must NOT do**: download any GGUF content; invent sizes without network verification; use n_head anywhere

  **Recommended Agent Profile**: `unspecified-high` — careful external-data work requiring cross-checking configs.
  **Parallelization**: Wave 1 · Blocks T6 goldens, T14/T15 realism · Blocked By: T1

  **References**:
  - HF API: https://huggingface.co/docs/api-inference/index and `/api/models/{id}` (siblings+blobs give size/lfs sha)
  - Design doc §4 field notes (kv-heads trap, file-size ground truth)
  - llmfit `data/` catalog structure (inspiration for entry grouping only)

  **Acceptance Criteria**:
  - [x] `catalog.json` parses via loader; all 35 entries have non-zero file_size_bytes + 64-hex sha256
  - [x] Spot-check script output vs HF web UI for 3 models (log the comparison)

  **QA Scenarios**:
  ```
  Scenario: Catalog integrity sweep
    Tool: Bash
    Steps: node scripts/build-catalog.mjs --verify-only → validates every entry: sha256 hex, size>0, kv_heads<n_head where both known
    Expected Result: 35/35 valid; report printed
    Evidence: .sisyphus/evidence/task-3-catalog-report.txt
  Scenario: Negative — corrupted entry fails validation
    Tool: Bash
    Steps: temporarily null a file_size_bytes in JSON copy → loader errors naming the entry id
    Expected Result: error message contains offending id
    Evidence: .sisyphus/evidence/task-3-negative.json.log
  ```
  **Commit**: YES — `feat(catalog): curated 35-model catalog with author-time HF metadata`

---

- [x] T4. Metal Working-Set & VRAM Query Shim

  **What to do**:
  - Rust fn `metal_device_info() -> Option<MetalDeviceInfo>`: query `MTLDevice.recommendedMaxWorkingSetSize`, `hasUnifiedMemory`, and device name via `objc2`+`objc2-metal` crates (preferred) OR tiny compiled Swift helper invoked once and cached
  - Fallback: if query fails → `None` (caller applies 0.75 × total_ram heuristic for host memory)
  - Cache result per process lifetime; unit-testable seam injected behind trait

  **Must NOT do**: hardcode chip-specific tables; block app startup if Metal query hangs (timeout 500ms)

  **Recommended Agent Profile**: `unspecified-high` — FFI/native interop edge cases.
  **Parallelization**: Wave 1 · Blocks T5 · Blocked By: T1

  **References**:
  - Apple docs: recommendedMaxWorkingSetSize & MTLDevice properties on macOS x86_64
  - Research bg_7031740e: exelban/stats uses MTLCreateSystemDefaultDevice approach
  - objc2-metal crate examples on docs.rs

  **Acceptance Criteria**:
  - [x] On the dev Mac: returns device info (discrete VRAM or working set); log numbers
  - [x] Trait-mocked unit test covers fallback path

  **QA Scenarios**:
  ```
  Scenario: Real device query
    Tool: Bash
    Steps: cargo run --example metal_query → prints "working_set=X bytes, total=Y, ratio=R"
    Expected Result: ratio within expected bounds; evidence captured
    Evidence: .sisyphus/evidence/task-4-metal-query.txt
  Scenario: Negative — fallback path
    Tool: Bash (cargo test)
    Steps: mock provider returning Err → caller computes 0.75×total
    Expected Result: unit test asserts fallback value
    Evidence: .sisyphus/evidence/task-4-fallback-test.txt
  ```
  **Commit**: YES — `feat(hw-probe): runtime Metal working-set and VRAM query with fallback`

---

- [x] T5. `hw_probe` Module (TDD)

  **What to do**:
  - CPU/RAM/disk via `sysinfo` crate; Intel CPU model + GPU identity/VRAM via `system_profiler SPHardwareDataType -xml` / `SPDisplaysDataType -xml` plist parsing (write a small plist-subset parser OR use `plist` crate) — parse from **fixture files** in tests, not live system
  - Compose: `detect_profile(metal: &dyn WorkingSetProvider, sys: &dyn SysProvider) -> Result<HardwareProfile>` with host budget = min(working_set.unwrap_or(0.75×total), total) and dGPU VRAM detection
  - Cache profile + `detected_at`; expose `refresh()`; unsupported-platform detection (arch != "x86_64" or vendor != "GenuineIntel" / "Apple" → typed Unsupported error)
  - TDD: fixtures for Intel Mac profiler outputs (MacBook Pro 16" 2019 Core i9 + AMD Radeon Pro 5500M 4GB/8GB, iMac 27" 2020 Core i7 + Radeon Pro 5500XT 8GB, Mac mini 2018 Core i7 + Intel UHD 630, Mac Pro 2019 Xeon W) incl. one malformed XML → typed error

  **Must NOT do**: shell out without timeouts; read live system in unit tests

  **Recommended Agent Profile**: `deep` — parsing edge cases + trait seams.
  **Parallelization**: Wave 2 · Blocks T13 · Blocked By: T2 (T4 recommended)

  **References**:
  - Research bg_7031740e: system_profiler XML structure for Intel Mac and discrete AMD GPUs
  - Design doc SD1 sequence — exact call choreography
  - `sysinfo` docs: System::new_all(), total_memory(), cpus()

  **Acceptance Criteria**:
  - [x] Fixture-driven tests green: 4 Intel Mac configs parsed correctly; malformed → AppError::HwProbe
  - [x] Live integration test (ignored by default, run in QA): profile matches `sysctl -n hw.memsize` within 2%

  **QA Scenarios**:
  ```
  Scenario: Live profile vs ground truth
    Tool: Bash
    Steps: cargo run --example hw_probe_dump > evidence.txt; sysctl -n hw.memsize >> evidence.txt
    Expected Result: total_ram_bytes == sysctl value ±2%; cpu name matches machdep.cpu.brand_string
    Evidence: .sisyphus/evidence/task-5-live-profile.txt
  Scenario: Negative — Apple Silicon / ARM64 Mac simulation
    Tool: Bash (cargo test)
    Steps: fixture with arch=aarch64 → Unsupported error surfaced
    Expected Result: typed error, no panic
    Evidence: .sisyphus/evidence/task-5-unsupported-test.txt
  ```
  **Commit**: YES — `feat(hw-probe): apple intel profiling with fixture-tested parsers`

---

- [x] T6. `fit_engine` Module — TDD Golden Tests

  **What to do**:
  - Pure fn `evaluate(profile, entry, cfg) -> FitResult`:
    weights = entry.file_size_bytes
    kv_bytes(ctx) = 2 × n_layers × n_kv_heads × head_dim × min(ctx, context_train) × kv_elem_bytes(F16=2, Q8_0=1) × cfg.n_parallel
    est_total = weights + kv + ceil(0.05×weights) + 700MB floor
    fits = est_total ≤ host_budget(profile)
    max_context_that_fits: binary search largest ctx∈[512..context_train] fitting host budget (512 if even that fails)
    recommended_gpu_layers: if profile.gpu_vram_bytes > 0, calculate floor((gpu_vram_budget - kv_fraction) / layer_weight_bytes) capped at entry.n_layers; else 0
    speed_tps_estimate = const_bandwidth_GBps(hardware_tier) / active_params_b × efficiency_factor (Intel DDR4 ~35–50 GB/s for CPU; dGPU GDDR6 ~192–394 GB/s when offloaded) — document constants inline with citations comment
  - Scores 0..10: score_fit (headroom ratio), score_speed (tps percentile across catalog), score_quality (quality_tier)
  - GOLDEN TESTS (exact byte assertions):
    Llama-3.1-8B Q4_K_M @16GB Host RAM/ctx4096/F16/slots1 → kv=536,870,912B; total ≈ 4.51GB+0.5GB+0.23GB+0.7GB ≈ 5.94GB±0.05; fits=true
    Same with 4GB dGPU VRAM → recommended_gpu_layers computed for partial offload (~16-20 layers in VRAM)
    Same @8GB RAM/ctx8192 without dGPU → fits=false; max_context_that_fits computed and < 8192
    MoE Mixtral fixture → Host RAM uses total params size; speed uses active_params_b
  - Property test: increasing ctx never decreases est_total; increasing slots multiplies KV exactly ×n

  **Must NOT do**: IO; use of n_head anywhere; magic numbers without comments citing design doc §1

  **Recommended Agent Profile**: `ultrabrain` — the correctness heart of the product.
  **Parallelization**: Wave 2 · Blocks T14 · Blocked By: T2,T3(goldens)

  **References**:
  - Design doc §1 Ground-Truth Math + §4 field notes (kv-heads trap is THE regression target)
  - Research bg_9b733c6a: quant bpw table, worked examples, MoE rule
  - llama.cpp ggml-common.h K-quant block sizes (citation comment)

  **Acceptance Criteria**:
  - [x] All goldens pass with EXACT byte math (documented tolerances only where stated)
  - [x] Property tests green (monotonicity, slot multiplication)
  - [x] A deliberately wrong-kv-heads mutant fixture FAILS the golden suite (proves sensitivity)

  **QA Scenarios**:
  ```
  Scenario: Golden math holds
    Tool: Bash
    Steps: cargo test -p fit_engine -- --nocapture | tee evidence
    Expected Result: ≥8 golden tests pass; printed breakdowns match hand calc above
    Evidence: .sisyphus/evidence/task-6-goldens.txt
  Scenario: Negative — kv_heads regression detector
    Tool: Bash
    Steps: swap n_kv_heads→32 in Llama fixture → golden test MUST fail
    Expected Result: failure message shows ~4× KV inflation detected
    Evidence: .sisyphus/evidence/task-6-mutant-fails.txt
  ```
  **Commit**: YES — `feat(fit-engine): memory-fit math with golden fixtures`

---

- [x] T7. HuggingFace Downloader (TDD)

  **What to do**:
  - HEAD pre-flight on `https://huggingface.co/{repo}/resolve/main/{file}` → capture ETag (sha256 for LFS) + Content-Length; attach `Authorization: Bearer {token}` when gated/token present
  - Disk pre-flight: free ≥ size×1.05 else DiskFull error BEFORE transfer
  - Streaming GET to `{models_dir}/{id}.part`; progress events (bytes_done/total, MB/s); cancel token; auto-resume on retry using Range from .part length; max 3 backoff retries then surface error
  - Verify: sha256(file) == etag → rename `.part`→final; mismatch → delete + Checksum error
  - TDD against a local mock HTTP server (wiremock/axum test server): happy path, resume-after-interrupt (kill mid-transfer), checksum mismatch, 401-gated-no-token, disk-full (mocked stat)

  **Must NOT do**: load whole file in memory; follow redirects unboundedly; store token anywhere but caller-supplied secret handle

  **Recommended Agent Profile**: `deep` — network resilience logic.
  **Parallelization**: Wave 2 · Blocks T8,T15 · Blocked By: T2

  **References**:
  - Metis validation: resolve URL semantics; LFS ETag==sha256
  - Design doc SD3 sequence — states & transitions
  - reqwest streaming + tokio::fs patterns

  **Acceptance Criteria**
  - [x] Mock-server test suite green (≥6 scenarios above)
  - [x] Live QA: real ≤1GB model downloads, sha verified

  **QA Scenarios**:
  ```
  Scenario: Live small-model download + verify
    Tool: Bash
    Steps: cargo run --example download -- qwen2.5-0.5b-q4_k_m ; shasum -a 250... final file
    Expected Result: Ready state; sha256 equals catalog etag
    Evidence: .sisyphus/evidence/task-7-live-download.txt
  Scenario: Negative — checksum tamper
    Tool: Bash (cargo test)
    Steps: mock returns wrong bytes → Checksum error; .part removed
    Expected Result: test asserts file deleted + error variant
    Evidence: .sisyphus/evidence/task-7-tamper-test.txt
  ```
  **Commit**: YES — `feat(downloader): resumable verified GGUF acquisition`

---

- [x] T8. Library Store (local model management)

  **What to do**:
  - Dir layout `~/Library/Application Support/dev.yoel3imari.llm-advisor/models/{entry_id}.gguf`; records at `.../library.json`
  - Ops: add_verified(record), list(), delete(id) (file+record), reconcile() — scan dir vs records: orphan files reported+prunable, missing files marked Missing
  - Atomic record writes (tmp+rename); concurrent-safe via std Mutex

  **Must NOT do**: background watchers; deletion without explicit command

  **Recommended Agent Profile**: `quick`.
  **Parallelization**: Wave 2 · Blocks T10,T15 · Blocked By: T2,T7

  **References**: Design doc Model Lifecycle state machine §6 (states ↔ records)

  **Acceptance Criteria**
  - [x] Unit tests: add/list/delete/reconcile incl. orphan & missing cases (tempdir-based)

  **QA Scenarios**
  ```
  Scenario: Reconcile after manual deletion
    Tool: Bash
    Steps: download tiny model (T7 example) → rm file manually → cargo run --example library_reconcile
    Expected Result: record marked Missing; exit 0
    Evidence: .sisyphus/evidence/task-8-reconcile.txt
  ```
  **Commit**: YES (groups with T7 PR scope) — `feat(library): verified model store with reconciliation`

- [x] T9. llama-server Sidecar Acquisition + Bundling

  **What to do**:
  - `scripts/fetch-sidecar.sh`: download pinned llama.cpp release build (Metal/Accelerate x86_64 macOS) from GitHub releases; verify sha256 against PINNED constant recorded in script + `sidecars/README.md`; place as `src-tauri/binaries/llama-server-x86_64-apple-darwin` (Tauri sidecar naming)
  - `tauri.conf.json`: `bundle.externalBin` entry; capability file granting shell-execute sidecar:true
  - Smoke: run fetched binary `--version` and `/health` after starting with a tiny model
  - Document exact release URL/version/sha256 in sidecars/README.md

  **Must NOT do**: commit the binary; use `latest` tag; skip sha verification

  **Recommended Agent Profile**: `unspecified-high` — release-asset archaeology + config wiring.
  **Parallelization**: Wave 3 · Blocks T10 · Blocked By: T1

  **References**:
  - Metis validation: externalBin + sidecar:true capability requirement; codesign note (local-build OK unsigned)
  - llama.cpp releases page — pick a Metal/AVX2-enabled tagged x86_64 macOS release

  **Acceptance Criteria**:
  - [x] Script idempotent: re-run skips when sha matches
  - [x] Binary runs on dev machine: prints version

  **QA Scenarios**:
  ```
  Scenario: Pinned fetch + smoke
    Tool: Bash
    Steps: ./scripts/fetch-sidecar.sh && shasum -a 256 src-tauri/binaries/llama-server-* ; binary --version
    Expected Result: sha equals pinned constant; version prints
    Evidence: .sisyphus/evidence/task-9-sidecar-smoke.txt
  Scenario: Negative — tampered download rejected
    Tool: Bash
    Steps: corrupt a copy → run script in verify-mode against it → mismatch error exit≠0
    Evidence: .sisyphus/evidence/task-9-tamper.txt
  ```
  **Commit**: YES — `chore(sidecar): pin llama.cpp x86_64 macos build + tauri externalBin`

---

- [x] T10. `server_manager` — Sidecar Lifecycle (TDD where possible)

  **What to do**:
  - Spawn via std::process::Command (or tauri sidecar API) with args derived from ServeConfig and FitResult: `-m {path} --port {auto_free} -c {ctx} -np {slots}` `-ctk/-ctv {kv_type}` `-ngl {recommended_gpu_layers}` `--host 127.0.0.1`
  - Readiness: poll `GET /health` every 500ms up to 120s; parse load-progress lines from stdout for UI events
  - Singleton state machine exactly per design doc §6 Server Lifecycle; Mutex<ServerState>; stop() = SIGTERM → 5s grace → SIGKILL; auto-stop on app exit via Drop + tauri on_exit hook
  - Pre-flight hook: available-RAM check (sysinfo) vs FitResult.est_total; return Warning variant for UI confirm dialog
  - Crash detection: child exit while Starting/Serving → Error{captured stderr tail}
  - Tests: fake-child binary (tiny script that binds port & serves /health) for lifecycle unit tests incl. kill-on-drop, crash path, health timeout

  **Must NOT do**: ever leave orphan process; spawn second instance while Serving; swallow stderr

  **Recommended Agent Profile**: `deep`.
  **Parallelization**: Wave 3 · Blocks T11,T16 · Blocked By: T8,T9

  **References**:
  - Design doc SD4 sequence + Server Lifecycle diagram (state contract)
  - Research bg_9b733c6a: -np slots/KV interplay; ctx capping warning
  - Design doc §10 E8/E13 behaviors

  **Acceptance Criteria**:
  - [x] Fake-child lifecycle tests green: start→serving→stop frees port (`lsof` empty), crash→Error, drop kills child
  - [x] Live QA: real tiny model reaches Serving; logs captured

  **QA Scenarios**:
  ```
  Scenario: Live serve tiny model
    Tool: Bash
    Steps: cargo run --example serve -- qwen2.5-0.5b-q4_k_m ; sleep until ready; curl http://127.0.0.1:{internal}/health ; lsof -i :PORT after stop
    Expected Result: health 200; after stop lsof empty
    Evidence: .sisyphus/evidence/task-10-live-serve.txt
  Scenario: Negative — quit-during-serving teardown
    Tool: Bash
    Steps: start serve example then SIGKILL the example process; sleep 3; pgrep llama-server || echo CLEAN
    Expected Result: prints CLEAN (no orphan)
    Evidence: .sisyphus/evidence/task-10-orphan-check.txt
  ```
  **Commit**: YES — `feat(server-manager): supervised single-instance sidecar lifecycle`

---

- [x] T11. Axum Gateway — Public OpenAI-Compatible Proxy

  **What to do**:
  - axum server bound `127.0.0.1:13370` (fallback next ports upward on bind failure, log chosen port)
  - Routes: GET /v1/models (from server_manager state; OpenAI Model shape), POST /v1/chat/completions, POST /v1/completions, GET /healthz
  - Relay to internal sidecar port; **SSE passthrough with zero buffering** (`stream_body`/chunked relay); non-stream JSON relay too
  - When not Serving: structured 503 envelope per design doc §8; unknown paths → JSON 404; request timeout 300s
  - Integration test: gateway over fake-child OpenAI-ish mock asserting streaming chunks arrive incrementally (timestamps spaced)

  **Must NOT do**: buffer SSE; expose on 0.0.0.0; add auth beyond pass-through (documented v1)

  **Recommended Agent Profile**: `unspecified-high` — streaming correctness.
  **Parallelization**: Wave 3 · Blocks T16,F3 · Blocked By: T10

  **References**:
  - Design doc §8 API Contract table + error envelope (exact JSON)
  - SD5 sequence; llama-server /v1 route list from research
  - axum examples: reverse proxy w/ hyper client body streams

  **Acceptance Criteria**:
  - [x] curl non-stream chat returns choices[0].message.content non-empty against live tiny model
  - [x] `curl -N` stream shows incremental data: chunks (≥3 distinct timestamps)
  - [x] Idle gateway returns exact 503 envelope JSON

  **QA Scenarios**:
  ```
  Scenario: Streaming passthrough latency proof
    Tool: Bash
    Steps: start serve (T10) ; curl -N -s -X POST .../chat/completions stream:true | while read line; do date +%s.%N; done > evidence
    Expected Result: line timestamps spread across seconds (not one burst)
    Evidence: .sisyphus/evidence/task-11-sse-timing.txt
  Scenario: Negative — idle gateway
    Tool: Bash
    Steps: ensure stopped; curl /v1/chat/completions → jq .error.code == 503
    Evidence: .sisyphus/evidence/task-11-idle503.json
  ```
  **Commit**: YES — `feat(gateway): localhost openai-compatible streaming proxy`

- [x] T12. App Shell, Navigation, IPC Bindings

  **What to do**:
  - React shell: sidebar nav (Dashboard · Recommend · Library · Server · Settings), status pill (server state), dark-mode-first styling
  - Typed IPC layer: `src/ipc/commands.ts` mirroring every Tauri command (invoke wrappers + event listeners for progress/state); mock implementation switchable via `VITE_MOCK_IPC=1` for Playwright
  - Global error boundary surfacing AppError messages; toast system for transient events

  **Must NOT do**: view internals (own tasks); any business logic in frontend beyond display

  **Recommended Agent Profile**: `visual-engineering`. Skills: [`react-19`] for compiler-era hook patterns.
  **Parallelization**: Wave 4 · Blocks T13-T17 · Blocked By: T1,T2

  **References**: Design doc §3 component names = nav labels; SD1–SD5 define events UI consumes

  **Acceptance Criteria**:
  - [x] `npm run build` green; Playwright: shell renders 5 nav items; clicking each switches route (mock IPC)

  **QA Scenarios**:
  ```
  Scenario: Navigation smoke (mocked)
    Tool: Playwright @ vite dev (VITE_MOCK_IPC=1)
    Steps: goto localhost:1420 → expect nav 'Dashboard','Recommend','Library','Server','Settings' visible → click each → h2 changes accordingly
    Evidence: .sisyphus/evidence/task-12-nav.png
  Scenario: Negative — IPC failure surfaces toast
    Tool: Playwright (mock rejects)
    Steps: force reject get_profile → error toast text contains message from AppError
    Evidence: .sisyphus/evidence/task-12-error-toast.png
  ```
  **Commit**: YES — `feat(ui): app shell with typed ipc and error surface`

---

- [x] T13. Specs Dashboard View

  **What to do**:
  - Cards: Intel CPU model + core count, Host RAM total vs usable budget bar, GPU identity & dedicated VRAM bar (if dGPU present), disk free; "Refresh" button → UC2 flow; unsupported-platform full-screen branch (E1)
  - Budget bar shows host memory headroom and dedicated GPU VRAM headroom when available

  **Recommended Agent Profile**: `visual-engineering`.
  **Parallelization**: Wave 4 · Blocks T14,T15,T16 views · Blocked By: T5,T12

  **References**: SD1 sequence; design doc §4 HardwareProfile fields displayed verbatim; E1 branch

  **Acceptance Criteria**:
  - [x] Playwright(mock): cards render fixture values exactly; refresh triggers detect_profile call count increment

  **QA Scenarios**:
  ```
  Scenario: Dashboard renders profile
    Tool: Playwright (mock Intel Core i9-9880H + AMD Radeon Pro fixture)
    Steps: goto / → expect text "Intel Core i9", Host RAM and VRAM bars width proportional to fixture ratio
    Evidence: .sisyphus/evidence/task-13-dashboard.png
  Scenario: Negative — unsupported platform branch
    Tool: Playwright (mock returns Unsupported error)
    Steps: goto / → full-screen unsupported notice renders; nav disabled
    Evidence: .sisyphus/evidence/task-13-unsupported.png
  ```
  **Commit**: YES — `feat(ui): hardware dashboard`

---

- [x] T14. Recommendations View

  **What to do**:
  - Context-size slider (512..max trained across catalog) + KV-type toggle driving live re-fit via IPC
  - Ranked cards: verdict badge (Fits/Tight/No), memory breakdown mini-bars (weights/KV/overhead), est GB total, max-context-that-fits, tps estimate, quality stars, gated 🔒; group by base model (E15)
  - Card CTA states: Download (→T15 flow) or Serve-if-ready

  **Recommended Agent Profile**: `visual-engineering`.
  **Parallelization**: Wave 4 · Blocks T16 · Blocked By: T6,T13

  **References**: SD2 sequence output contract (FitResult fields on cards); §10 E9/E15 UX notes

  **Acceptance Criteria**
  - [x] Playwright(mock): slider move re-invokes recommend with new ctx param; card order changes per fixture ranking; breakdown bars sum ≈ total label

  **QA Scenarios**
  ```
  Scenario: Re-fit on ctx change
    Tool: Playwright (mock)
    Steps: set ctx 4096→16384 → assert recommend called with 16384 and a previously-Fits card flips to No with max_ctx shown
    Evidence: .sisyphus/evidence/task-14-refit.mp4 or png
  Scenario: Negative — catalog load failure
    Tool: Playwright (mock recommend rejects with CatalogParse)
    Steps: open view → inline error state with retry button, no blank screen
    Evidence: .sisyphus/evidence/task-14-catalog-error.png
  ```
  **Commit**: YES — `feat(ui): ranked recommendations with live refit`

---

- [x] T15. Library & Downloads View

  **What to do**:
  - Table of ModelRecords: size, verified ✅, added date; actions delete/reveal; reconcile-on-mount (Missing/orphan banners E11)
  - Active DownloadTask rows: progress %, MB/s, pause/resume/cancel wired to events; disk-full & checksum-failure inline errors (E3/E5); gated-token prompt hand-off link to Settings (E2)

  **Recommended Agent Profile**: `visual-engineering`.
  **Parallelization**: Wave 4 · Blocked By: T7,T8,T13

  **References**: SD3 sequence states ↔ row rendering; lifecycle diagram states as badges

  **Acceptance Criteria**
  - [x] Playwright(mock): simulated task Queued→Downloading(37%)→Verifying→Ready updates one row through all badge states; cancel clears it

  **QA Scenarios**
  ```
  Scenario: Progress lifecycle render
    Tool: Playwright (event-simulating mock)
    Evidence: .sisyphus/evidence/task-15-progress.png
  Scenario: Negative — checksum failure banner
    Tool: Playwright (mock emits Failed{reason:Checksum})
    Expected Result: row shows retry affordance + explanatory text
    Evidence: .sisyphus/evidence/task-15-checksum-fail.png
  ```
  **Commit**: YES — `feat(ui): library with download lifecycle`

---

- [x] T16. Server Control Panel

  **What to do**:
  - Model selector (Ready records only) + ServeConfig summary chips; big Serve/Stop button reflecting state machine §6 (disabled during Starting w/ spinner + stdout-derived load %); endpoint copy chip `http://127.0.0.1:13370/v1` with curl snippet; logs tail pane (last 200 lines, autoscroll toggle)
  - Warning-dialog path when server_manager returns available-RAM Warning (E10): proceed/cancel
  - Error state renders captured stderr tail (E8)

  **Recommended Agent Profile**: `visual-engineering`.
  **Parallelization**: Wave 4 last · Blocked By: T10,T11,T14,T15

  **References**: SD4/SD5; §8 healthz fields; §10 E8/E10/E13

  **Acceptance Criteria**
  - [x] Playwright(mock): full cycle Stopped→Starting(45%)→Serving flips button & enables endpoint chip; Stop returns to Stopped

  **QA Scenarios**
  ```
  Scenario: State-machine driven UI
    Tool: Playwright (state-emitting mock)
    Evidence: .sisyphus/evidence/task-16-panel-cycle.png
  Scenario: Negative — OOM crash render
    Tool: Playwright (mock emits Crash stderr tail)
    Expected Result: red panel with log excerpt + suggestion text (lower ctx)
    Evidence: .sisyphus/evidence/task-16-crash.png
  ```
  **Commit**: YES — `feat(ui): server control panel with logs`

---

- [x] T17. Settings (Token, Ports, Defaults)

  **What to do**:
  - HF token field → macOS Keychain via `keyring` crate (never in plaintext config/UI state after save); masked input, test-token call to HF `/api/whoami-v2`
  - Gateway port override (default 13370), models-dir override; default ServeConfig (ctx, kv_type)
  - Persist non-secret prefs JSON in app-support dir

  **Recommended Agent Profile**: `quick`.
  **Parallelization**: Wave 4 · Blocked By: T12

  **References**: E2 gated flow; ADR list re localhost-only port policy

  **Acceptance Criteria**
  - [x] Save token → keychain entry exists (`security find-generic-password` QA); config roundtrip test

  **QA Scenarios**
  ```
  Scenario: Token lands in Keychain only
    Tool: Bash
    Steps: drive save via example binary; security find-generic-password -s llm-advisor > evidence; grep config.json for token value || echo NOT-IN-CONFIG
    Expected Result: keychain hit; prints NOT-IN-CONFIG
    Evidence: .sisyphus/evidence/task-17-keychain.txt
  ```
  **Commit**: YES — `feat(settings): keychained hf token + serving defaults`

---

## Final Verification Wave

- [x] F1. **Plan Compliance Audit** — `oracle`
  Read the plan + design doc end-to-end. For every Must Have: verify by reading files / running commands. For every Must NOT Have: grep for violations (`llmfit` in Cargo.toml, non-localhost bind, bundled .gguf files, `unwrap()` in process paths). Verify `.sisyphus/evidence/` completeness.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [x] F2. **Code Quality Review** — `unspecified-high`
  Run `cargo clippy --workspace -- -D warnings`, `cargo fmt --check`, `cargo test`, `npm run build`. Review diffs for: `as any`/`@ts-ignore`, empty catches, console.log in prod paths, dead code, AI-slop comments, generic names.
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N/N] | VERDICT`

- [x] F3. **Real Manual QA** — `unspecified-high`
  Clean state (delete app-support dir). Execute EVERY QA scenario from T1–T17 exactly, capture evidence to `.sisyphus/evidence/final-qa/`. Cross-task integration: full journey SD1→SD5. Edge cases: E2 (gated no-token), E3 (disk full simulated), E6 (port occupied), E13 (quit while serving → `lsof -i` empty).
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [x] F4. **Scope Fidelity Check** — `deep`
  Per task: spec vs diff 1:1. No creep beyond Must-Haves; no missing deliverables; cross-task contamination flagged; unaccounted changes listed.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N] | Unaccounted [CLEAN/N] | VERDICT`

**Do NOT auto-complete after F1-F4. Present consolidated results and wait for explicit user okay.**

---

## Commit Strategy
- One commit per task: `feat(hw-probe): ...`, `test(fit-engine): golden fixtures`, `chore(sidecar): pin llama.cpp release`
- Pre-commit: `cargo fmt && cargo test --workspace && npm run build`
- Never commit: model weights, HF tokens, sidecar binaries (provisioned by script into ignored dir)

## Success Criteria

```bash
cargo test --workspace          # Expected: all green incl. fit goldens
cargo clippy -- -D warnings     # Expected: clean
curl -s http://127.0.0.1:13370/v1/models   # Expected: loaded model JSON while serving
curl -N -X POST http://127.0.0.1:13370/v1/chat/completions \
  -d '{"model":"any","messages":[{"role":"user","content":"hi"}],"stream":true}' \
  # Expected: SSE data: chunks flowing incrementally
```

Final Checklist
- [x] All Must-Have behaviors demonstrated with evidence
- [x] All Guardrails hold under audit greps
- [x] Design doc materialized as `docs/architecture.md` in repo

---

## Appendix: Multi-Platform & App Lifecycle Implementation Roadmap

### A.1 Cross-Platform Architecture Foundation (Single Codebase)
The MVP implementation in Phase 1–3 strictly isolates OS-specific logic behind Rust traits:
1. **Hardware Probing**: `trait HardwareProfiler` implemented via `#[cfg(target_os = "...")]` in `hw_probe`.
2. **Secrets**: `trait SecretVault` implemented via `keyring` (macOS Keychain, Windows Credential Manager, Linux Secret Service).
3. **Inference Sidecar**: Mapped via Tauri 2 `externalBin` target triples:
   - `llama-server-x86_64-apple-darwin` (macOS Intel — v1)
   - `llama-server-aarch64-apple-darwin` (macOS Apple Silicon — v2)
   - `llama-server-x86_64-pc-windows-msvc.exe` (Windows — v2)
   - `llama-server-x86_64-unknown-linux-gnu` (Linux — v2)
4. **Shared Core (~85%)**: All Axum gateway proxying, HuggingFace Range resume downloading, catalog JSON validation, pure memory math evaluation, and React UI are 100% platform-agnostic.

### A.2 Decoupled Data Storage
To ensure multi-GB models are preserved across app updates and can be moved to external storage:
- **App Binaries**: Managed by OS installer / bundle (`.dmg`, `.msi`, `.AppImage`).
- **Config & Metadata**: Small JSON files in standard OS config directory (`app_config_dir`).
- **Model Store**: Heavy `.gguf` weights stored in `app_local_data_dir/models` (user-customizable in Settings to external drives).

### A.3 Cryptographic Auto-Updates
Configured via Tauri 2 `@tauri-apps/plugin-updater`:
- Minisign ed25519 public key in `tauri.conf.json`.
- Releases published with `latest.json` manifests via GitHub Actions.
- Atomic binary replacement without altering downloaded models or user configurations.

### A.4 Uninstallation & Disk Cleanup
- In-App "Storage & Cleanup" settings panel with "Purge Downloaded Models" (reclaim disk space) and "Factory Reset" (wipe data + credentials).
- Windows NSIS uninstallation prompt to optionally remove multi-GB models.
- macOS/Linux guidance and clean-uninstallation script.

