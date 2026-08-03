FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim AS builder
ARG UV_INDEX_URL
ENV UV_INDEX_URL=$UV_INDEX_URL
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy
WORKDIR /app
# Outside the compose bind-mount, so the image's venv is not shadowed and no masking
# anonymous volume is needed (Docker never refreshes those on rebuild).
ENV UV_PROJECT_ENVIRONMENT=/opt/venv
ADD . /app
WORKDIR /app/services/document-intelligence-service
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --package document-intelligence-service --frozen --no-dev

# Stage 2: Test stage
FROM builder AS test
WORKDIR /app/services/document-intelligence-service
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --package document-intelligence-service --frozen
ENV PYTHONPATH="/app/services/document-intelligence-service/src:/app/services/document-intelligence-service/src/app"
RUN uv run python -m pytest

FROM python:3.13-slim-bookworm

# Create non-root user
RUN useradd -u 10001 -m app

# Ensure tests passed by copying from the test stage
COPY --from=test /app/services/document-intelligence-service/pyproject.toml /dev/null
COPY --from=builder --chown=app:app /app/services/document-intelligence-service /app/services/document-intelligence-service
COPY --from=builder --chown=app:app /app/libs/document-schemas /app/libs/document-schemas
COPY --from=builder --chown=app:app /opt/venv /opt/venv
WORKDIR /app/services/document-intelligence-service
ENV PATH="/opt/venv/bin:$PATH"
ENV PYTHONPATH="/app/services/document-intelligence-service/src:/app/services/document-intelligence-service/src/app"

USER app

# Smoke test to ensure app can be imported
RUN python -c "import app.main; print('Import successful')"

EXPOSE 8080
CMD ["fastapi", "run", "src/app/main.py", "--host", "0.0.0.0", "--port", "8080"]
