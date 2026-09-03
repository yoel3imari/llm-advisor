# LLM Advisor — Inference Streaming Studio Demo

A lightweight, ChatGPT-like web interface built with **HTML5, Tailwind CSS, and vanilla JavaScript** designed to test and benchmark Server-Sent Events (SSE) inference token streaming against the LLM Advisor Axum reverse proxy (`http://127.0.0.1:13370`) or any OpenAI-compatible inference server.

---

## 🚀 Quick Start

### Option 1: Serve with the runner script
```bash
./demo/serve.sh
# Open http://127.0.0.1:3333 in your browser
```

### Option 2: Run via npm / bun
```bash
npm run demo
```

### Option 3: Open directly in your browser
Simply open `demo/index.html` directly in Google Chrome, Firefox, or Safari (works via `file://`).

---

## ✨ Features

- **ChatGPT-like Ergonomics**:
  - Dark obsidian theme (`#0b0d11`) with refined emerald accents and high-contrast typography.
  - Multi-session chat history persisted locally in `localStorage`.
  - Auto-resizing textarea with keyboard shortcuts (`Enter` to submit, `Shift+Enter` for newline).
  - Stop button (`Stop Generation`) that immediately terminates the active HTTP/SSE stream via `AbortController`.
  - 1-click starter prompts for testing GQA, Rust reverse proxying, GGUF quants, and creative tasks.

- **Real-Time Token Telemetry HUD**:
  - **Generation Speed**: Live `tokens / second` (t/s) calculation updating in real-time as chunks stream in.
  - **Time To First Token (TTFT)**: Precise millisecond latency from request dispatch to initial token arrival.
  - **Token Counter**: Cumulative count of tokens generated in the active response.
  - **Duration Timer**: Total elapsed request duration.

- **OpenAI-Compatible Streaming**:
  - Dispatches `POST /v1/chat/completions` with `stream: true`.
  - Parses incoming `data: {...}` lines chunk-by-chunk using `ReadableStream` and `TextDecoder` without buffering.
  - Detects `data: [DONE]` and native `llama-server` timings if reported.
  - Supports toggling non-streaming mode to test standard JSON completions.

- **Markdown & Code Block Highlighting**:
  - Powered by `marked.js` with GitHub Flavored Markdown (tables, blockquotes, lists).
  - Code syntax highlighting via `highlight.js` with per-language badges and one-click **Copy code** buttons.

- **Gateway Health & Model Auto-Discovery**:
  - Auto-pings `/healthz` to detect gateway status (`serving`, `stopped`, `offline`).
  - Auto-fetches `/v1/models` and populates the model selector dropdown.
  - Presets for `:13370` (Axum Gateway), `:8080` (raw llama.cpp sidecar), and `:11434` (Ollama).

- **Simulated Stream Mode**:
  - Includes a built-in simulation switch to test the UI, streaming cursor, stop button, and code block formatting even if no local server is currently running.

---

## 🛠 File Structure

```
demo/
├── index.html     # HTML structure with Tailwind CDN, Lucide icons, Marked, and Highlight.js
├── app.js         # JavaScript application logic, SSE parser, and telemetry metrics
├── style.css      # Dark obsidian theme, streaming cursor blink, and code block styling
├── serve.sh       # Convenience server launcher (Python, Bun, or Node)
└── README.md      # Documentation and test guide
```

---

## 🧪 Testing Scenarios

1. **Verify Zero-Buffering Streaming**:
   - Send a prompt with `SSE Streaming` enabled.
   - Observe the pulsating blinking cursor (`▋`) and tokens rendering token-by-token.
   - Note the live `t/s` counter updating during stream.

2. **Verify Stream Abort / Cancel**:
   - Ask for a long response (e.g. "Write a long essay on LLMs").
   - Click the red **Stop** button while generating.
   - Verify that the network stream immediately closes and generation halts.

3. **Verify Error Handling & Status Codes**:
   - When the Axum Gateway is active but no model is loaded, the interface captures HTTP `503 Service Unavailable` (`server_not_running`) and displays actionable instructions.
   - If port 13370 cannot be reached, the connection badge switches to **Offline** with diagnostic hints.
