"""Fixtures for the schema-migration tests.

`./test_backend_migrations.sh` starts a throwaway database server and points
`TUD_MIGRATION_TEST_DATABASE_URL` at it; the tests create one empty database per
revision next to it and drop it again. They never write to the database named in
the URL.
"""

from __future__ import annotations

import migration_helpers
import pytest
from migration_helpers import create_scratch_database, drop_scratch_database, server_url


def pytest_addoption(parser):
    parser.addoption(
        "--require-database",
        action="store_true",
        default=False,
        help=(
            "fail instead of skipping when the scratch database server is missing or "
            "does not allow CREATE DATABASE (used by ./test_backend_migrations.sh)"
        ),
    )


def pytest_configure(config):
    migration_helpers.REQUIRE_DATABASE = config.getoption("--require-database")


@pytest.fixture
def scratch_database():
    """An empty database to migrate as the test likes, dropped afterwards."""
    scratch = create_scratch_database(server_url())
    try:
        yield scratch
    finally:
        drop_scratch_database(scratch)
