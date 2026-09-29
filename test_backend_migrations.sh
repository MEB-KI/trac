#!/bin/sh
#
# Runs the schema-migration tests (backend/tests/migrations) against a real
# database server. Nothing else in the suite executes the Alembic migrations -
# the integration tests build their schema with SQLModel.metadata.create_all() -
# so this is the only place where a migration that cannot run on an existing,
# populated database is caught.
#
# The tests need a server on which they may create scratch databases:
#
#   * TUD_MIGRATION_TEST_DATABASE_URL set -> that server is used (the tests never
#     write to the database named in the URL, they create their own next to it,
#     so the role needs CREATE DATABASE).
#   * not set -> a throwaway PostgreSQL container is started and removed again.
#     Needs docker; set TUD_MIGRATION_TEST_DB_IMAGE to use another image and
#     TUD_MIGRATION_TEST_DB_PORT if port 55432 is taken.
#
# Usage (from the repository root):
#
#   ./test_backend_migrations.sh              # all migration tests
#   ./test_backend_migrations.sh -k adopted   # extra arguments go to pytest

set -e

if [ ! -d "backend/tests/migrations" ]; then
    echo "Error: This script must be run from the root directory of the project."
    exit 1
fi

CONTAINER_NAME="tud_migration_test_db"
IMAGE="${TUD_MIGRATION_TEST_DB_IMAGE:-postgres:18}"
PORT="${TUD_MIGRATION_TEST_DB_PORT:-55432}"

cleanup() {
    if [ -n "$STARTED_CONTAINER" ]; then
        echo "Removing the throwaway database container..."
        docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
    fi
}

if [ -n "$TUD_MIGRATION_TEST_DATABASE_URL" ]; then
    echo "Using the database server from TUD_MIGRATION_TEST_DATABASE_URL"
else
    if ! command -v docker >/dev/null 2>&1; then
        echo "Error: no TUD_MIGRATION_TEST_DATABASE_URL and docker is not available."
        echo "Set TUD_MIGRATION_TEST_DATABASE_URL to a server that allows CREATE DATABASE."
        exit 1
    fi

    echo "Starting a throwaway $IMAGE container for the migration tests..."
    docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
    docker run -d --rm --name "$CONTAINER_NAME" \
        -e POSTGRES_USER=migration_test \
        -e POSTGRES_PASSWORD=migration_test \
        -e POSTGRES_DB=migration_test \
        -p "$PORT:5432" \
        "$IMAGE" >/dev/null
    STARTED_CONTAINER=1
    trap cleanup EXIT INT TERM

    echo "Waiting for the database to accept connections..."
    attempts=0
    until docker exec "$CONTAINER_NAME" pg_isready -U migration_test >/dev/null 2>&1; do
        attempts=$((attempts + 1))
        if [ "$attempts" -gt 60 ]; then
            echo "Error: the database did not become ready in time."
            exit 1
        fi
        sleep 1
    done

    TUD_MIGRATION_TEST_DATABASE_URL="postgresql://migration_test:migration_test@127.0.0.1:$PORT/migration_test"
    export TUD_MIGRATION_TEST_DATABASE_URL
fi

echo "Running backend schema migration tests"
cd backend && uv run pytest tests/migrations -v --require-database "$@"
