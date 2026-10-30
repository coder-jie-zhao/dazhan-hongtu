@echo off
title 大展红途 · 本地演示服务
cd /d "%~dp0v2"

echo.
echo   大展红途 · 井冈山红色研学智能导览
echo   ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  set "NODE=C:\Program Files\nodejs\node.exe"
) else (
  set "NODE=node"
)

"%NODE%" -v >nul 2>nul
if errorlevel 1 (
  echo   [错误] 没有找到 Node.js
  echo   请先安装：https://nodejs.org
  echo.
  pause
  exit /b 1
)

echo   正在启动本地服务 http://127.0.0.1:8130
echo   浏览器会在 2 秒后自动打开
echo.
echo   演示结束后，关闭这个窗口即可停止服务。
echo   ============================================
echo.

start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process 'http://127.0.0.1:8130'"

"%NODE%" server.js

echo.
echo   服务已停止。
pause
