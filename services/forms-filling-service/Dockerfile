FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim AS builder
ARG UV_INDEX_URL
ENV UV_INDEX_URL=$UV_INDEX_URL
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy
WORKDIR /app
# Force the venv to be created in the service-specific path (instead of workspace root)
# to maintain backward compatibility with the final stage PATH and external configs.
ENV UV_PROJECT_ENVIRONMENT=/app/services/forms-filling-service/.venv
ADD . /app
WORKDIR /app/services/forms-filling-service
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --package forms-filling-service --frozen --no-dev

FROM builder AS test
WORKDIR /app/services/forms-filling-service
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --package forms-filling-service --frozen
RUN uv run pytest

FROM python:3.13-slim-bookworm

# Create non-root user
RUN useradd -u 10001 -m app

COPY --from=builder --chown=app:app /app/services/forms-filling-service /app/services/forms-filling-service
WORKDIR /app/services/forms-filling-service
ENV PATH="/app/services/forms-filling-service/.venv/bin:$PATH"
ENV PYTHONPATH="/app/services/forms-filling-service"

USER app

EXPOSE 8080
CMD ["fastapi", "run", "src/main.py", "--host", "0.0.0.0", "--port", "8080"]
