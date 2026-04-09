#!/bin/bash
#
# Run frontend E2E tests fully inside Docker (Playwright container).
# Assumes docker-compose.dev.yml stack is already running.
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

./run_tests_docker.sh e2e
