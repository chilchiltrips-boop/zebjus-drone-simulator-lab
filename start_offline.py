#!/usr/bin/env python3
"""Dependency-free laptop launcher for the complete ZEBJUS browser app."""
import argparse
import functools
import http.server
import json
import threading
import urllib.error
import urllib.request
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
VERSION = (ROOT / 'VERSION.txt').read_text().strip()


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      '.js': 'text/javascript', '.mjs': 'text/javascript',
                      '.wasm': 'application/wasm', '.whl': 'application/octet-stream',
                      '.task': 'application/octet-stream'}

    def do_GET(self):
        if self.path.split('?', 1)[0] == '/health':
            body = json.dumps({'ok': True, 'version': VERSION, 'mode': 'static-local-kit'}).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            super().do_GET()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def log_message(self, fmt, *args):
        if args and str(args[1] if len(args) > 1 else '').startswith(('4', '5')):
            super().log_message(fmt, *args)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8787)
    parser.add_argument('--no-browser', action='store_true')
    args = parser.parse_args()
    url = f'http://localhost:{args.port}/'
    handler = functools.partial(Handler, directory=str(ROOT))
    try:
        server = http.server.ThreadingHTTPServer(('127.0.0.1', args.port), handler)
    except OSError:
        # A second launch should open the existing app without starting another server.
        try:
            opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
            with opener.open(url + 'health', timeout=2) as response:
                status = json.load(response)
            if status.get('version') != VERSION or status.get('mode') != 'static-local-kit':
                raise RuntimeError('Another application uses this port')
        except (OSError, ValueError, RuntimeError, urllib.error.URLError):
            parser.exit(1, f'Port {args.port} is already in use. Close the old app or run --port 8788.\n')
        if not args.no_browser:
            webbrowser.open(url)
        print('ZEBJUS is already running at', url)
        return
    print(f'ZEBJUS V{VERSION} • offline WebApp: {url}', flush=True)
    print('Keep this window open. Join the kit AP Wi-Fi; internet is not required. Ctrl+C closes the app.', flush=True)
    if not args.no_browser:
        threading.Timer(0.4, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
