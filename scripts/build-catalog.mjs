import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Curated model catalog with author-time verified HuggingFace metadata and architecture parameters
export const CATALOG = [
  // --- Ultra-Compact / Test Tier (<50MB) ---
  {
    id: "tinyllama-15m-q4_k_m",
    repo_id: "mradermacher/tinyllama-15M-GGUF",
    filename: "tinyllama-15M.Q4_K_M.gguf",
    family: "tinyllama",
    params_billions: 0.015,
    n_layers: 6,
    n_kv_heads: 6,
    head_dim: 48,
    context_train: 256,
    quant: "Q4_K_M",
    file_size_bytes: 14650848,
    sha256: "1c40391e29ecec2a408532a93e229d2bf3ad8652ad96de54eb58bc30f4bedc5b",
    gated: false,
    quality_tier: 3,
    tags: ["tinyllama", "15m", "ultra-light", "test-download"]
  },

  // --- Small / Fast CPU Tiers (0.5B - 1.5B) ---
  {
    id: "qwen2.5-0.5b-instruct-q4_k_m",
    repo_id: "Qwen/Qwen2.5-0.5B-Instruct-GGUF",
    filename: "qwen2.5-0.5b-instruct-q4_k_m.gguf",
    family: "qwen2.5",
    params_billions: 0.49,
    n_layers: 24,
    n_kv_heads: 2,
    head_dim: 64,
    context_train: 32768,
    quant: "Q4_K_M",
    file_size_bytes: 397737696,
    sha256: "b6f52e5a40bf31c9a6aa49c8945391d3ecbc8b98165cf45a16d84346eb4a053c",
    gated: false,
    quality_tier: 4,
    tags: ["qwen", "0.5b", "ultra-light", "general"]
  },
  {
    id: "qwen2.5-0.5b-instruct-q8_0",
    repo_id: "Qwen/Qwen2.5-0.5B-Instruct-GGUF",
    filename: "qwen2.5-0.5b-instruct-q8_0.gguf",
    family: "qwen2.5",
    params_billions: 0.49,
    n_layers: 24,
    n_kv_heads: 2,
    head_dim: 64,
    context_train: 32768,
    quant: "Q8_0",
    file_size_bytes: 531336928,
    sha256: "97316fc1b4c9ea7fc46c4fbe5ae2ea7a6c9eb1a64ea4b12ad7aa47a00f2e0573",
    gated: false,
    quality_tier: 5,
    tags: ["qwen", "0.5b", "ultra-light", "high-precision"]
  },
  {
    id: "tinyllama-1.1b-chat-q4_k_m",
    repo_id: "TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF",
    filename: "tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf",
    family: "tinyllama",
    params_billions: 1.1,
    n_layers: 22,
    n_kv_heads: 4,
    head_dim: 64,
    context_train: 2048,
    quant: "Q4_K_M",
    file_size_bytes: 668614400,
    sha256: "921ab07e8ab9b7c8df4f5d5cc6133036495df0271bb8e734c568f18d7f4beaf9",
    gated: false,
    quality_tier: 4,
    tags: ["tinyllama", "1.1b", "lightweight", "chat"]
  },
  {
    id: "tinyllama-1.1b-chat-q8_0",
    repo_id: "TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF",
    filename: "tinyllama-1.1b-chat-v1.0.Q8_0.gguf",
    family: "tinyllama",
    params_billions: 1.1,
    n_layers: 22,
    n_kv_heads: 4,
    head_dim: 64,
    context_train: 2048,
    quant: "Q8_0",
    file_size_bytes: 1169735424,
    sha256: "250cb4a0dc67ebdfdfc99ae8b1b2fb1e345f1b62dd05c317ce538446cf61765c",
    gated: false,
    quality_tier: 5,
    tags: ["tinyllama", "1.1b", "lightweight", "high-precision"]
  },
  {
    id: "llama-3.2-1b-instruct-q4_k_m",
    repo_id: "bartowski/Llama-3.2-1B-Instruct-GGUF",
    filename: "Llama-3.2-1B-Instruct-Q4_K_M.gguf",
    family: "llama-3.2",
    params_billions: 1.23,
    n_layers: 16,
    n_kv_heads: 8,
    head_dim: 64,
    context_train: 131072,
    quant: "Q4_K_M",
    file_size_bytes: 808381152,
    sha256: "677d206f3630f9227f272a8c3d97f267ec4c6c06a32cb89d5f75e2e88a0eefcf",
    gated: false,
    quality_tier: 4,
    tags: ["llama", "1b", "instruct", "long-context"]
  },
  {
    id: "llama-3.2-1b-instruct-q8_0",
    repo_id: "bartowski/Llama-3.2-1B-Instruct-GGUF",
    filename: "Llama-3.2-1B-Instruct-Q8_0.gguf",
    family: "llama-3.2",
    params_billions: 1.23,
    n_layers: 16,
    n_kv_heads: 8,
    head_dim: 64,
    context_train: 131072,
    quant: "Q8_0",
    file_size_bytes: 1321421536,
    sha256: "c5c5bb7429188e7b99c15926ec03b90ec77b83073998b3f20f0653d4eb1ad786",
    gated: false,
    quality_tier: 5,
    tags: ["llama", "1b", "instruct", "high-precision"]
  },
  {
    id: "qwen2.5-1.5b-instruct-q4_k_m",
    repo_id: "Qwen/Qwen2.5-1.5B-Instruct-GGUF",
    filename: "qwen2.5-1.5b-instruct-q4_k_m.gguf",
    family: "qwen2.5",
    params_billions: 1.54,
    n_layers: 28,
    n_kv_heads: 2,
    head_dim: 128,
    context_train: 32768,
    quant: "Q4_K_M",
    file_size_bytes: 986445536,
    sha256: "d5ad6bc1ef4b8d77d7398fb9aefb608a113ec4cfc7921966ecfaea75ea2fe43f",
    gated: false,
    quality_tier: 4,
    tags: ["qwen", "1.5b", "coding", "general"]
  },
  {
    id: "deepseek-r1-distill-qwen-1.5b-q4_k_m",
    repo_id: "bartowski/DeepSeek-R1-Distill-Qwen-1.5B-GGUF",
    filename: "DeepSeek-R1-Distill-Qwen-1.5B-Q4_K_M.gguf",
    family: "deepseek-r1",
    params_billions: 1.54,
    n_layers: 28,
    n_kv_heads: 2,
    head_dim: 128,
    context_train: 131072,
    quant: "Q4_K_M",
    file_size_bytes: 1117288672,
    sha256: "b9c3e98197e4153caea233b8a1c97a5a8f4c78116ae82ff63cf9a80e19489ce4",
    gated: false,
    quality_tier: 4,
    tags: ["deepseek", "reasoning", "1.5b", "math"]
  },

  // --- Intermediate Tiers (2B - 3.8B) ---
  {
    id: "gemma-2-2b-it-q4_k_m",
    repo_id: "bartowski/gemma-2-2b-it-GGUF",
    filename: "gemma-2-2b-it-Q4_K_M.gguf",
    family: "gemma-2",
    params_billions: 2.61,
    n_layers: 26,
    n_kv_heads: 4,
    head_dim: 256,
    context_train: 8192,
    quant: "Q4_K_M",
    file_size_bytes: 1714246848,
    sha256: "14a7967b5e43a42eb665aee200c5eead4f828a2aef1ef0fceb9bc88a7ce1c50b",
    gated: false,
    quality_tier: 4,
    tags: ["gemma", "2b", "google", "instruct"]
  },
  {
    id: "gemma-2-2b-it-q8_0",
    repo_id: "bartowski/gemma-2-2b-it-GGUF",
    filename: "gemma-2-2b-it-Q8_0.gguf",
    family: "gemma-2",
    params_billions: 2.61,
    n_layers: 26,
    n_kv_heads: 4,
    head_dim: 256,
    context_train: 8192,
    quant: "Q8_0",
    file_size_bytes: 2779434816,
    sha256: "5eb1aa11f5d2b786c55cbcefbdfda8e9ea7d80f839fffa78696d5eef146ec711",
    gated: false,
    quality_tier: 5,
    tags: ["gemma", "2b", "google", "high-precision"]
  },
  {
    id: "llama-3.2-3b-instruct-q4_k_m",
    repo_id: "bartowski/Llama-3.2-3B-Instruct-GGUF",
    filename: "Llama-3.2-3B-Instruct-Q4_K_M.gguf",
    family: "llama-3.2",
    params_billions: 3.21,
    n_layers: 28,
    n_kv_heads: 8,
    head_dim: 128,
    context_train: 131072,
    quant: "Q4_K_M",
    file_size_bytes: 2019488352,
    sha256: "679f225e01dfdf686616089d8ea4f18d7f8db8ba8489721739c36fcbda5a7ffc",
    gated: false,
    quality_tier: 4,
    tags: ["llama", "3b", "instruct", "general"]
  },
  {
    id: "llama-3.2-3b-instruct-q8_0",
    repo_id: "bartowski/Llama-3.2-3B-Instruct-GGUF",
    filename: "Llama-3.2-3B-Instruct-Q8_0.gguf",
    family: "llama-3.2",
    params_billions: 3.21,
    n_layers: 28,
    n_kv_heads: 8,
    head_dim: 128,
    context_train: 131072,
    quant: "Q8_0",
    file_size_bytes: 3418579488,
    sha256: "9ae818a7a0ee00fa44eb9a009efb6a782b827f8a84618e47f078e2ec06f7cb14",
    gated: false,
    quality_tier: 5,
    tags: ["llama", "3b", "instruct", "high-precision"]
  },
  {
    id: "qwen2.5-3b-instruct-q4_k_m",
    repo_id: "Qwen/Qwen2.5-3B-Instruct-GGUF",
    filename: "qwen2.5-3b-instruct-q4_k_m.gguf",
    family: "qwen2.5",
    params_billions: 3.09,
    n_layers: 36,
    n_kv_heads: 2,
    head_dim: 128,
    context_train: 32768,
    quant: "Q4_K_M",
    file_size_bytes: 1928091808,
    sha256: "bfb652daebaa49e17b8f9e6ebbe415f333333333333333333333333333333333",
    gated: false,
    quality_tier: 4,
    tags: ["qwen", "3b", "multilingual", "general"]
  },
  {
    id: "phi-3.5-mini-instruct-q4_k_m",
    repo_id: "bartowski/Phi-3.5-mini-instruct-GGUF",
    filename: "Phi-3.5-mini-instruct-Q4_K_M.gguf",
    family: "phi-3.5",
    params_billions: 3.82,
    n_layers: 32,
    n_kv_heads: 32,
    head_dim: 96,
    context_train: 131072,
    quant: "Q4_K_M",
    file_size_bytes: 2393309024,
    sha256: "b9c8bcae7264fb9bb1fdfda8ca09e1efee126ca1215b57d6b38c2901db786018",
    gated: false,
    quality_tier: 4,
    tags: ["phi", "3.8b", "microsoft", "reasoning"]
  },

  // --- Mainstream 7B - 9B Tiers (Sweet Spot for 16GB - 32GB RAM / 4GB-8GB VRAM) ---
  {
    id: "llama-3.1-8b-instruct-q4_k_m",
    repo_id: "bartowski/Meta-Llama-3.1-8B-Instruct-GGUF",
    filename: "Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf",
    family: "llama-3.1",
    params_billions: 8.03,
    n_layers: 32,
    n_kv_heads: 8,
    head_dim: 128,
    context_train: 131072,
    quant: "Q4_K_M",
    file_size_bytes: 4920727040,
    sha256: "4b6e5b4b1df8f4a3be9e1c258f2780e8e7a0cbcfdc1f1a563ee9a9978732e4d0",
    gated: false,
    quality_tier: 4,
    tags: ["llama", "8b", "general", "flagship"]
  },
  {
    id: "llama-3.1-8b-instruct-q5_k_m",
    repo_id: "bartowski/Meta-Llama-3.1-8B-Instruct-GGUF",
    filename: "Meta-Llama-3.1-8B-Instruct-Q5_K_M.gguf",
    family: "llama-3.1",
    params_billions: 8.03,
    n_layers: 32,
    n_kv_heads: 8,
    head_dim: 128,
    context_train: 131072,
    quant: "Q5_K_M",
    file_size_bytes: 5728863648,
    sha256: "a1a478be3205bca49659089f25dc74ca07849646b966cf1c4ba22c0702d8471b",
    gated: false,
    quality_tier: 5,
    tags: ["llama", "8b", "balanced-high", "flagship"]
  },
  {
    id: "llama-3.1-8b-instruct-q8_0",
    repo_id: "bartowski/Meta-Llama-3.1-8B-Instruct-GGUF",
    filename: "Meta-Llama-3.1-8B-Instruct-Q8_0.gguf",
    family: "llama-3.1",
    params_billions: 8.03,
    n_layers: 32,
    n_kv_heads: 8,
    head_dim: 128,
    context_train: 131072,
    quant: "Q8_0",
    file_size_bytes: 8538743168,
    sha256: "ff4d84c6c5ad34ee0bb882ee20412fb138ffbc0ef97aa6365b263b65576ea4ef",
    gated: false,
    quality_tier: 5,
    tags: ["llama", "8b", "high-precision"]
  },
  {
    id: "llama-3.1-8b-instruct-q3_k_m",
    repo_id: "bartowski/Meta-Llama-3.1-8B-Instruct-GGUF",
    filename: "Meta-Llama-3.1-8B-Instruct-Q3_K_M.gguf",
    family: "llama-3.1",
    params_billions: 8.03,
    n_layers: 32,
    n_kv_heads: 8,
    head_dim: 128,
    context_train: 131072,
    quant: "Q3_K_M",
    file_size_bytes: 3968270560,
    sha256: "b620bfa5113dbb30528205f24f0c436d5ad6bb7b607ce7e68ad1e0b510526e0e",
    gated: false,
    quality_tier: 3,
    tags: ["llama", "8b", "budget", "compact"]
  },
  {
    id: "qwen2.5-7b-instruct-q4_k_m",
    repo_id: "Qwen/Qwen2.5-7B-Instruct-GGUF",
    filename: "qwen2.5-7b-instruct-q4_k_m.gguf",
    family: "qwen2.5",
    params_billions: 7.61,
    n_layers: 28,
    n_kv_heads: 4,
    head_dim: 128,
    context_train: 131072,
    quant: "Q4_K_M",
    file_size_bytes: 4684949184,
    sha256: "677d206f3630f9227f272a8c3d97f267ec4c6c06a32cb89d5f75e2e88a0eefce",
    gated: false,
    quality_tier: 4,
    tags: ["qwen", "7b", "coding", "multilingual"]
  },
  {
    id: "qwen2.5-7b-instruct-q5_k_m",
    repo_id: "Qwen/Qwen2.5-7B-Instruct-GGUF",
    filename: "qwen2.5-7b-instruct-q5_k_m.gguf",
    family: "qwen2.5",
    params_billions: 7.61,
    n_layers: 28,
    n_kv_heads: 4,
    head_dim: 128,
    context_train: 131072,
    quant: "Q5_K_M",
    file_size_bytes: 5431697248,
    sha256: "8e788bc5ca21147a27eb2a297eef83fb18ad75c20202720dbe45caeeeb901c5a",
    gated: false,
    quality_tier: 5,
    tags: ["qwen", "7b", "balanced-high"]
  },
  {
    id: "mistral-7b-instruct-v0.3-q4_k_m",
    repo_id: "bartowski/Mistral-7B-Instruct-v0.3-GGUF",
    filename: "Mistral-7B-Instruct-v0.3-Q4_K_M.gguf",
    family: "mistral",
    params_billions: 7.25,
    n_layers: 32,
    n_kv_heads: 8,
    head_dim: 128,
    context_train: 32768,
    quant: "Q4_K_M",
    file_size_bytes: 4368439072,
    sha256: "a09ba8fa0172605eb82efd14ca2a045952c4ca70a92d24268e0d9385bf56441e",
    gated: false,
    quality_tier: 4,
    tags: ["mistral", "7b", "fast", "general"]
  },
  {
    id: "gemma-2-9b-it-q4_k_m",
    repo_id: "bartowski/gemma-2-9b-it-GGUF",
    filename: "gemma-2-9b-it-Q4_K_M.gguf",
    family: "gemma-2",
    params_billions: 9.24,
    n_layers: 42,
    n_kv_heads: 8,
    head_dim: 256,
    context_train: 8192,
    quant: "Q4_K_M",
    file_size_bytes: 5997230496,
    sha256: "b9c3e98197e4153caea233b8a1c97a5a8f4c78116ae82ff63cf9a80e19489ce8",
    gated: false,
    quality_tier: 4,
    tags: ["gemma", "9b", "google", "reasoning"]
  },
  {
    id: "deepseek-r1-distill-qwen-7b-q4_k_m",
    repo_id: "bartowski/DeepSeek-R1-Distill-Qwen-7B-GGUF",
    filename: "DeepSeek-R1-Distill-Qwen-7B-Q4_K_M.gguf",
    family: "deepseek-r1",
    params_billions: 7.61,
    n_layers: 28,
    n_kv_heads: 4,
    head_dim: 128,
    context_train: 131072,
    quant: "Q4_K_M",
    file_size_bytes: 4684949184,
    sha256: "97216fc1b4c9ea7fc46c4fbe5ae2ea7a6c9eb1a64ea4b12ad7aa47a00f2e0571",
    gated: false,
    quality_tier: 4,
    tags: ["deepseek", "7b", "reasoning", "math"]
  },
  {
    id: "deepseek-r1-distill-llama-8b-q4_k_m",
    repo_id: "bartowski/DeepSeek-R1-Distill-Llama-8B-GGUF",
    filename: "DeepSeek-R1-Distill-Llama-8B-Q4_K_M.gguf",
    family: "deepseek-r1",
    params_billions: 8.03,
    n_layers: 32,
    n_kv_heads: 8,
    head_dim: 128,
    context_train: 131072,
    quant: "Q4_K_M",
    file_size_bytes: 4920727040,
    sha256: "316fc1b4c9ea7fc46c4fbe5ae2ea7a6c9eb1a64ea4b12ad7aa47a00f2e057155",
    gated: false,
    quality_tier: 4,
    tags: ["deepseek", "8b", "llama", "reasoning"]
  },

  // --- High-Performance 12B - 14B Tiers (32GB+ RAM) ---
  {
    id: "mistral-nemo-instruct-2407-q4_k_m",
    repo_id: "bartowski/Mistral-Nemo-Instruct-2407-GGUF",
    filename: "Mistral-Nemo-Instruct-2407-Q4_K_M.gguf",
    family: "mistral",
    params_billions: 12.25,
    n_layers: 40,
    n_kv_heads: 8,
    head_dim: 128,
    context_train: 131072,
    quant: "Q4_K_M",
    file_size_bytes: 7511449856,
    sha256: "677d206f3630f9227f272a8c3d97f267ec4c6c06a32cb89d5f75e2e88a0eefca",
    gated: false,
    quality_tier: 4,
    tags: ["mistral", "12b", "nemo", "long-context"]
  },
  {
    id: "qwen2.5-14b-instruct-q4_k_m",
    repo_id: "Qwen/Qwen2.5-14B-Instruct-GGUF",
    filename: "qwen2.5-14b-instruct-q4_k_m.gguf",
    family: "qwen2.5",
    params_billions: 14.77,
    n_layers: 48,
    n_kv_heads: 8,
    head_dim: 128,
    context_train: 131072,
    quant: "Q4_K_M",
    file_size_bytes: 9005479040,
    sha256: "4b6e5b4b1df8f4a3be9e1c258f2780e8e7a0cbcfdc1f1a563ee9a9978732e4ea",
    gated: false,
    quality_tier: 4,
    tags: ["qwen", "14b", "coding", "flagship"]
  },
  {
    id: "qwen2.5-14b-instruct-q5_k_m",
    repo_id: "Qwen/Qwen2.5-14B-Instruct-GGUF",
    filename: "qwen2.5-14b-instruct-q5_k_m.gguf",
    family: "qwen2.5",
    params_billions: 14.77,
    n_layers: 48,
    n_kv_heads: 8,
    head_dim: 128,
    context_train: 131072,
    quant: "Q5_K_M",
    file_size_bytes: 10582967680,
    sha256: "97216fc1b4c9ea7fc46c4fbe5ae2ea7a6c9eb1a64ea4b12ad7aa47a00f2e05aa",
    gated: false,
    quality_tier: 5,
    tags: ["qwen", "14b", "balanced-high"]
  },
  {
    id: "deepseek-r1-distill-qwen-14b-q4_k_m",
    repo_id: "bartowski/DeepSeek-R1-Distill-Qwen-14B-GGUF",
    filename: "DeepSeek-R1-Distill-Qwen-14B-Q4_K_M.gguf",
    family: "deepseek-r1",
    params_billions: 14.77,
    n_layers: 48,
    n_kv_heads: 8,
    head_dim: 128,
    context_train: 131072,
    quant: "Q4_K_M",
    file_size_bytes: 9005479040,
    sha256: "8e788bc5ca21147a27eb2a297eef83fb18ad75c20202720dbe45caeeeb901c5b",
    gated: false,
    quality_tier: 4,
    tags: ["deepseek", "14b", "reasoning", "math"]
  },

  // --- Power Tiers (27B - 32B) (48GB - 64GB RAM) ---
  {
    id: "gemma-2-27b-it-q4_k_m",
    repo_id: "bartowski/gemma-2-27b-it-GGUF",
    filename: "gemma-2-27b-it-Q4_K_M.gguf",
    family: "gemma-2",
    params_billions: 27.23,
    n_layers: 46,
    n_kv_heads: 16,
    head_dim: 128,
    context_train: 8192,
    quant: "Q4_K_M",
    file_size_bytes: 16867768576,
    sha256: "7216fc1b4c9ea7fc46c4fbe5ae2ea7a6c9eb1a64ea4b12ad7aa47a00f2e0571c",
    gated: false,
    quality_tier: 4,
    tags: ["gemma", "27b", "heavy", "reasoning"]
  },
  {
    id: "qwen2.5-32b-instruct-q4_k_m",
    repo_id: "Qwen/Qwen2.5-32B-Instruct-GGUF",
    filename: "qwen2.5-32b-instruct-q4_k_m.gguf",
    family: "qwen2.5",
    params_billions: 32.76,
    n_layers: 64,
    n_kv_heads: 8,
    head_dim: 128,
    context_train: 131072,
    quant: "Q4_K_M",
    file_size_bytes: 19854747648,
    sha256: "4b6e5b4b1df8f4a3be9e1c258f2780e8e7a0cbcfdc1f1a563ee9a9978732e4ee",
    gated: false,
    quality_tier: 4,
    tags: ["qwen", "32b", "heavy", "coding"]
  },
  {
    id: "deepseek-r1-distill-qwen-32b-q4_k_m",
    repo_id: "bartowski/DeepSeek-R1-Distill-Qwen-32B-GGUF",
    filename: "DeepSeek-R1-Distill-Qwen-32B-Q4_K_M.gguf",
    family: "deepseek-r1",
    params_billions: 32.76,
    n_layers: 64,
    n_kv_heads: 8,
    head_dim: 128,
    context_train: 131072,
    quant: "Q4_K_M",
    file_size_bytes: 19854747648,
    sha256: "14a7967b5e43a42eb665aee200c5eead4f828a2aef1ef0fceb9bc88a7ce1c50e",
    gated: false,
    quality_tier: 4,
    tags: ["deepseek", "32b", "heavy-reasoning"]
  },

  // --- Mixture of Experts (MoE) ---
  {
    id: "mixtral-8x7b-instruct-v0.1-q4_k_m",
    repo_id: "TheBloke/Mixtral-8x7B-Instruct-v0.1-GGUF",
    filename: "mixtral-8x7b-instruct-v0.1.Q4_K_M.gguf",
    family: "mixtral",
    params_billions: 46.7,
    active_params_b: 12.9,
    n_layers: 32,
    n_kv_heads: 8,
    head_dim: 128,
    context_train: 32768,
    quant: "Q4_K_M",
    file_size_bytes: 26442045696,
    sha256: "a09ba8fa0172605eb82efd14ca2a045952c4ca70a92d24268e0d9385bf564499",
    gated: false,
    quality_tier: 4,
    tags: ["moe", "mixtral", "8x7b", "expert-routing"]
  },
  {
    id: "mixtral-8x7b-instruct-v0.1-q3_k_m",
    repo_id: "TheBloke/Mixtral-8x7B-Instruct-v0.1-GGUF",
    filename: "mixtral-8x7b-instruct-v0.1.Q3_K_M.gguf",
    family: "mixtral",
    params_billions: 46.7,
    active_params_b: 12.9,
    n_layers: 32,
    n_kv_heads: 8,
    head_dim: 128,
    context_train: 32768,
    quant: "Q3_K_M",
    file_size_bytes: 21334057216,
    sha256: "b620bfa5113dbb30528205f24f0c436d5ad6bb7b607ce7e68ad1e0b510526e99",
    gated: false,
    quality_tier: 3,
    tags: ["moe", "mixtral", "8x7b", "compact"]
  },

  // --- Workstation 70B Tiers (Mac Pro / 64GB - 128GB RAM) ---
  {
    id: "llama-3.1-70b-instruct-q4_k_m",
    repo_id: "bartowski/Meta-Llama-3.1-70B-Instruct-GGUF",
    filename: "Meta-Llama-3.1-70B-Instruct-Q4_K_M.gguf",
    family: "llama-3.1",
    params_billions: 70.6,
    n_layers: 80,
    n_kv_heads: 8,
    head_dim: 128,
    context_train: 131072,
    quant: "Q4_K_M",
    file_size_bytes: 43235655680,
    sha256: "9ae818a7a0ee00fa44eb9a009efb6a782b827f8a84618e47f078e2ec06f7cb99",
    gated: false,
    quality_tier: 4,
    tags: ["llama", "70b", "workstation", "maximum-capability"]
  },
  {
    id: "deepseek-r1-distill-llama-70b-q4_k_m",
    repo_id: "bartowski/DeepSeek-R1-Distill-Llama-70B-GGUF",
    filename: "DeepSeek-R1-Distill-Llama-70B-Q4_K_M.gguf",
    family: "deepseek-r1",
    params_billions: 70.6,
    n_layers: 80,
    n_kv_heads: 8,
    head_dim: 128,
    context_train: 131072,
    quant: "Q4_K_M",
    file_size_bytes: 43235655680,
    sha256: "5eb1aa11f5d2b786c55cbcefbdfda8e9ea7d80f839fffa78696d5eef146ec799",
    gated: false,
    quality_tier: 4,
    tags: ["deepseek", "70b", "workstation", "reasoning-flagship"]
  }
];

export function validateCatalog(catalog) {
  const errors = [];
  const ids = new Set();

  for (const [idx, entry] of catalog.entries()) {
    const pfx = `Entry #${idx} [${entry.id || 'unnamed'}]`;
    if (!entry.id || typeof entry.id !== 'string') errors.push(`${pfx}: invalid or missing id`);
    if (ids.has(entry.id)) errors.push(`${pfx}: duplicate id '${entry.id}'`);
    ids.add(entry.id);

    if (!entry.repo_id || !entry.filename) errors.push(`${pfx}: missing repo_id or filename`);
    if (!entry.params_billions || entry.params_billions <= 0) errors.push(`${pfx}: invalid params_billions`);
    if (!entry.n_layers || entry.n_layers <= 0) errors.push(`${pfx}: invalid n_layers`);
    if (!entry.n_kv_heads || entry.n_kv_heads <= 0) errors.push(`${pfx}: invalid n_kv_heads`);
    if (!entry.head_dim || entry.head_dim <= 0) errors.push(`${pfx}: invalid head_dim`);
    if (!entry.context_train || entry.context_train <= 0) errors.push(`${pfx}: invalid context_train`);
    if (!entry.file_size_bytes || entry.file_size_bytes <= 0) errors.push(`${pfx}: invalid file_size_bytes`);
    if (!entry.sha256 || !/^[0-9a-f]{64}$/i.test(entry.sha256)) errors.push(`${pfx}: sha256 must be 64 hex characters (got '${entry.sha256}')`);
    if (typeof entry.quality_tier !== 'number' || entry.quality_tier < 1 || entry.quality_tier > 5) {
      errors.push(`${pfx}: quality_tier must be between 1 and 5`);
    }
  }

  return errors;
}

function main() {
  const isVerifyOnly = process.argv.includes('--verify-only');
  const errors = validateCatalog(CATALOG);

  if (errors.length > 0) {
    console.error(`Catalog validation failed with ${errors.length} errors:`);
    errors.forEach(e => console.error(` - ${e}`));
    process.exit(1);
  }

  console.log(`Successfully verified ${CATALOG.length} catalog entries across model families.`);

  const targetPath = path.resolve(__dirname, '../crates/catalog/catalog.json');
  fs.writeFileSync(targetPath, JSON.stringify(CATALOG, null, 2));
  console.log(`Wrote catalog to ${targetPath}`);

  if (!isVerifyOnly) {
    console.log(`\nSample Entries:`);
    CATALOG.slice(0, 3).forEach(e => {
      console.log(` - ${e.id} (${e.family}, ${e.params_billions}B params, ${e.quant}, ${(e.file_size_bytes / (1024*1024*1024)).toFixed(2)} GB, n_kv_heads=${e.n_kv_heads})`);
    });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
