@echo off
cd /d "%~dp0"

echo Starting Backend...
start "Backend" cmd /k "npm run dev:web"

echo Starting Frontend...
start "Frontend" cmd /k "npx vite dev -c vite.web.config.ts --host 0.0.0.0 --port 8080"
