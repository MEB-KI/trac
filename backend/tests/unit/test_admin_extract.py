"""Unit tests for the admin backup extraction endpoints.

The endpoints are invoked directly with an in-memory SQLite session and a fake
identity, so the tests pin down the query behaviour and the row grain without
needing a running server. Two properties are load-bearing for the backup
workflow and are asserted explicitly:

* ``submitted`` is the definition of "done" and comes from
  ``study_submitted_at`` (external tasks are ignored), and
* an empty extract is a 200 with zero records, never a 404.

Authorization (super-admin only) is covered by the integration suite.
"""

import asyncio
import json
import os
from datetime import datetime, timezone

os.environ.setdefault("TUD_DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("TUD_ALLOWED_ORIGINS", '["http://localhost:3000"]')

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel

from o_timeusediary_backend import api
from o_timeusediary_backend.api_deps.admin_auth import AdminIdentity, ROLE_SUPER_ADMIN
from o_timeusediary_backend.models import (
    Activity,
    DayLabel,
    Participant,
    Study,
    StudyActivityConfigBlob,
    StudyParticipant,
    Timeline,
)

SUBMITTED_AT = datetime(2026, 3, 2, 9, 30, tzinfo=timezone.utc)
MIN_COVERAGE = 600


@pytest.fixture()
def session():
    """A fresh in-memory schema per test (one shared connection)."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as db_session:
        yield db_session


@pytest.fixture()
def seeded(session):
    """One study with two day labels, a min_coverage timeline and three participants.

    ``p-done``     completed both days and submitted.
    ``p-partial``  completed only the first day (never submitted).
    ``p-empty``    was registered but never logged anything.
    """
    study = Study(
        name="Extraction Study",
        name_short="extract_study",
        activities_json_url="file:///tmp/activities.json",
        data_collection_start=datetime(2026, 1, 1),
        data_collection_end=datetime(2026, 12, 31),
    )
    session.add(study)
    session.commit()
    session.refresh(study)

    monday = DayLabel(
        study_id=study.id,
        name="monday",
        display_order=0,
        display_name="Monday",
        display_names={"en": "Monday", "de": "Montag"},
    )
    tuesday = DayLabel(
        study_id=study.id,
        name="tuesday",
        display_order=1,
        display_name="Tuesday",
    )
    timeline = Timeline(
        study_id=study.id,
        name="primary",
        display_name="Main Activity",
        mode="single-choice",
        min_coverage=MIN_COVERAGE,
    )
    session.add(monday)
    session.add(tuesday)
    session.add(timeline)
    session.commit()
    session.refresh(monday)
    session.refresh(tuesday)
    session.refresh(timeline)

    session.add(
        StudyActivityConfigBlob(
            study_id=study.id,
            language="en",
            activities_json_data={"general": {"app_name": "Extraction Study"}},
            content_hash="hash-en",
        )
    )

    for participant_id, submitted_at in (
        ("p-done", SUBMITTED_AT),
        ("p-partial", None),
        ("p-empty", None),
    ):
        session.add(Participant(id=participant_id))
        session.add(
            StudyParticipant(
                study_id=study.id,
                participant_id=participant_id,
                study_submitted_at=submitted_at,
            )
        )

    def add_full_day(participant_id: str, day_label_id: int) -> None:
        session.add(
            Activity(
                study_id=study.id,
                participant_id=participant_id,
                day_label_id=day_label_id,
                timeline_id=timeline.id,
                activity_code=100,
                start_minutes=0,
                end_minutes=MIN_COVERAGE,
                activity_name="Activity 100",
                activity_path_frontend="primary: Main Activity > Activity 100",
                category="General",
            )
        )

    add_full_day("p-done", monday.id)
    add_full_day("p-done", tuesday.id)
    add_full_day("p-partial", monday.id)

    session.commit()
    return study


def _identity() -> AdminIdentity:
    return AdminIdentity(username="rootadmin", role=ROLE_SUPER_ADMIN)


def _payload(response) -> dict:
    assert response.status_code == 200
    return json.loads(response.body)


def _call_participants(session, **overrides):
    kwargs = {
        "study": None,
        "submitted": None,
        "submitted_after": None,
        "format": "json",
        "identity": _identity(),
        "session": session,
    }
    kwargs.update(overrides)
    return asyncio.run(api.admin_extract_participants(**kwargs))


def _call_activities(session, **overrides):
    kwargs = {
        "study": None,
        "participant": None,
        "format": "json",
        "identity": _identity(),
        "session": session,
    }
    kwargs.update(overrides)
    return asyncio.run(api.admin_extract_activities(**kwargs))


def _call_studies(session, **overrides):
    kwargs = {"study": None, "identity": _identity(), "session": session}
    kwargs.update(overrides)
    return asyncio.run(api.admin_extract_studies(**kwargs))


# ─── participants ────────────────────────────────────────────────────────────


def test_participants_extract_has_one_row_per_participant_per_study(session, seeded):
    payload = _payload(_call_participants(session))
    records = payload["data"]

    assert payload["metadata"]["total_records"] == 3
    # Sorted by participant_id, and registration-only participants are present.
    assert [row["participant_id"] for row in records] == [
        "p-done",
        "p-empty",
        "p-partial",
    ]


def test_submitted_participant_is_reported_as_complete(session, seeded):
    records = _payload(_call_participants(session))["data"]
    done = next(row for row in records if row["participant_id"] == "p-done")

    assert done["submitted"] is True
    # SQLite drops tzinfo, PostgreSQL keeps it: compare wall time, not the
    # serialized string.
    assert datetime.fromisoformat(done["study_submitted_at"]).replace(
        tzinfo=None
    ) == SUBMITTED_AT.replace(tzinfo=None)
    assert done["total_days"] == 2
    assert done["days_with_data"] == 2
    assert done["days_meeting_min_coverage"] == 2
    assert done["all_days_meet_min_coverage"] is True
    assert done["day_0_status"] == "complete"
    assert done["day_1_status"] == "complete"
    assert done["study_name_short"] == "extract_study"


def test_partial_participant_reports_the_missing_day(session, seeded):
    records = _payload(_call_participants(session))["data"]
    partial = next(row for row in records if row["participant_id"] == "p-partial")

    assert partial["submitted"] is False
    assert partial["study_submitted_at"] is None
    assert partial["days_meeting_min_coverage"] == 1
    assert partial["all_days_meet_min_coverage"] is False
    assert partial["day_0_status"] == "complete"
    assert partial["day_1_status"] == "empty"


def test_participant_without_data_still_reports_every_day(session, seeded):
    records = _payload(_call_participants(session))["data"]
    empty = next(row for row in records if row["participant_id"] == "p-empty")

    assert empty["total_days"] == 2
    assert empty["days_with_data"] == 0
    assert empty["day_0_status"] == "empty"
    assert empty["day_1_status"] == "empty"


def test_participants_can_be_filtered_by_submission_status(session, seeded):
    submitted = _payload(_call_participants(session, submitted=True))["data"]
    assert [row["participant_id"] for row in submitted] == ["p-done"]

    pending = _payload(_call_participants(session, submitted=False))["data"]
    assert [row["participant_id"] for row in pending] == ["p-empty", "p-partial"]


def test_submitted_after_is_a_lower_bound_and_empty_is_not_an_error(session, seeded):
    earlier = datetime(2026, 1, 1, tzinfo=timezone.utc)
    assert [
        row["participant_id"]
        for row in _payload(_call_participants(session, submitted_after=earlier))["data"]
    ] == ["p-done"]

    later = datetime(2026, 6, 1, tzinfo=timezone.utc)
    payload = _payload(_call_participants(session, submitted_after=later))
    assert payload["data"] == []
    assert payload["metadata"]["total_records"] == 0


def test_participants_csv_and_unknown_format(session, seeded):
    csv_response = _call_participants(session, format="csv")
    assert csv_response.status_code == 200
    assert csv_response.body.decode().splitlines()[0].startswith("all_days_meet")

    with pytest.raises(HTTPException) as excinfo:
        _call_participants(session, format="xml")
    assert excinfo.value.status_code == 400


def test_unknown_study_filter_is_rejected(session, seeded):
    with pytest.raises(HTTPException) as excinfo:
        _call_participants(session, study=["nope"])
    assert excinfo.value.status_code == 404


# ─── activities ──────────────────────────────────────────────────────────────


def test_activities_extract_has_one_row_per_activity_without_participant_columns(
    session, seeded
):
    payload = _payload(_call_activities(session))
    records = payload["data"]

    assert payload["metadata"]["total_records"] == 3
    assert sorted(row["participant_id"] for row in records) == [
        "p-done",
        "p-done",
        "p-partial",
    ]
    # The whole point of the endpoint: no participant-level duplication.
    assert not {
        "submitted",
        "study_submitted_at",
        "day_0_status",
        "participant_consent_given",
    } & set(records[0])

    row = next(
        r for r in records if r["participant_id"] == "p-done" and r["day_label_index"] == 1
    )
    assert row["day_label"] == "tuesday"
    assert row["timeline_name"] == "primary"
    assert row["activity_code"] == 100
    assert row["duration_minutes"] == MIN_COVERAGE
    assert row["start_time"] == "00:00"
    assert row["end_time"] == "10:00"


def test_activities_can_be_filtered_by_participant(session, seeded):
    records = _payload(_call_activities(session, participant=["p-partial"]))["data"]

    assert len(records) == 1
    assert records[0]["participant_id"] == "p-partial"
    assert records[0]["day_label_index"] == 0


def test_activities_empty_result_is_not_an_error(session):
    payload = _payload(_call_activities(session))

    assert payload["data"] == []
    assert payload["metadata"]["total_records"] == 0


# ─── studies ─────────────────────────────────────────────────────────────────


def test_studies_extract_is_self_contained(session, seeded):
    payload = _payload(_call_studies(session))
    records = payload["data"]

    assert payload["metadata"]["total_records"] == 1
    study = records[0]
    assert study["name_short"] == "extract_study"

    assert [label["name"] for label in study["day_labels"]] == ["monday", "tuesday"]
    assert study["day_labels"][0]["display_names"]["de"] == "Montag"

    assert study["timelines"][0]["name"] == "primary"
    assert study["timelines"][0]["min_coverage"] == MIN_COVERAGE

    assert study["activity_configs"][0]["language"] == "en"
    assert study["activity_configs"][0]["activities_json_data"]["general"][
        "app_name"
    ] == "Extraction Study"


def test_studies_can_be_filtered_and_empty_database_is_not_an_error(session, seeded):
    assert len(_payload(_call_studies(session, study=["extract_study"]))["data"]) == 1

    with pytest.raises(HTTPException) as excinfo:
        _call_studies(session, study=["nope"])
    assert excinfo.value.status_code == 404
