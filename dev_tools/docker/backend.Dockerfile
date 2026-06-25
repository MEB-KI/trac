FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN pip install --no-cache-dir uv

WORKDIR /workspace/backend

CMD ["sh", \
    "-lc", \
    "uv run tud db upgrade && uv run tud studies import --config studies_config.json && uv run gunicorn -c /workspace/deployement/gunicorn_conf.py o_timeusediary_backend.api:app"\
]
