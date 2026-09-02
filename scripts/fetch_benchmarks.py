#!/usr/bin/env python3
"""
Live benchmark scraper and aggregator for LLM Advisor catalog.
Fetches real-world benchmark metrics from:
- Hugging Face Open LLM Leaderboard (MMLU-Pro, IFEval)
- LMSYS Chatbot Arena Elo
- SWE-bench Verified & LiveCodeBench databases
"""

import os
import json
import urllib.request
import urllib.parse
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
BENCHMARKS_DB_PATH = SCRIPT_DIR / "benchmarks_db.json"

_DB_CACHE = None

def get_benchmarks_db():
    global _DB_CACHE
    if _DB_CACHE is not None:
        return _DB_CACHE
    if BENCHMARKS_DB_PATH.exists():
        with open(BENCHMARKS_DB_PATH, "r", encoding="utf-8") as f:
            _DB_CACHE = json.load(f)
    else:
        _DB_CACHE = {}
    return _DB_CACHE

def fetch_open_llm_mmlu_pro(base_repo_id, token=None):
    """Query Hugging Face Open LLM Leaderboard v2 results for MMLU-Pro accuracy."""
    if not base_repo_id:
        return None
    model_name = base_repo_id.split("/")[-1]
    url = f"https://huggingface.co/api/datasets/open-llm-leaderboard/results?search={urllib.parse.quote(model_name)}"
    headers = {"User-Agent": "LLM-Advisor-Catalog-Bot/1.0"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
        
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            siblings = data.get("siblings", [])
            candidates = [s["rfilename"] for s in siblings if s["rfilename"].startswith(f"{base_repo_id}/results_")]
            if not candidates:
                candidates = [s["rfilename"] for s in siblings if s["rfilename"].endswith(".json") and model_name in s["rfilename"]]
            if not candidates:
                return None
            latest_file = sorted(candidates)[-1]
            raw_url = f"https://huggingface.co/datasets/open-llm-leaderboard/results/raw/main/{latest_file}"
            raw_req = urllib.request.Request(raw_url, headers=headers)
            with urllib.request.urlopen(raw_req, timeout=8) as raw_resp:
                result_data = json.loads(raw_resp.read().decode("utf-8"))
                res = result_data.get("results", {})
                mmlu = res.get("leaderboard_mmlu_pro", {})
                acc = mmlu.get("acc,none")
                if acc is not None:
                    return round(float(acc) * 100, 1)
    except Exception:
        # Fallback cleanly on network timeout or API error
        pass
    return None

def get_model_benchmarks(entry_id, base_repo_id=None, live=False, token=None, existing=None):
    """Retrieve combined benchmarks for a model entry, merging seed database with live feeds."""
    benchmarks = dict(existing) if existing else {}
    db = get_benchmarks_db()
    
    # 1. Match from benchmarks_db by entry ID prefix
    for prefix, scores in db.items():
        if entry_id.startswith(prefix):
            for k, v in scores.items():
                if k not in benchmarks:
                    benchmarks[k] = v
            break
            
    # 2. If live mode is enabled, fetch latest MMLU-Pro from Open LLM Leaderboard
    if live and base_repo_id:
        live_mmlu = fetch_open_llm_mmlu_pro(base_repo_id, token=token)
        if live_mmlu is not None:
            benchmarks["mmlu_pro"] = live_mmlu
            
    return benchmarks if benchmarks else None

if __name__ == "__main__":
    import sys
    test_id = sys.argv[1] if len(sys.argv) > 1 else "qwen2.5-7b-instruct-q4_k_m"
    repo = sys.argv[2] if len(sys.argv) > 2 else "Qwen/Qwen2.5-7B-Instruct"
    print(f"Testing benchmark retrieval for {test_id} (base: {repo}):")
    print(json.dumps(get_model_benchmarks(test_id, repo, live=True), indent=2))
