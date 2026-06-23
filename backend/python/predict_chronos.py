#!/usr/bin/env python3
"""
Chronos-Bolt zero-shot mood forecast (ADR-0012).

Reads a JSON request on stdin:
    {"series": [float, ...], "horizon": int}
Writes a JSON response on stdout:
    {"p10": [float, ...], "p50": [float, ...], "p90": [float, ...]}   (length = horizon)

Exits NON-ZERO on any error (with a JSON {"error": ...} on stderr) so the Node
wrapper (chronosService.js) falls back to the existing regression engine.
The Node side never depends on this succeeding.

Model: amazon/chronos-bolt-small (Apache-2.0). CPU inference, float32.
"""
import json
import sys


def main():
    raw = sys.stdin.read()
    req = json.loads(raw)

    series = req.get("series") or []
    horizon = int(req.get("horizon") or 7)

    if not isinstance(series, list) or len(series) < 2:
        raise ValueError("series must be a list of at least 2 numbers")
    if horizon < 1 or horizon > 60:
        raise ValueError("horizon out of range (1-60)")

    # Heavy imports are deferred until after validation so a bad request fails
    # fast and cheap (and so import errors are reported as a clean fallback).
    import torch
    from chronos import BaseChronosPipeline

    pipeline = BaseChronosPipeline.from_pretrained(
        "amazon/chronos-bolt-small",
        device_map="cpu",
        torch_dtype=torch.float32,
    )

    context = torch.tensor([float(x) for x in series], dtype=torch.float32)

    # quantiles shape: [num_series=1, horizon, num_quantiles]
    quantiles, _mean = pipeline.predict_quantiles(
        context=context,
        prediction_length=horizon,
        quantile_levels=[0.1, 0.5, 0.9],
    )
    q = quantiles[0]  # [horizon, 3]

    out = {
        "p10": [round(float(v), 4) for v in q[:, 0].tolist()],
        "p50": [round(float(v), 4) for v in q[:, 1].tolist()],
        "p90": [round(float(v), 4) for v in q[:, 2].tolist()],
    }
    sys.stdout.write(json.dumps(out))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # noqa: BLE001 - any failure -> non-zero exit -> Node fallback
        sys.stderr.write(json.dumps({"error": str(exc)}))
        sys.exit(1)
