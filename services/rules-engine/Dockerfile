FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim AS builder
ARG UV_INDEX_URL
ENV UV_INDEX_URL=$UV_INDEX_URL
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy
WORKDIR /app
# Force the venv to be created in the service-specific path (instead of workspace root)
# to maintain backward compatibility with the final stage PATH and external configs.
ENV UV_PROJECT_ENVIRONMENT=/app/services/rules-engine/.venv
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
WORKDIR /app/services/rules-engine
ENV PATH="/app/services/rules-engine/.venv/bin:$PATH"
ENV PYTHONPATH="/app/services/rules-engine"

USER app

EXPOSE 8080
CMD ["fastapi", "run", "src/app/main.py", "--host", "0.0.0.0", "--port", "8080"]
