@echo off
title Lucas AI Dashboard
echo ========================================
echo  Lucas AI Dashboard - Starting...
echo ========================================
echo.

:: Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found. Install Python 3.11+
    pause
    exit /b 1
)

:: Check Ollama
echo [1/3] Checking Ollama...
curl -s http://localhost:11434/api/tags >nul 2>&1
if errorlevel 1 (
    echo [WARN] Ollama not running. Chat/research features will be limited.
    echo        Start with: ollama serve
) else (
    echo [OK] Ollama is running.
)

:: Install dependencies if needed
echo [2/3] Checking dependencies...
cd /d "%~dp0backend"
if not exist ".venv" (
    echo Creating virtual environment...
    python -m venv .venv
)
call .venv\Scripts\activate.bat
pip install -q -r requirements.txt 2>nul

:: Start server
echo [3/3] Starting backend server...
echo.
echo  Dashboard: http://localhost:7777
echo  API Docs:  http://localhost:7777/api/docs
echo  Press Ctrl+C to stop.
echo ========================================
echo.
python main.py
