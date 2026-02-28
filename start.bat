@echo off
echo [Lucas AI] Starting Dashboard...
cd /d G:\LucasDashboard\backend
start /min python main.py
echo [Lucas AI] Server started on http://localhost:7777
echo [Lucas AI] Press any key to stop...
pause >nul
taskkill /f /im python.exe 2>nul
