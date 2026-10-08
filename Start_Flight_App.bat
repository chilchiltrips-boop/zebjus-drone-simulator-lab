@echo off
cd /d "%~dp0"
where py >nul 2>nul
if not errorlevel 1 (
    py -3 start_offline.py --flight
    goto end
)
where python >nul 2>nul
if not errorlevel 1 (
    python start_offline.py --flight
    goto end
)
where node >nul 2>nul
if not errorlevel 1 (
    start "" http://localhost:8787/flight/
    node server.js
    goto end
)
echo Install Python 3 or Node.js to serve the local app, then reopen this file.
:end
pause
