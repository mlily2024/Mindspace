# Chronos-Bolt forecasting sidecar (ADR-0012).
#
# Heavy image (PyTorch + the model) — built ONLY when you want real Chronos
# forecasts, via the compose `chronos` profile:
#     docker compose --profile chronos up --build
# The backend falls back to the regression engine when this service is absent,
# so it is entirely optional. Not suitable for tiny hosts (needs ~1 GB+ RAM).
FROM python:3.11-slim

WORKDIR /app

# Install deps first for layer caching (torch is large).
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Inference + server (chronos_infer.py, chronos_server.py, predict_chronos.py).
COPY . .

ENV CHRONOS_HOST=0.0.0.0 \
    CHRONOS_PORT=8001 \
    HF_HOME=/root/.cache/huggingface

EXPOSE 8001

# The model is downloaded + warmed at startup (get_pipeline()); persist the HF
# cache via the compose volume so restarts don't re-download.
CMD ["python", "chronos_server.py"]
