# Stage 1: Build stage
FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim AS builder

# Set build environment variables
ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app
# Outside the compose bind-mount, so the image's venv is not shadowed and no masking
# anonymous volume is needed (Docker never refreshes those on rebuild).
ENV UV_PROJECT_ENVIRONMENT=/opt/venv

# Copy the entire repository to satisfy workspace members
COPY . /app

WORKDIR /app

# Install dependencies for the specific package
WORKDIR /app/services/auth-service
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --package auth-service --frozen --no-dev


FROM builder AS test
WORKDIR /app/services/auth-service
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --package auth-service --frozen
RUN uv run pytest

    # Stage 2: Final Runtime stage
FROM python:3.13-slim-bookworm

# Metadata
LABEL maintainer="BeyondForms Team"

# Environment Variables
ENV PYTHONUNBUFFERED=1
# Add the workspace venv's bin directory to the PATH
ENV PATH="/opt/venv/bin:$PATH"

WORKDIR /app

# Copy the service and its local library dependencies to resolve path mappings
COPY --from=builder /app/services/auth-service /app/services/auth-service
COPY --from=builder /app/libs/auth /app/libs/auth
COPY --from=builder /opt/venv /opt/venv

WORKDIR /app/services/auth-service

# Create non-root user
RUN useradd -u 10001 -m app && chown -R app:app /app
USER app

# Expose port
EXPOSE 8080
ENTRYPOINT ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8080"]
