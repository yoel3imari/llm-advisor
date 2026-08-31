#!/usr/bin/env python3
import sys
import json
import urllib.request

prompt = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else "Say hello in French, German, and Spanish!"

payload = {
    "messages": [
        {"role": "system", "content": "You are a helpful AI assistant."},
        {"role": "user", "content": prompt}
    ],
    "temperature": 0.7,
    "max_tokens": 150
}

req = urllib.request.Request(
    "http://127.0.0.1:13370/v1/chat/completions",
    data=json.dumps(payload).encode("utf-8"),
    headers={"Content-Type": "application/json"}
)

print(f"\n Prompt: {prompt}\n")
try:
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        reply = data["choices"][0]["message"]["content"]
        tokens = data.get("usage", {}).get("completion_tokens", "N/A")
        print(f"🤖 Response ({tokens} tokens):\n{reply}\n")
except Exception as e:
    print(f"❌ Error: {e}", file=sys.stderr)
