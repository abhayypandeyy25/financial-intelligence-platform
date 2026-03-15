#!/usr/bin/env bash
# Start the MiroFish Flask sidecar on port 5001
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIROFISH_DIR="$PROJECT_ROOT/MiroFish/MiroFish-main/backend"

if [ ! -d "$MIROFISH_DIR" ]; then
    echo "ERROR: MiroFish backend not found at $MIROFISH_DIR"
    exit 1
fi

cd "$MIROFISH_DIR"

echo "Starting MiroFish sidecar on port 5001..."
python run.py
