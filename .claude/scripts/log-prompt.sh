#!/bin/bash
# Log user prompts to JSONL file for post-mortem analysis
# macOS compatible

LOG_DIR="$(dirname "$0")/../logs"
LOG_FILE="$LOG_DIR/prompts.jsonl"

# Create log directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Get input from stdin (Claude Code passes JSON with prompt field)
INPUT=$(cat)

# Skip empty input
if [ -z "$INPUT" ]; then
    exit 0
fi

# Extract just the prompt from the JSON input
PROMPT=$(echo "$INPUT" | python3 -c 'import sys,json; data=json.load(sys.stdin); print(data.get("prompt",""))' 2>/dev/null)

# If extraction failed, use raw input
if [ -z "$PROMPT" ]; then
    PROMPT="$INPUT"
fi

# Create JSON entry
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
GIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

# Escape special characters for JSON
ESCAPED_PROMPT=$(printf '%s' "$PROMPT" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read())[1:-1])')

# Append to log file
echo "{\"timestamp\":\"$TIMESTAMP\",\"branch\":\"$GIT_BRANCH\",\"commit\":\"$GIT_HASH\",\"prompt\":\"$ESCAPED_PROMPT\"}" >> "$LOG_FILE"
