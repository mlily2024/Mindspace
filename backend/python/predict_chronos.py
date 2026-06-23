#!/usr/bin/env python3
"""
One-shot CLI wrapper around chronos_infer.forecast (ADR-0012).

Reads a JSON request on stdin:   {"series": [float, ...], "horizon": int}
Writes a JSON response on stdout: {"p10": [...], "p50": [...], "p90": [...]}

Exits NON-ZERO on any error (JSON {"error": ...} on stderr) so the Node wrapper
(chronosService.js) falls back to the regression engine. This path reloads the
model each call (~14 s) so it suits batch/nightly use; the persistent sidecar
(chronos_server.py) is the low-latency production path.
"""
import json
import sys

from chronos_infer import forecast


def main():
    req = json.loads(sys.stdin.read())
    out = forecast(req.get("series") or [], req.get("horizon") or 7)
    sys.stdout.write(json.dumps(out))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # noqa: BLE001 - any failure -> non-zero exit -> Node fallback
        sys.stderr.write(json.dumps({"error": str(exc)}))
        sys.exit(1)
