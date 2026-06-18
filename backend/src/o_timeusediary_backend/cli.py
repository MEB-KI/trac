import argparse
import sys
from pathlib import Path

from sqlalchemy import func
from sqlmodel import Session, select

from .database import (
    create_config_file_studies_in_database,
    engine,
    initialize_db_schema,
    show_db_current_revision,
    upgrade_db_schema,
)
from .models import Activity, Participant, Study
from .parsers.studies_config import load_studies_config
from .settings import settings


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="tud",
        description="TRAC backend utility commands",
    )

    subparsers = parser.add_subparsers(dest="command")

    db_parser = subparsers.add_parser("db", help="Database schema migration commands")
    db_subparsers = db_parser.add_subparsers(dest="db_command")

    db_upgrade_parser = db_subparsers.add_parser(
        "upgrade", help="Upgrade database schema to target Alembic revision"
    )
    db_upgrade_parser.add_argument(
        "--revision",
        default="head",
        help="Alembic target revision (default: head)",
    )

    db_subparsers.add_parser(
        "current", help="Show current database schema revision"
    )

    studies_parser = subparsers.add_parser("studies", help="Study management commands")
    studies_subparsers = studies_parser.add_subparsers(dest="studies_command")

    import_parser = studies_subparsers.add_parser(
        "import",
        help="Import studies from one or more studies_config JSON/YAML files",
    )
    import_parser.add_argument(
        "--config",
        required=True,
        action="append",
        nargs="+",
        help=(
            "Path(s) to studies config file(s) (JSON/YAML). "
            "You can pass this option multiple times."
        ),
    )
    import_parser.add_argument(
        "--no-ensure-schema",
        action="store_true",
        help="Skip schema initialization before import",
    )

    return parser


def _get_db_counts() -> dict[str, int]:
    with Session(engine) as session:
        studies_count = session.exec(select(func.count(Study.id))).one()
        participants_count = session.exec(select(func.count(Participant.id))).one()
        activities_count = session.exec(select(func.count(Activity.id))).one()

    return {
        "studies": int(studies_count or 0),
        "participants": int(participants_count or 0),
        "activities": int(activities_count or 0),
    }


def _collect_studies_and_duplicates_across_configs(
    config_paths: list[str],
) -> tuple[list[tuple[str, str]], dict[str, set[str]]]:
    studies_in_order: list[tuple[str, str]] = []
    short_name_to_path: dict[str, str] = {}
    duplicate_entries: dict[str, set[str]] = {}

    for config_path in config_paths:
        studies_config = load_studies_config(config_path)
        for study in studies_config.studies:
            studies_in_order.append((study.name_short, config_path))
            existing_path = short_name_to_path.get(study.name_short)
            if existing_path is None:
                short_name_to_path[study.name_short] = config_path
                continue

            duplicate_paths = duplicate_entries.setdefault(study.name_short, set())
            duplicate_paths.add(existing_path)
            duplicate_paths.add(config_path)

    return studies_in_order, duplicate_entries


def _print_study_creation_summary(
    created_studies: list[str],
    not_created_studies: list[tuple[str, str]],
) -> None:
    print("Study import summary:")
    print("Created studies:")
    if created_studies:
        for study_name_short in created_studies:
            print(f"- {study_name_short}")
    else:
        print("- (none)")

    print("Not created studies:")
    if not_created_studies:
        for study_name_short, reason in not_created_studies:
            print(f"- {study_name_short}: {reason}")
    else:
        print("- (none)")



def _run_studies_import(configs: list[str], ensure_schema: bool) -> int:
    config_paths = [str(Path(config).expanduser().resolve()) for config in configs]

    studies_in_order, duplicate_entries = _collect_studies_and_duplicates_across_configs(
        config_paths
    )

    if duplicate_entries:
        not_created_studies = []
        for study_name_short, _config_path in studies_in_order:
            duplicate_paths = duplicate_entries.get(study_name_short)
            if duplicate_paths:
                reason = (
                    "duplicate name_short across provided config files: "
                    + ", ".join(sorted(duplicate_paths))
                )
            else:
                reason = (
                    "import aborted because other files contain duplicate name_short values"
                )
            not_created_studies.append((study_name_short, reason))

        print(
            "Studies import aborted: duplicate study name_short values were detected "
            "across the provided --config files."
        )
        _print_study_creation_summary([], not_created_studies)
        return 1

    before = _get_db_counts()

    if ensure_schema:
        initialize_db_schema()

    created_studies: list[str] = []
    not_created_studies: list[tuple[str, str]] = []
    has_errors = False

    for config_path in config_paths:
        # Keep relative activity path resolution aligned with the selected import file.
        settings.studies_config_path = config_path
        file_results = create_config_file_studies_in_database(config_path) or []
        for result in file_results:
            study_name_short = str(result.get("study_name_short", "unknown"))
            if bool(result.get("created", False)):
                created_studies.append(study_name_short)
                continue

            reason = str(result.get("reason", "not created"))
            not_created_studies.append((study_name_short, reason))
            if bool(result.get("is_error", False)):
                has_errors = True

    after = _get_db_counts()

    print("Config file(s):")
    for config_path in config_paths:
        print(f"- {config_path}")
    print(
        "Counts before/after: "
        f"studies {before['studies']}->{after['studies']}, "
        f"participants {before['participants']}->{after['participants']}, "
        f"activities {before['activities']}->{after['activities']}"
    )
    _print_study_creation_summary(created_studies, not_created_studies)

    if has_errors:
        print("Studies import completed with errors.")
        return 1

    print("Studies import completed.")
    return 0


def _run_db_upgrade(revision: str) -> int:
    upgrade_db_schema(revision)
    print(f"Database schema upgraded to revision '{revision}'.")
    return 0


def _run_db_current() -> int:
    show_db_current_revision()
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)

    if args.command == "db" and args.db_command == "upgrade":
        return _run_db_upgrade(args.revision)

    if args.command == "db" and args.db_command == "current":
        return _run_db_current()

    if args.command == "studies" and args.studies_command == "import":
        ensure_schema = not args.no_ensure_schema
        flat_configs = [item for group in args.config for item in group]
        return _run_studies_import(flat_configs, ensure_schema=ensure_schema)

    parser.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())
