#!/bin/bash
#
# Run backend integration tests in Docker container.
# Assumes docker-compose.dev.yml is already running.
#

set -e

COMPOSE_FILE="docker-compose.dev.yml"

if [ ! -f "$COMPOSE_FILE" ]; then
    echo "Error: $COMPOSE_FILE not found"
    exit 1
fi

echo "Running backend INTEGRATION tests in Docker..."
docker compose -f "$COMPOSE_FILE" exec backend uv run pytest tests/integration -v
