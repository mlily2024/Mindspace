"""
Shared Chronos-Bolt inference (ADR-0012).

Used by both the one-shot CLI (`predict_chronos.py`) and the persistent sidecar
(`chronos_server.py`). The model pipeline is loaded lazily and cached at module
scope, so the sidecar pays the load cost once and every subsequent forecast is
just inference (~50-200 ms) rather than a ~14 s reload.
"""

_PIPELINE = None
MODEL_ID = "amazon/chronos-bolt-small"


def get_pipeline():
    """Load (once) and return the Chronos-Bolt pipeline. CPU, float32."""
    global _PIPELINE
    if _PIPELINE is None:
        import torch
        from chronos import BaseChronosPipeline
        _PIPELINE = BaseChronosPipeline.from_pretrained(
            MODEL_ID,
            device_map="cpu",
            torch_dtype=torch.float32,
        )
    return _PIPELINE


def forecast(series, horizon):
    """Return {"p10":[...], "p50":[...], "p90":[...]} for the given series.

    Raises on bad input or model failure so callers can map it to an error
    response / non-zero exit (the Node side then falls back to regression).
    """
    if not isinstance(series, list) or len(series) < 2:
        raise ValueError("series must be a list of at least 2 numbers")
    horizon = int(horizon)
    if horizon < 1 or horizon > 60:
        raise ValueError("horizon out of range (1-60)")

    import torch

    pipeline = get_pipeline()
    context = torch.tensor([float(x) for x in series], dtype=torch.float32)
    quantiles, _mean = pipeline.predict_quantiles(
        context=context,
        prediction_length=horizon,
        quantile_levels=[0.1, 0.5, 0.9],
    )
    q = quantiles[0]  # [horizon, 3]
    return {
        "p10": [round(float(v), 4) for v in q[:, 0].tolist()],
        "p50": [round(float(v), 4) for v in q[:, 1].tolist()],
        "p90": [round(float(v), 4) for v in q[:, 2].tolist()],
    }
