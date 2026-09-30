@echo off
cd /d "%~dp0"
where py >nul 2>nul
if not errorlevel 1 (
    py -3 start_offline.py
    goto end
)
where python >nul 2>nul
if not errorlevel 1 (
    python start_offline.py
    goto end
)
where node >nul 2>nul
if not errorlevel 1 (
    start "" http://localhost:8787/
    node server.js
    goto end
)
echo Install Python 3 first, then reopen Start_Offline.bat.
:end
pause
