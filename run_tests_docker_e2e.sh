#!/bin/bash
#
# Run frontend E2E tests fully inside Docker (Playwright container).
# Assumes docker-compose.dev.yml stack is already running.
# The called script performs explicit backend DB migration/import before E2E execution.
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

./run_tests_docker.sh e2e
