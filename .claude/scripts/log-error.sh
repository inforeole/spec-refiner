#!/bin/bash
# Log errors from tool calls for post-mortem analysis

LOG_DIR="$(dirname "$0")/../logs"
LOG_FILE="$LOG_DIR/errors.jsonl"

# Create log directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Read tool output from stdin
OUTPUT=$(cat)

# Check if output contains error indicators
if echo "$OUTPUT" | grep -qiE "(error|failed|exception|cannot|unable|denied)"; then
    TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
    TOOL_NAME="${CLAUDE_TOOL_NAME:-unknown}"

    # Escape for JSON
    ESCAPED_OUTPUT=$(echo "$OUTPUT" | sed 's/\\/\\\\/g' | sed 's/"/\\"/g' | sed ':a;N;$!ba;s/\n/\\n/g' | head -c 2000)

    echo "{\"timestamp\":\"$TIMESTAMP\",\"branch\":\"$GIT_BRANCH\",\"tool\":\"$TOOL_NAME\",\"output\":\"$ESCAPED_OUTPUT\"}" >> "$LOG_FILE"
fi

# Always pass through the output
echo "$OUTPUT"
