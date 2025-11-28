# database.py
from sqlmodel import SQLModel, create_engine, Session, select, delete
from typing import Generator
from .models import Study, StudyEntryName, TimeuseEntry
from .settings import settings
from .studies_config import load_studies_config
import logging

logger = logging.getLogger(__name__)

engine = create_engine(settings.database_url)


def create_db_and_tables(do_report_contents: bool = False):
    SQLModel.metadata.create_all(engine)
    create_config_file_studies(settings.studies_config_path)
    if do_report_contents:
        report_on_db_contents()

def validate_activities_json_file(activities_json_path: str):
    """Validate the activities JSON file used by frontend and backend"""
    import json
    from pathlib import Path
    from collections import defaultdict

    logger.info(f"Validating activities JSON file at '{activities_json_path}'")

    path = Path(activities_json_path)
    if not path.is_file():
        raise FileNotFoundError(f"Activities JSON file not found at '{activities_json_path}'")

    with path.open('r', encoding='utf-8') as f:
        try:
            data = json.load(f)
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON format in activities file: {e}")

    # Check overall structure
    if not isinstance(data, dict):
        raise ValueError("Activities JSON file must be a dictionary with 'general' and 'timeline' sections")

    if "timeline" not in data:
        raise ValueError("Activities JSON file must contain a 'timeline' section")

    timeline = data["timeline"]
    if not isinstance(timeline, dict):
        raise ValueError("'timeline' must be a dictionary")

    # Track all codes for uniqueness
    all_codes = set()

    # Validate each timeline section (primary, digitalmediause, device, etc.)
    for section_name, section_data in timeline.items():
        if not isinstance(section_data, dict):
            raise ValueError(f"Section '{section_name}' must be a dictionary")

        # Check required section fields
        if "categories" not in section_data:
            raise ValueError(f"Section '{section_name}' must contain 'categories'")

        categories = section_data["categories"]
        if not isinstance(categories, list):
            raise ValueError(f"Categories in section '{section_name}' must be a list")

        # Validate each category
        for category_idx, category in enumerate(categories):
            if not isinstance(category, dict):
                raise ValueError(f"Category {category_idx} in section '{section_name}' must be a dictionary")

            if "activities" not in category:
                raise ValueError(f"Category {category_idx} in section '{section_name}' must contain 'activities'")

            activities = category["activities"]
            if not isinstance(activities, list):
                raise ValueError(f"Activities in category {category_idx} in section '{section_name}' must be a list")

            # Track names within this category for uniqueness
            category_activity_names = set()

            # Validate each activity in the category
            for activity_idx, activity in enumerate(activities):
                if not isinstance(activity, dict):
                    raise ValueError(f"Activity {activity_idx} in category {category_idx} in section '{section_name}' must be a dictionary")

                # Check required fields
                required_fields = {"name", "code", "label"}
                missing_fields = required_fields - activity.keys()
                if missing_fields:
                    raise ValueError(f"Activity '{activity.get('name', f'index {activity_idx}')}' in category {category_idx} in section '{section_name}' is missing required fields: {missing_fields}")

                # Validate field types and non-empty
                name = activity["name"]
                code = activity["code"]
                label = activity["label"]

                if not isinstance(name, str) or not name.strip():
                    raise ValueError(f"Activity name must be a non-empty string in activity '{name}'")

                if not isinstance(code, int):
                    raise ValueError(f"Activity code must be an integer in activity '{name}'")

                if not isinstance(label, str) or not label.strip():
                    raise ValueError(f"Activity label must be a non-empty string in activity '{name}'")

                # Check code uniqueness across entire file
                if code in all_codes:
                    raise ValueError(f"Duplicate code {code} found in activity '{name}'")
                all_codes.add(code)

                # Check name uniqueness within category
                if name in category_activity_names:
                    raise ValueError(f"Duplicate activity name '{name}' within the same category in section '{section_name}'")
                category_activity_names.add(name)

                # Validate childItems if they exist
                if "childItems" in activity:
                    child_items = activity["childItems"]
                    if not isinstance(child_items, list):
                        raise ValueError(f"childItems must be a list in activity '{name}'")

                    # Track names within child items for uniqueness
                    child_item_names = set()

                    for child_idx, child in enumerate(child_items):
                        if not isinstance(child, dict):
                            raise ValueError(f"Child item {child_idx} in activity '{name}' must be a dictionary")

                        # Check required fields for child items
                        child_missing_fields = required_fields - child.keys()
                        if child_missing_fields:
                            raise ValueError(f"Child item {child_idx} in activity '{name}' is missing required fields: {child_missing_fields}")

                        # Validate child field types and non-empty
                        child_name = child["name"]
                        child_code = child["code"]
                        child_label = child["label"]

                        if not isinstance(child_name, str) or not child_name.strip():
                            raise ValueError(f"Child activity name must be a non-empty string in child '{child_name}' of activity '{name}'")

                        if not isinstance(child_code, int):
                            raise ValueError(f"Child activity code must be an integer in child '{child_name}' of activity '{name}'")

                        if not isinstance(child_label, str) or not child_label.strip():
                            raise ValueError(f"Child activity label must be a non-empty string in child '{child_name}' of activity '{name}'")

                        # Check code uniqueness across entire file
                        if child_code in all_codes:
                            raise ValueError(f"Duplicate code {child_code} found in child activity '{child_name}' of '{name}'")
                        all_codes.add(child_code)

                        # Check name uniqueness within parent activity's children
                        if child_name in child_item_names:
                            raise ValueError(f"Duplicate child activity name '{child_name}' within activity '{name}'")
                        child_item_names.add(child_name)

    logger.info(f"Activities JSON file validation passed. Found {len(all_codes)} unique activity codes.")

def report_on_db_contents():
    """Report on existing studies and their entry names in the database"""
    logger.info("Reporting on database contents:")
    with Session(engine) as session:
        studies = session.exec(select(Study)).all()
        if not studies:
            logger.info("No studies found in the database.")
            return

        for study in studies:
            logger.info(f"Study: {study.name} (short: {study.name_short}, id: {study.id})")
            entry_names = session.exec(
                select(StudyEntryName).where(StudyEntryName.study_id == study.id)
            ).all()
            for entry in entry_names:
                logger.info(f" - Entry: {entry.entry_name} (Index: {entry.entry_index})")

        time_use_entries = session.exec(select(TimeuseEntry)).all()
        logger.info(f"Total time use entries in database: {len(time_use_entries)}")

        # report for each time_use_entry the fields participant_id, study_id, study_name_short, daily_entry_index
        for entry in time_use_entries:
            study = session.get(Study, entry.study_id)
            study_name_short = study.name_short if study else "Unknown"
            logger.info(f"Entry: participant_id={entry.participant_id}, study_id={entry.study_id}, study_name_short={study_name_short}, daily_entry_index={entry.daily_entry_index}")



def create_config_file_studies(config_path: str, validate_json: bool = True):
    """Create studies from configuration file"""

    config = load_studies_config(config_path)    # will raise exception if invalid, which is fine: that file is required

    logger.info(f"Checking whether studies need to be created based on config file at '{config_path}'")

    with Session(engine) as session:
        for study_config in config.studies:

            if validate_json:
                logger.info(f"Validating activities JSON file for study '{study_config.name_short}' at path '{study_config.activities_json_file}'")
                validate_activities_json_file(study_config.activities_json_file)

            # Check if study already exists
            existing_study = session.exec(
                select(Study).where(Study.name_short == study_config.name_short)
            ).first()

            if not existing_study:
                # Create study
                study = Study(
                    name=study_config.name,
                    name_short=study_config.name_short,
                    description=study_config.description
                )
                session.add(study)
                session.flush()  # Flush to get the ID without committing

                # Create entry names
                for entry_index, entry_name in enumerate(study_config.entry_names):
                    study_entry = StudyEntryName(
                        study_id=study.id,
                        entry_index=entry_index,
                        entry_name=entry_name
                    )
                    session.add(study_entry)

                logger.info(f"Created study: {study_config.name}")
            else:
                logger.info(f"Study already exists: '{study_config.name_short}' with long name: '{study_config.name}'")

        session.commit()


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session