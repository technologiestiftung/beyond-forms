#!/usr/bin/env bash
# BeyondForms Development Workflow Wrapper
# Automatically tears down hanging Docker containers and lingering host processes on standard ports.

set -e

echo "🛑 [1/3] Tearing down existing Docker containers..."
docker compose down --remove-orphans || true

echo "🧹 [2/3] Ensuring critical ports are clear..."
# Standard BeyondForms Ports:
# 8000: Form Filler / LLM Endpoints
# 8001: Document Intelligence Service
# 8002: Toolbox MCP
# 8003: Auth Service
# 8004: Rules Engine
# 8005: Translation Service
# 8080: Orchestration Middleware
PORTS=(8000 8001 8002 8003 8004 8005 8080)

for PORT in "${PORTS[@]}"; do
    if fuser "$PORT/tcp" >/dev/null 2>&1; then
        echo "   -> Terminating process blocking port $PORT..."
        fuser -k "$PORT/tcp" >/dev/null 2>&1 || true
    fi
done

echo "🚀 [3/3] Launching Docker Compose build..."
docker compose up --build
