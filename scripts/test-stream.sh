#!/usr/bin/env bash
# Real-time SSE streaming test for Local LLM Advisor gateway (:13370)

PROMPT="${*:-Write a short poem about coding in Rust.}"
PORT="${GATEWAY_PORT:-13370}"

echo "=========================================="
echo "⚡ Testing Real-Time Streaming (:13370)"
echo "📝 Prompt: \"$PROMPT\""
echo "=========================================="
echo ""

# Generate JSON payload cleanly using jq to avoid escaping/wrapping issues
PAYLOAD=$(jq -n --arg p "$PROMPT" '{
  "messages": [
    {"role": "system", "content": "You are a helpful AI assistant."},
    {"role": "user", "content": $p}
  ],
  "stream": true,
  "temperature": 0.7,
  "max_tokens": 200
}')

# Stream tokens in real time from the SSE stream
curl -N -s -X POST "http://127.0.0.1:${PORT}/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" | while IFS= read -r line; do
    # Check for SSE data line
    if [[ "$line" =~ ^data:\ (.*) ]]; then
      json_chunk="${BASH_REMATCH[1]}"
      
      # Check for stream completion sentinel
      if [[ "$json_chunk" == "[DONE]" ]]; then
        break
      fi
      
      # Extract delta content token and print immediately without newline
      token=$(echo "$json_chunk" | jq -r '.choices[0].delta.content // empty' 2>/dev/null)
      if [ -n "$token" ]; then
        printf "%s" "$token"
      fi
    elif [[ "$line" =~ ^\{.*\"error\" ]]; then
      echo ""
      echo "❌ Server Error: $line"
    fi
done

echo ""
echo ""
echo "=========================================="
echo "✨ Stream Finished."
echo "=========================================="
