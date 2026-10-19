@echo off
title Veridian - installation et demarrage
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1" %*
echo.
pause
