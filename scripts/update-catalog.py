#!/usr/bin/env python3
"""
scripts/update-catalog.py
Automated HuggingFace Hub catalog ingestion and verification tool for llm-advisor.

Features:
- Sends pre-flight HEAD requests to verify file URLs, Content-Length, and LFS SHA256 ETag.
- Detects gated models (HTTP 401/403) and 404 missing files.
- Inspects HuggingFace config.json/text_config.json for architecture parameters:
  * n_layers (num_hidden_layers)
  * n_kv_heads (num_key_value_heads - GQA)
  * head_dim (head_dim or hidden_size / num_attention_heads)
  * context_train (max_position_embeddings or context_length)
  * active_params_b (MoE expert routing)
- Protects against API rate-limits with metadata preservation.
- Formats and writes crates/catalog/catalog.json.
"""

import sys
import os
import json
import re
import urllib.request
import urllib.error
import ssl
from pathlib import Path
from fetch_benchmarks import get_model_benchmarks

ROOT_DIR = Path(__file__).resolve().parent.parent
CATALOG_PATH = ROOT_DIR / "crates" / "catalog" / "catalog.json"

# Base model mapping for GGUF quant repos that lack direct config.json
BASE_MODEL_MAP = {
    "bartowski/Meta-Llama-3.1-8B-Instruct-GGUF": "meta-llama/Meta-Llama-3.1-8B-Instruct",
    "bartowski/Meta-Llama-3.1-70B-Instruct-GGUF": "meta-llama/Meta-Llama-3.1-70B-Instruct",
    "bartowski/Llama-3.2-1B-Instruct-GGUF": "meta-llama/Llama-3.2-1B-Instruct",
    "bartowski/Llama-3.2-3B-Instruct-GGUF": "meta-llama/Llama-3.2-3B-Instruct",
    "bartowski/gemma-2-2b-it-GGUF": "google/gemma-2-2b-it",
    "bartowski/gemma-2-9b-it-GGUF": "google/gemma-2-9b-it",
    "bartowski/gemma-2-27b-it-GGUF": "google/gemma-2-27b-it",
    "bartowski/Mistral-7B-Instruct-v0.3-GGUF": "mistralai/Mistral-7B-Instruct-v0.3",
    "bartowski/Mistral-Nemo-Instruct-2407-GGUF": "mistralai/Mistral-Nemo-Instruct-2407",
    "bartowski/Phi-3.5-mini-instruct-GGUF": "microsoft/Phi-3.5-mini-instruct",
    "bartowski/DeepSeek-R1-Distill-Qwen-1.5B-GGUF": "deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B",
    "bartowski/DeepSeek-R1-Distill-Qwen-7B-GGUF": "deepseek-ai/DeepSeek-R1-Distill-Qwen-7B",
    "bartowski/DeepSeek-R1-Distill-Qwen-14B-GGUF": "deepseek-ai/DeepSeek-R1-Distill-Qwen-14B",
    "bartowski/DeepSeek-R1-Distill-Qwen-32B-GGUF": "deepseek-ai/DeepSeek-R1-Distill-Qwen-32B",
    "bartowski/DeepSeek-R1-Distill-Llama-8B-GGUF": "deepseek-ai/DeepSeek-R1-Distill-Llama-8B",
    "bartowski/DeepSeek-R1-Distill-Llama-70B-GGUF": "deepseek-ai/DeepSeek-R1-Distill-Llama-70B",
    "TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF": "TinyLlama/TinyLlama-1.1B-Chat-v1.0",
    "TheBloke/Mixtral-8x7B-Instruct-v0.1-GGUF": "mistralai/Mixtral-8x7B-Instruct-v0.1",
    "Qwen/Qwen2.5-0.5B-Instruct-GGUF": "Qwen/Qwen2.5-0.5B-Instruct",
    "Qwen/Qwen2.5-1.5B-Instruct-GGUF": "Qwen/Qwen2.5-1.5B-Instruct",
    "Qwen/Qwen2.5-3B-Instruct-GGUF": "Qwen/Qwen2.5-3B-Instruct",
    "Qwen/Qwen2.5-7B-Instruct-GGUF": "Qwen/Qwen2.5-7B-Instruct",
    "Qwen/Qwen2.5-14B-Instruct-GGUF": "Qwen/Qwen2.5-14B-Instruct",
    "Qwen/Qwen2.5-32B-Instruct-GGUF": "Qwen/Qwen2.5-32B-Instruct",
    "Qwen/Qwen2.5-Coder-7B-Instruct-GGUF": "Qwen/Qwen2.5-Coder-7B-Instruct",
    "Qwen/Qwen2.5-Coder-14B-Instruct-GGUF": "Qwen/Qwen2.5-Coder-14B-Instruct",
    "Qwen/Qwen2.5-Coder-32B-Instruct-GGUF": "Qwen/Qwen2.5-Coder-32B-Instruct",
}

def get_ssl_context():
    ctx = ssl.create_default_context()
    return ctx

def create_request(url, method="GET", token=None):
    req = urllib.request.Request(url, method=method)
    req.add_header("User-Agent", "llm-advisor-catalog-builder/1.0")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    return req

def head_file_metadata(repo_id, filename, token=None):
    url = f"https://huggingface.co/{repo_id}/resolve/main/{filename}"
    req = create_request(url, method="HEAD", token=token)
    ctx = get_ssl_context()
    
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
            headers = dict(resp.headers)
            content_length = resp.headers.get("Content-Length")
            etag = resp.headers.get("ETag") or resp.headers.get("etag") or ""
            
            # Clean ETag
            etag_clean = etag.strip('"').strip("'").strip()
            if etag_clean.startswith("W/"):
                etag_clean = etag_clean[2:].strip('"')
            
            size_bytes = int(content_length) if content_length and content_length.isdigit() else 0
            
            return {
                "status": resp.status,
                "size_bytes": size_bytes,
                "etag": etag_clean,
                "gated": False,
                "url": url,
            }
    except urllib.error.HTTPError as e:
        if e.code in (401, 403):
            return {
                "status": e.code,
                "size_bytes": 0,
                "etag": "",
                "gated": True,
                "url": url,
            }
        elif e.code == 404:
            return {
                "status": 404,
                "size_bytes": 0,
                "etag": "",
                "gated": False,
                "url": url,
                "error": "File not found (404)"
            }
        else:
            return {
                "status": e.code,
                "size_bytes": 0,
                "etag": "",
                "gated": False,
                "url": url,
                "error": f"HTTP {e.code}"
            }
    except Exception as ex:
        return {
            "status": 0,
            "size_bytes": 0,
            "etag": "",
            "gated": False,
            "url": url,
            "error": str(ex)
        }

TREE_CACHE = {}

def fetch_file_lfs_metadata(repo_id, filename, token=None):
    if repo_id not in TREE_CACHE:
        url = f"https://huggingface.co/api/models/{repo_id}/tree/main"
        req = create_request(url, method="GET", token=token)
        ctx = get_ssl_context()
        try:
            with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
                TREE_CACHE[repo_id] = json.loads(resp.read().decode("utf-8"))
        except Exception as e:
            TREE_CACHE[repo_id] = []
    
    files = TREE_CACHE.get(repo_id, [])
    matched = next((f for f in files if f.get("path") == filename), None)
    if matched:
        lfs = matched.get("lfs", {})
        return {
            "sha256": lfs.get("oid", ""),
            "size_bytes": lfs.get("size", matched.get("size", 0)),
        }
    return {}

def fetch_config_json(repo_id, token=None):
    urls_to_try = [
        f"https://huggingface.co/{repo_id}/raw/main/config.json",
    ]
    if repo_id in BASE_MODEL_MAP:
        base_repo = BASE_MODEL_MAP[repo_id]
        urls_to_try.append(f"https://huggingface.co/{base_repo}/raw/main/config.json")
    
    ctx = get_ssl_context()
    for url in urls_to_try:
        try:
            req = create_request(url, method="GET", token=token)
            with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                return data
        except Exception:
            continue
    return None

def extract_arch_params(config, existing=None):
    if not config or not isinstance(config, dict):
        return {}
    
    cfg = config.get("text_config", config)
    
    n_layers = (
        cfg.get("num_hidden_layers")
        or cfg.get("n_layer")
        or cfg.get("num_layers")
        or (existing.get("n_layers") if existing else None)
    )
    
    n_kv_heads = (
        cfg.get("num_key_value_heads")
        or cfg.get("n_head_kv")
        or cfg.get("num_kv_heads")
        or (existing.get("n_kv_heads") if existing else None)
    )
    
    if n_kv_heads is None and "num_attention_heads" in cfg:
        n_kv_heads = cfg.get("num_attention_heads")
        
    num_attention_heads = cfg.get("num_attention_heads") or cfg.get("n_head")
    hidden_size = cfg.get("hidden_size") or cfg.get("n_embd")
    
    head_dim = cfg.get("head_dim")
    if head_dim is None and hidden_size and num_attention_heads:
        head_dim = hidden_size // num_attention_heads
    elif head_dim is None and existing:
        head_dim = existing.get("head_dim")
        
    context_train = (
        cfg.get("max_position_embeddings")
        or cfg.get("context_length")
        or cfg.get("seq_length")
        or cfg.get("max_sequence_length")
        or (existing.get("context_train") if existing else None)
    )
    
    active_params_b = None
    num_experts = cfg.get("num_local_experts") or cfg.get("n_routed_experts") or cfg.get("num_experts")
    num_active_experts = cfg.get("num_experts_per_tok") or cfg.get("num_active_experts")
    
    if num_experts and num_active_experts:
        if existing and existing.get("active_params_b"):
            active_params_b = existing.get("active_params_b")
            
    res = {}
    if n_layers is not None: res["n_layers"] = int(n_layers)
    if n_kv_heads is not None: res["n_kv_heads"] = int(n_kv_heads)
    if head_dim is not None: res["head_dim"] = int(head_dim)
    if context_train is not None: res["context_train"] = int(context_train)
    if active_params_b is not None: res["active_params_b"] = float(active_params_b)
    
    return res

def validate_entry(entry):
    errors = []
    pfx = f"Model '{entry.get('id', 'unknown')}'"
    
    if not entry.get("id"): errors.append(f"{pfx}: missing id")
    if not entry.get("repo_id"): errors.append(f"{pfx}: missing repo_id")
    if not entry.get("filename"): errors.append(f"{pfx}: missing filename")
    if not entry.get("n_layers") or entry["n_layers"] <= 0: errors.append(f"{pfx}: invalid n_layers ({entry.get('n_layers')})")
    if not entry.get("n_kv_heads") or entry["n_kv_heads"] <= 0: errors.append(f"{pfx}: invalid n_kv_heads ({entry.get('n_kv_heads')})")
    if not entry.get("head_dim") or entry["head_dim"] <= 0: errors.append(f"{pfx}: invalid head_dim ({entry.get('head_dim')})")
    if not entry.get("context_train") or entry["context_train"] <= 0: errors.append(f"{pfx}: invalid context_train ({entry.get('context_train')})")
    if not entry.get("file_size_bytes") or entry["file_size_bytes"] <= 0: errors.append(f"{pfx}: invalid file_size_bytes ({entry.get('file_size_bytes')})")
    
    sha = entry.get("sha256", "")
    if not sha or len(sha) != 64 or not re.match(r"^[0-9a-fA-F]{64}$", sha):
        errors.append(f"{pfx}: invalid sha256 ({sha})")
        
    return errors

def main():
    verify_only = "--verify-only" in sys.argv
    online_check = "--online" in sys.argv or "--fetch" in sys.argv
    token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGINGFACE_HUB_TOKEN")
    
    if not CATALOG_PATH.exists():
        print(f"Error: Catalog file not found at {CATALOG_PATH}", file=sys.stderr)
        sys.exit(1)
        
    with open(CATALOG_PATH, "r", encoding="utf-8") as f:
        catalog = json.load(f)
        
    print(f"Loaded {len(catalog)} models from {CATALOG_PATH}")
    
    all_errors = []
    updated_catalog = []
    
    for idx, entry in enumerate(catalog):
        entry_id = entry.get("id", f"entry_{idx}")
        repo_id = entry.get("repo_id")
        filename = entry.get("filename")
        
        print(f"[{idx+1}/{len(catalog)}] Checking {entry_id}...", end=" ", flush=True)
        
        if online_check:
            tree_meta = fetch_file_lfs_metadata(repo_id, filename, token=token)
            meta = head_file_metadata(repo_id, filename, token=token)
            if meta["status"] in (200, 302):
                if tree_meta.get("size_bytes", 0) > 0:
                    entry["file_size_bytes"] = tree_meta["size_bytes"]
                elif meta["size_bytes"] > 0:
                    entry["file_size_bytes"] = meta["size_bytes"]

                if tree_meta.get("sha256") and len(tree_meta["sha256"]) == 64:
                    entry["sha256"] = tree_meta["sha256"]

                entry["gated"] = False
                print(f"OK (size: {entry['file_size_bytes'] / (1024*1024):.1f} MB)")
            elif meta.get("gated"):
                entry["gated"] = True
                print("GATED (token required)")
            else:
                print(f"FAILED: {meta.get('error', 'status ' + str(meta['status']))}")
                if meta["status"] == 404:
                    all_errors.append(f"Model {entry_id} returned 404 at {meta['url']}")
            
            cfg = fetch_config_json(repo_id, token=token)
            if cfg:
                arch_params = extract_arch_params(cfg, existing=entry)
                for k, v in arch_params.items():
                    if v is not None:
                        entry[k] = v
        else:
            print("OK (cached)")
            
        # Enrich model with benchmark scores (SWE-bench, LiveCodeBench, MMLU-Pro, Arena Elo)
        if online_check or not entry.get("benchmarks"):
            base_repo = BASE_MODEL_MAP.get(repo_id, repo_id)
            bm = get_model_benchmarks(
                entry_id,
                base_repo_id=base_repo,
                live=online_check,
                token=token,
                existing=entry.get("benchmarks")
            )
            if bm:
                entry["benchmarks"] = bm

        errs = validate_entry(entry)
        if errs:
            all_errors.extend(errs)
            
        updated_catalog.append(entry)
        
    if all_errors:
        print(f"\nCatalog validation encountered {len(all_errors)} errors:", file=sys.stderr)
        for err in all_errors:
            print(f"  - {err}", file=sys.stderr)
        if verify_only or online_check:
            sys.exit(1)
            
    if not verify_only:
        with open(CATALOG_PATH, "w", encoding="utf-8") as f:
            json.dump(updated_catalog, f, indent=2)
            f.write("\n")
        print(f"\nSuccessfully verified and written {len(updated_catalog)} models in {CATALOG_PATH}")

if __name__ == "__main__":
    main()
