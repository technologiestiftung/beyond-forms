FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim AS builder
ARG UV_INDEX_URL
ENV UV_INDEX_URL=$UV_INDEX_URL
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy
ENV GEMINI_MODEL_NAME=gemini-3.5-flash
ENV CHAT_CONTEXT_WINDOW_SIZE=20
WORKDIR /app
# Outside the compose bind-mount, so the image's venv is not shadowed and no masking
# anonymous volume is needed (Docker never refreshes those on rebuild).
ENV UV_PROJECT_ENVIRONMENT=/opt/venv
ADD . /app
WORKDIR /app/services/orchestration-middleware-service
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --package orchestration-middleware-service --frozen --no-dev

FROM builder AS test
WORKDIR /app/services/orchestration-middleware-service
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --package orchestration-middleware-service --frozen
RUN uv run pytest

FROM python:3.13-slim-bookworm

# Create non-root user
RUN useradd -u 10001 -m app

# Ensure tests passed by copying from the test stage
COPY --from=test /app/services/orchestration-middleware-service/pyproject.toml /dev/null
COPY --from=builder --chown=app:app /app/services/orchestration-middleware-service /app/services/orchestration-middleware-service
COPY --from=builder --chown=app:app /app/libs/auth /app/libs/auth
COPY --from=builder --chown=app:app /app/libs/document-schemas /app/libs/document-schemas
COPY --from=builder --chown=app:app /app/forms /app/forms
# Demo persona fixtures. Read by src/services/demo_seed_service.py; harmless when
# DEMO_SEED_ENABLED is unset, since the router is not mounted then.
COPY --from=builder --chown=app:app /app/demo /app/demo
COPY --from=builder --chown=app:app /opt/venv /opt/venv
WORKDIR /app/services/orchestration-middleware-service
ENV PATH="/opt/venv/bin:$PATH"
ENV PYTHONPATH="/app/services/orchestration-middleware-service"

USER app

EXPOSE 8080
# Run the application
CMD ["fastapi", "run", "src/main.py", "--host", "0.0.0.0", "--port", "8080"]
