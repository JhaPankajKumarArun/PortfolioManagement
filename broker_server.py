"""Loopback-only local server. No CORS, no credential persistence."""
import getpass
import hmac
import json
import secrets
import threading
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
from broker_sync import token_from_input

HOST = "127.0.0.1"
PORT = 8765
ORIGIN = f"http://{HOST}:{PORT}"
ROOT = Path(__file__).resolve().parent
TOKEN = secrets.token_urlsafe(32)
LOCK = threading.Lock()

def connect():
    from kiteconnect import KiteConnect
    import webbrowser
    kite = KiteConnect(api_key=getpass.getpass("Kite API key: "), timeout=30)
    secret = getpass.getpass("Kite API secret: ")
    webbrowser.open(kite.login_url())
    kite.set_access_token(kite.generate_session(token_from_input(), api_secret=secret)["access_token"])
    return kite

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, *args):
        pass

    def reply(self, status, data):
        body = json.dumps(data, default=str).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def allowed_host(self):
        return self.headers.get("Host") == f"{HOST}:{PORT}"

    def do_GET(self):
        if not self.allowed_host():
            return self.reply(403, {"error": "Invalid host"})
        path = urlsplit(self.path).path
        # Explicit static allowlist; never serve repository metadata or Python files.
        if path == "/":
            self.path = "/index.html"
        elif not (path in ("/index.html", "/sw.js", "/manifest.webmanifest", "/icon-180.png", "/icon-192.png", "/icon-512.png", "/icon-512-maskable.png") or path.startswith(("/js/", "/css/"))):
            return self.reply(404, {"error": "Not found"})
        from urllib.parse import unquote
        target = Path(self.translate_path(unquote(self.path))).resolve()
        if not target.is_relative_to(ROOT) or not target.is_file() or target.suffix not in (".html", ".js", ".mjs", ".css", ".png", ".webmanifest", ".woff2"):
            return self.reply(404, {"error": "Not found"})
        return super().do_GET()

    def do_HEAD(self):
        self.send_error(405)

    def do_POST(self):
        if not self.allowed_host() or self.headers.get("Origin") != ORIGIN or not hmac.compare_digest(self.headers.get("X-Broker-Key", ""), TOKEN):
            return self.reply(403, {"error": "Local authorization required"})
        if self.path != "/api/broker/zerodha/holdings":
            return self.reply(404, {"error": "Unsupported endpoint"})
        if not LOCK.acquire(blocking=False):
            return self.reply(409, {"error": "Sync already running"})
        try:
            equity = self.server.kite.holdings()
            funds = self.server.kite.mf_holdings()
            return self.reply(200, {"schema": "broker-snapshot-v1", "broker": "zerodha",
                "fetchedAt": datetime.now(timezone.utc).isoformat(),
                "data": {"equity": equity, "mutualFunds": funds}})
        except Exception:
            return self.reply(502, {"error": "Broker request failed. Check session; restart server to reconnect."})
        finally:
            LOCK.release()

def main():
    kite = connect()
    with ThreadingHTTPServer((HOST, PORT), Handler) as server:
        server.kite = kite
        print("Open", ORIGIN)
        print("Local pairing key (do not share):", TOKEN)
        server.serve_forever()

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        pass
    except Exception as exc:
        print("Startup failed:", type(exc).__name__)
        raise SystemExit(1) from None
