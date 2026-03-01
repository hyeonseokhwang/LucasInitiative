#!/usr/bin/env bash
set -e

echo "========================================"
echo " Lucas AI Dashboard - Starting..."
echo "========================================"
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"

# Check Python
if ! command -v python3 &>/dev/null; then
    echo "[ERROR] Python3 not found. Install Python 3.11+"
    exit 1
fi

# Check Ollama
echo "[1/3] Checking Ollama..."
if curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
    echo "[OK] Ollama is running."
else
    echo "[WARN] Ollama not running. Chat/research features will be limited."
    echo "       Start with: ollama serve"
fi

# Install dependencies if needed
echo "[2/3] Checking dependencies..."
cd "$BACKEND_DIR"
if [ ! -d ".venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv .venv
fi
source .venv/bin/activate
pip install -q -r requirements.txt 2>/dev/null

# Start server
echo "[3/3] Starting backend server..."
echo ""
echo " Dashboard: http://localhost:7777"
echo " API Docs:  http://localhost:7777/api/docs"
echo " Press Ctrl+C to stop."
echo "========================================"
echo ""
python3 main.py
