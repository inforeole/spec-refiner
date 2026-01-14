#!/bin/bash
# Log user prompts to JSONL file for post-mortem analysis

LOG_DIR="$(dirname "$0")/../logs"
LOG_FILE="$LOG_DIR/prompts.jsonl"

# Create log directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Get prompt from stdin or environment
PROMPT="${CLAUDE_USER_PROMPT:-$(cat)}"

# Skip empty prompts
if [ -z "$PROMPT" ]; then
    exit 0
fi

# Create JSON entry
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
GIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

# Escape special characters for JSON
ESCAPED_PROMPT=$(echo "$PROMPT" | sed 's/\\/\\\\/g' | sed 's/"/\\"/g' | sed ':a;N;$!ba;s/\n/\\n/g')

# Append to log file
echo "{\"timestamp\":\"$TIMESTAMP\",\"branch\":\"$GIT_BRANCH\",\"commit\":\"$GIT_HASH\",\"prompt\":\"$ESCAPED_PROMPT\"}" >> "$LOG_FILE"
