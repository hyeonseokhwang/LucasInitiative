from pathlib import Path

# Paths
BASE_DIR = Path(__file__).parent
DB_PATH = BASE_DIR / "db" / "lucas.db"
SCHEMA_PATH = BASE_DIR / "db" / "schema.sql"
STATIC_DIR = BASE_DIR.parent / "frontend" / "dist"

# Server
HOST = "0.0.0.0"
PORT = 7777

# Ollama
OLLAMA_BASE_URL = "http://localhost:11434"
DEFAULT_MODEL = "deepseek-r1:8b"

# Monitoring
METRICS_POLL_INTERVAL = 3       # seconds (WebSocket push)
METRICS_SAVE_INTERVAL = 30      # seconds (DB persistence)
METRICS_RETENTION_DAYS = 7      # auto-cleanup

# Chat
MAX_CONTEXT_MESSAGES = 20
CHAT_TIMEOUT = 300              # seconds

# Model display config
MODEL_CONFIGS = {
    "deepseek-r1:8b": {"label": "DeepSeek R1 8B", "category": "reasoning", "recommended": True},
    "qwen2.5-coder:7b": {"label": "Qwen 2.5 Coder 7B", "category": "code", "recommended": True},
    "gemma2:2b": {"label": "Gemma 2 2B", "category": "general", "note": "Fast, lower quality"},
    "llama3.2:1b": {"label": "Llama 3.2 1B", "category": "general", "note": "Fastest"},
    "phi3:mini": {"label": "Phi-3 Mini", "category": "general"},
    "qwen2:0.5b": {"label": "Qwen 2 0.5B", "category": "general", "note": "Ultra-light"},
    "openhermes:latest": {"label": "OpenHermes 7B", "category": "general"},
    "command-r-plus:latest": {"label": "Command R+ 103B", "category": "general", "note": "SLOW"},
    "deepseek-llm:7b-chat-q4_K_M": {"label": "DeepSeek LLM 7B", "category": "general"},
    "dnotitia/dna:8b-instruct-q4_K": {"label": "DNA 8B (Korean)", "category": "korean"},
}
