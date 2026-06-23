#!/usr/bin/env python3
"""
Persistent Chronos-Bolt forecasting sidecar (ADR-0012).

Loads the model ONCE at startup, then serves forecasts over HTTP so each request
is just inference (~50-200 ms) instead of a ~14 s per-call model reload. Stdlib
only — no FastAPI/uvicorn dependency.

  GET  /health   -> {"status": "ok", "model": "..."}
  POST /forecast -> {"series": [...], "horizon": N} -> {"p10": [...], "p50": [...], "p90": [...]}

Env: CHRONOS_HOST (default 127.0.0.1), CHRONOS_PORT (default 8001).

The Node backend talks to this via CHRONOS_URL and falls back to the regression
engine on any failure, so the sidecar is entirely optional.
"""
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from chronos_infer import MODEL_ID, forecast, get_pipeline

HOST = os.environ.get("CHRONOS_HOST", "127.0.0.1")
PORT = int(os.environ.get("CHRONOS_PORT", "8001"))
MAX_BODY = 1 << 20  # 1 MB cap


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            self._send(200, {"status": "ok", "model": MODEL_ID})
        else:
            self._send(404, {"error": "not found"})

    def do_POST(self):
        if self.path != "/forecast":
            return self._send(404, {"error": "not found"})
        try:
            length = int(self.headers.get("Content-Length", 0))
            if length <= 0 or length > MAX_BODY:
                return self._send(400, {"error": "bad content length"})
            req = json.loads(self.rfile.read(length))
            out = forecast(req.get("series") or [], req.get("horizon") or 7)
            self._send(200, out)
        except ValueError as exc:
            self._send(400, {"error": str(exc)})
        except Exception as exc:  # noqa: BLE001
            self._send(500, {"error": str(exc)})

    def log_message(self, *args):  # silence default per-request access logs
        return


def main():
    # Warm the model at startup so the first request is fast and /health is honest.
    get_pipeline()
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"chronos sidecar listening on {HOST}:{PORT} ({MODEL_ID})", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
