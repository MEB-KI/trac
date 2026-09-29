# Database Skill

Use this skill for database model, migration, schema-script, and seed-configuration changes.

## Use When
- The request affects SQLModel models, Alembic migrations, PostgreSQL schema scripts, or study/activity seed JSON.
- The request changes files under `database/` or backend model/seed config files.

## Do Not Use For
- Pure frontend or API-only behavior changes.
- Test execution-only requests.

## Required Workflow
1. Identify impacted artifacts: model definitions, Alembic migration files, create/drop scripts, and JSON seed/config files.
2. Preserve compatibility between `backend/src/o_timeusediary_backend/models.py` and migration/script artifacts. A model change and its migration belong in the same commit; CI fails on the drift (`alembic check`).
3. Write migrations forward-only and additively (see README, "Database schema policy"): add columns as nullable or with a server default, migrate data in its own step, and never drop or rename a column in the same release that stops using it. `downgrade()` is not a supported operation - do not spend effort on it.
4. When editing study/activity JSON, treat existing `name_short` studies as non-migrating records unless explicit migration/admin actions are requested.
5. Avoid destructive schema assumptions unless explicitly approved.
6. Prefer migration-first schema changes (`tud db upgrade`) and explicit import workflows (`tud studies import`) instead of relying on startup bootstrap.
7. Validate schema work with `./test_backend_migrations.sh` (upgrades a database from every revision to head with data present, adopts a pre-Alembic database, checks drift) and with the backend integration tests when database behavior changes.
8. Document data-impact risk (new rows only, schema change, or manual migration needed).

## Quality Checks
- JSON seed/config structure remains parseable and consistent.
- Model-to-schema alignment is preserved.
- No accidental data-loss path introduced.
