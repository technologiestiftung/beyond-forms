FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim AS builder
ARG UV_INDEX_URL
ENV UV_INDEX_URL=$UV_INDEX_URL
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy
WORKDIR /app
# Outside the compose bind-mount, so the image's venv is not shadowed and no masking
# anonymous volume is needed (Docker never refreshes those on rebuild).
ENV UV_PROJECT_ENVIRONMENT=/opt/venv
ADD . /app
WORKDIR /app/services/rules-engine
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --package rules-engine --frozen --no-dev

FROM builder AS test
WORKDIR /app/services/rules-engine
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --package rules-engine --frozen
RUN uv run python -m pytest

FROM python:3.13-slim-bookworm

RUN useradd -u 10001 -m app

COPY --from=test /app/services/rules-engine/pyproject.toml /dev/null
COPY --from=builder --chown=app:app /app/services/rules-engine /app/services/rules-engine
COPY --from=builder --chown=app:app /app/libs/document-schemas /app/libs/document-schemas
COPY --from=builder --chown=app:app /app/schemas/rules /app/schemas/rules
COPY --from=builder --chown=app:app /opt/venv /opt/venv
WORKDIR /app/services/rules-engine
ENV PATH="/opt/venv/bin:$PATH"
ENV PYTHONPATH="/app/services/rules-engine"

USER app

EXPOSE 8080
CMD ["fastapi", "run", "src/app/main.py", "--host", "0.0.0.0", "--port", "8080"]
