#!/usr/bin/env bash
# Start both FastAPI backend and MiroFish sidecar
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_ROOT="$(cd "$BACKEND_DIR/.." && pwd)"
MIROFISH_DIR="$PROJECT_ROOT/MiroFish/MiroFish-main/backend"

echo "=== Financial Intelligence Platform + MiroFish ==="
echo ""

# Start MiroFish in background (if available)
if [ -d "$MIROFISH_DIR" ]; then
    echo "Starting MiroFish sidecar on port 5001..."
    cd "$MIROFISH_DIR"
    python run.py &
    MIROFISH_PID=$!
    echo "MiroFish PID: $MIROFISH_PID"
    cd "$BACKEND_DIR"
else
    echo "WARNING: MiroFish not found at $MIROFISH_DIR — simulation features disabled"
fi

# Start FastAPI
echo "Starting FastAPI on port 8000..."
cd "$BACKEND_DIR"
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Cleanup MiroFish on exit
if [ -n "$MIROFISH_PID" ]; then
    echo "Stopping MiroFish (PID $MIROFISH_PID)..."
    kill "$MIROFISH_PID" 2>/dev/null || true
fi
