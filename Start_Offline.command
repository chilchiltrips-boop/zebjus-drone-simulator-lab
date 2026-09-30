#!/bin/bash
cd -- "$(dirname -- "$0")" || exit 1
if command -v python3 >/dev/null 2>&1; then
    exec python3 start_offline.py
elif command -v python >/dev/null 2>&1; then
    exec python start_offline.py
elif command -v node >/dev/null 2>&1; then
    if command -v open >/dev/null 2>&1; then open http://localhost:8787/; fi
    exec node server.js
fi
echo "Install Python 3 first, then reopen Start_Offline.command."
read -r -p "Press Enter to close. "
