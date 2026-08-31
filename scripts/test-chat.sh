#!/usr/bin/env bash
PROMPT="${*:-Hello!}"
curl -s -X POST http://127.0.0.1:13370/v1/chat/completions \
  -H "Content-Type: application/json" \
  --data "$(jq -n --arg p "$PROMPT" '{"messages":[{"role":"user","content":$p}],"max_tokens":100}')" | jq -r '.choices[0].message.content // .'
