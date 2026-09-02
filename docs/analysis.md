## Summary of Your Feedback: 🌟 **Spot-On, Actionable, and Prioritized**

| Priority | Issue | Severity | My Agreement |
|----------|-------|----------|--------------|
| **1** | Metal + AMD dGPU unvalidated assumption | 🔴 Critical | **100%** — this is the single biggest risk |
| **2** | ADR-3 vs E6 port contradiction | 🟡 Major | **Yes** — either pick stability or fail clearly |
| **3** | Section 13.1 scope leak (signing/notarization) | 🟡 Medium | **Good catch** — inconsistent with Non-Goals |
| **4** | GGUF header cross-check for `n_kv_heads` | 🟢 Enhancement | **Excellent idea** — turns curator risk into self-verification |
| **5** | Multi-platform section over-investment | 🟢 Minor | **Fair** — good as "future-looking" but distracting |
| **6** | Health-poll timeout static | 🟢 Minor | **True** — make configurable with graceful progress |
| **7** | `activations_margin` heuristic justification | 🟢 Nit | **Agreed** — add code comment |

---

## Response to Each Point

### 1️⃣ 🔴 Metal + AMD dGPU is your biggest unvalidated assumption

**You're absolutely right.** Here's what I'd add to the design document:

**Immediate Action (Week 1 Spike):**
```markdown
### Spike: Metal on Intel + AMD dGPU Validation
**Goal**: Determine if `llama-server` Metal backend reliably offloads to AMD Radeon Pro on Intel Macs.

**Hardware test matrix**:
- Radeon Pro 5500M 4GB (16-inch MBP 2019)
- Radeon Pro 555X 4GB (15-inch MBP 2018)
- Radeon Pro Vega 16/20 (MacBook Pro 2019)
- Intel UHD Graphics 630 (13-inch MBP) — integrated fallback

**Test Protocol**:
1. Build `llama-server` with Metal support (or use bundled binary)
2. Run same model (e.g., Llama-3.2-3B-Q4_K_M) with `-ngl` from 0 to full layers
3. Measure:
   - Load success rate
   - Tokens/sec (`--metrics`)
   - VRAM usage (`sudo powermetrics` or `sudo fs_usage`)
   - Stability: 100 prompts, check for crashes/segfaults
4. Compare to "CPU only" baseline

**Decision Gates**:
- ✅ If stable + 2× CPU speedup → full v1 supports dGPU
- ⚠️ If stable but < 1.5× speedup → "cpu_ram" mode + note in UI
- ❌ If crashes/instability → downgrade to "CPU fallback" for Intel Macs, offer "Apple Silicon unified memory" as v2 target
```

**Update to ADR**: Add a new ADR-11: "Metal dGPU fallback strategy" based on spike results.

---

### 2️⃣ 🟡 ADR-3 and E6 contradict each other

**Fix**: Pick one consistent strategy.

**Option A: Hard Fail (Recommended for v1)**
```markdown
**ADR-3a (Revised)**: Gateway binds strictly to port `13370`. If occupied, the app:
- Fails to start server with clear error dialog:
  "Port 13370 is in use. Free it or change port in Settings → Advanced."
- Does NOT auto-retry on another port.
- Settings page allows changing gateway_port, requiring app restart.

**Rationale**: External clients hardcode :13370. "Stable public port" must be absolute, not relative.
```

**Option B: Auto-fallback with Strong Discoverability**
```markdown
**ADR-3b (Revised)**: Gateway binds first to `13370`; if occupied, tries `13371`, `13372` up to 5 attempts.
- **UI**: Snackbar toast: "Gateway running on http://127.0.0.1:{PORT} (copy to clipboard)"
- **OS Integration**: Write `/tmp/llm-advisor-gateway.port` with the actual port for script discovery
- **External clients**: Support `LLM_ADVISOR_PORT` env var or discovery endpoint (`GET /healthz` returns port)

**Rationale**: User-friendly (no manual port management), but clients must be port-aware. API clients can read the port file.
```

**My vote**: **Option A** for v1 (simpler, predictable), **Option B** for v2 with user education.

---

### 3️⃣ 🟡 Section 13.1 scope leak

**Fix**: Move to "Future Work" or caveat clearly:

```markdown
### 13.1 Distribution & Packaging (v2+ Future Work)

*Note: For v1, the deliverable is a local build (`tauri dev`) and local bundle for testing. The following sections describe the intended distribution strategy for production releases once the app is signed/notarized.*

**Future Packaging Matrix**:
- **macOS**: `.dmg` (drag-and-drop), codesigned with Apple Developer ID + notarized via `notarytool`
- **Windows**: `.msi` (WiX) or `.exe` (NSIS), code-signed via SignTool
- **Linux**: `.AppImage`, `.deb`, `.rpm`

**Update Strategy** (v2): Tauri Updater with minisign ed25519 signatures against GitHub Releases.
```

---

### 4️⃣ 🟢 GGUF header cross-check for `n_kv_heads`

**Excellent idea** — this is the kind of engineering rigor that makes a product trustworthy.

**Add to Download/Verification flow (SD3):**

```mermaid
sequenceDiagram
    DL->>DL: sha256(file) == etag
    alt checksum OK
        DL->>DL: read GGUF header metadata
        Note over DL: n_head_kv, n_layer, head_dim, hidden_size
        DL->>CAT: compare CatalogEntry fields vs header
        alt mismatch (e.g., n_kv_heads differs)
            DL-->>UI: error "Catalog metadata mismatch with downloaded GGUF"
            Note over DL,UI: Show both values; offer to override catalog or re-download
        else match
            DL->>LIB: ModelRecord(verified=true, metadata_from_gguf)
            DL-->>UI: Ready
        end
    end
```

**Why this is powerful**:
- The catalog can still be the primary source (fast recommendations before download)
- But after download, the **GGUF header becomes the source of truth**
- This catches the #1 risk (`n_kv_heads` typing error) at verification time
- It also enables **dynamic catalog updates**: after download, you have real metadata

**Add to Data Model**:
```rust
struct VerifiedMetadata {
    n_layers: u32,
    n_head_kv: u32,      // GQA heads — cross-checked from GGUF
    head_dim: u32,
    context_train: u32,
    file_sha256: String,
    // ... other fields read from GGUF
}
```

---

### 5️⃣ 🟢 Multi-platform section over-investment

**Agreed**. I'd condense Section 12 to:

```markdown
## 12. Multi-Platform Roadmap (v2+)

The core (fit_engine, gateway, downloader, catalog, UI) is platform-agnostic. Platform-specific code is abstracted behind two traits:

- `HardwareProfiler` → returns `HardwareProfile` for current OS
- `SecretVault` → stores/retrieves HF tokens

Platform backends will be implemented when targeting:
- macOS Apple Silicon (v2)
- Windows (v2)
- Linux (v2)

For details on each platform's hardware probing methods and sidecar binaries, see the implementation plan `.sisyphus/plans/multi-platform.md` (future).
```

This keeps the document focused on the **v1 scope** while acknowledging the architecture supports expansion.

---

### 6️⃣ 🟢 Health-poll timeout static

**Fix**: Make it proportional to model size:

```rust
let timeout_seconds = match model_size_gb {
    < 5 => 60,
    5..=20 => 120,
    20..=50 => 240,
    _ => 300,  // 70B models on slow storage may take 5+ minutes
};
```

**UI**: Show "Loading model... {elapsed}s elapsed" with a spinner; don't hard-fail until user hits cancel.

---

### 7️⃣ 🟢 `activations_margin` heuristic justification

**Add code comment**:

```rust
// Safety margin: empirically, activation memory grows with batch/sequence length
// but we don't model it directly in v1. 5% of weights is a conservative fudge
// factor that compensates for intermediate tensors and peak memory spikes.
// Real activation memory is sequence-dependent; consider adding a proper
// formula if users report memory issues at large contexts.
const ACTIVATIONS_MARGIN: f32 = 0.05;
```

---

## Your Request: Validation Script / Fit Engine Test Cases

### A. Metal+AMD Spike Checklist

**File**: `scripts/validate_metal_intel.sh`

```bash
#!/bin/bash
# Validation script for llama.cpp Metal on Intel + AMD dGPU

set -e

# Test models (small for quick iteration)
MODELS=(
    "https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf"
    "https://huggingface.co/bartowski/Llama-3.1-8B-Instruct-GGUF/resolve/main/Llama-3.1-8B-Instruct-Q4_K_M.gguf"
)

# GPU layers to test (0 = CPU only, -1 = all)
NGLS=(0 10 20 30 40 99 999)

# Test prompts (fixed for benchmarking)
PROMPT="Write a short haiku about AI."

# Metrics to capture
# - Load time
# - Tokens/sec
# - Peak memory (VRAM + RAM)
# - Stability (crashes?)

for MODEL in "${MODELS[@]}"; do
    echo "Testing: $MODEL"
    MODEL_NAME=$(basename "$MODEL" .gguf)
    
    for NGL in "${NGLS[@]}"; do
        echo "  -ngl $NGL"
        
        # Start server with metrics
        ./llama-server -m "$MODEL_NAME.gguf" \
            -ngl "$NGL" \
            -c 4096 \
            --metrics \
            --port 8080 &
        SERVER_PID=$!
        
        sleep 5  # Let it load
        
        # Run test prompts
        for i in {1..10}; do
            curl -s -X POST http://localhost:8080/v1/chat/completions \
                -H "Content-Type: application/json" \
                -d '{"messages":[{"role":"user","content":"'"$PROMPT"'"}]}' \
                > /dev/null
        done
        
        # Fetch metrics
        curl -s http://localhost:8080/metrics > "metrics_${MODEL_NAME}_ngl${NGL}.json"
        
        kill $SERVER_PID
        wait $SERVER_PID 2>/dev/null || true
        
        echo "  ✓ Completed"
        echo ""
    done
done

echo "✅ Validation complete. Check metrics files."
```

**Success Criteria**:
- ✅ No crashes in 10 prompts for any `-ngl` value
- ✅ Tokens/sec monotonic increase up to VRAM saturation
- ✅ Peak VRAM ≤ reported GPU VRAM (check with `sudo powermetrics`)

---

### B. Fit Engine Golden Test Cases

**File**: `fit_engine/tests/goldens.rs`

```rust
#[cfg(test)]
mod golden_tests {
    use super::*;

    #[test]
    fn test_llama_3_1_8b_q4_k_m_on_32gb_ram() {
        let profile = HardwareProfile {
            total_ram_bytes: 32 * 1024 * 1024 * 1024,
            metal_working_set_bytes: 24 * 1024 * 1024 * 1024, // 75%
            has_unified_memory: true,
            gpu_vram_bytes: None,
            ..default()
        };

        let entry = catalog_entry!(
            id: "llama-3.1-8b-q4_k_m",
            file_size_bytes: 4.6 * 1024 * 1024 * 1024,
            n_layers: 32,
            n_kv_heads: 8,
            head_dim: 128,
            context_train: 131072,
            quant: "Q4_K_M",
        );

        let config = ServeConfig {
            context_size: 4096,
            n_parallel: 1,
            kv_type: KvType::F16,
            n_gpu_layers: "auto".to_string(),
        };

        let result = fit_engine::evaluate(&profile, &entry, &config);
        
        // Expectations
        assert!(result.fits); // Should fit in 32GB
        assert!(result.max_context_that_fits >= 8192); // Should handle 8K easily
        assert!(result.est_total_bytes < 20 * 1024 * 1024 * 1024); // Under 20GB
    }

    #[test]
    fn test_llama_3_1_70b_q2_k_on_16gb_ram_fails() {
        let profile = HardwareProfile {
            total_ram_bytes: 16 * 1024 * 1024 * 1024,
            metal_working_set_bytes: 12 * 1024 * 1024 * 1024,
            ..default()
        };

        let entry = catalog_entry!(
            id: "llama-3.1-70b-q2_k",
            file_size_bytes: 32 * 1024 * 1024 * 1024, // 32GB
            n_layers: 80,
            n_kv_heads: 8,
            head_dim: 128,
            context_train: 131072,
        );

        let result = fit_engine::evaluate(&profile, &entry, &default_config());
        
        assert!(!result.fits); // Should NOT fit in 16GB
        assert!(result.max_context_that_fits < 512); // At most tiny context
    }

    #[test]
    fn test_kv_cache_math_correct_for_gqa() {
        // Llama-3.1-8B: n_kv_heads=8, head_dim=128
        // KV cache = 2 * 32 * 8 * 128 * 4096 * 2 (f16)
        // = 2 * 32 * 8 * 128 * 4096 * 2
        // = 2 * 32 * 8 * 128 * 4096 * 2 = 2,147,483,648 bytes ≈ 2GB
        // If someone incorrectly used n_head=32, it would be 8GB
        let entry = catalog_entry!(
            n_layers: 32,
            n_kv_heads: 8,     // Correct GQA
            head_dim: 128,
        );
        
        let kv_bytes = fit_engine::kv_cache_bytes(
            &entry, 4096, 1, KvType::F16
        );
        
        assert_eq!(kv_bytes, 2 * 32 * 8 * 128 * 4096 * 2);
        // Regression test: if someone changes n_kv_heads to 32, this fails
    }

    #[test]
    fn test_gemma_2_9b_head_dim_deviation() {
        // Gemma uses explicit head_dim, not hidden/n_heads
        let entry = catalog_entry!(
            head_dim: 256,        // Explicitly set in Gemma
            hidden_size: 3072,
            n_heads: 16,          // 3072/16 = 192, NOT 256
        );
        
        // Should NOT infer head_dim from hidden_size/n_heads for Gemma
        assert_eq!(entry.head_dim, 256);
        assert_ne!(entry.hidden_size / entry.n_heads, entry.head_dim);
    }
}
```

---

## Updated Document Structure (Suggested Changes)

1. **Add Section 14: "Pre-Implementation Validation Spikes"** (before phased delivery)
   - 14.1: Metal + AMD dGPU validation (as above)
   - 14.2: Gateway port strategy decision (Option A vs B)

2. **Move Section 12 (Multi-Platform)** to "Future Roadmap" appendix

3. **Update Section 3 (Component Architecture)**: Add `gguf_parser` module that reads headers and cross-checks catalog

4. **Update Edge Cases**: Add E16 (Catalog/GGUF metadata mismatch)

---

## Final Takeaway

Your feedback is **exactly the kind of review this document needed** — it's not "nice-to-have" polish, it's **risk mitigation** on the two places where the plan could ship broken:

1. **GPU backend reliability** — de-risk early, or pivot to CPU-only with transparency
2. **Port stability** — pick a strategy and own it

Everything else is good engineering judgment that will surface naturally during implementation.

**Shall I prepare a revised `LLM Advisor — System Design Document` incorporating these changes?**