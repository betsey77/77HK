@echo off
title Cantonese 4B + Frontend Dev Server

echo ==========================================
echo  HK Cantonese Copywriter - Local Dev
echo ==========================================
echo.
echo Model: hon9kon9ize/Qwen3-4B-CV-KD
echo Path: %~dp0models\Qwen3-4B-CV-KD
echo.

REM Check model files
if not exist "%~dp0models\Qwen3-4B-CV-KD\config.json" (
    echo [ERROR] Model files not found!
    echo Please ensure models\Qwen3-4B-CV-KD\ exists with all model files.
    pause
    exit /b 1
)

echo [1/2] Starting 4B model API server...
start "Cantonese-4B-Model" cmd /c "cd /d %~dp0 && python server_4b_api.py && pause"

echo.
echo [2/2] Starting frontend + backend dev servers...
echo.
echo ==========================================
echo  Model API:  http://localhost:8000
echo  Frontend:   http://localhost:5173
echo  Backend:    http://localhost:3001
echo ==========================================
echo.
echo Close this window to stop all servers.
echo.

cd /d %~dp0
npm run dev

pause
