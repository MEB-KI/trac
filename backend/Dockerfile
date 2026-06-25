FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN pip install --no-cache-dir uv

WORKDIR /workspace/backend

<<<<<<< HEAD
CMD ["sh", "-lc", "uv sync --dev && uv run tud db upgrade && uv run tud studies import --config studies_config.json && uv run gunicorn -c /workspace/backend/gunicorn_conf.py o_timeusediary_backend.api:app"]
=======
CMD ["sh", "-lc", "printenv && uv sync --dev && uv run gunicorn -c /workspace/backend/gunicorn_conf.py o_timeusediary_backend.api:app"]
>>>>>>> e3c798f (Working in podman rootless setup, but still needs cleanup)
