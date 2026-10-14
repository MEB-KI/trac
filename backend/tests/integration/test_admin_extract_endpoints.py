"""Integration tests for the admin backup extraction endpoints.

Covers the full workflow the endpoints exist for: a script polls
``/api/admin/participants`` for participants who have finished a study, then
pulls exactly their rows from ``/api/admin/activities`` and the reference data
from ``/api/admin/studies``.

Also pins the access rule: extraction is super-admin only. Scientists manage
their own studies; running server backups is not their job.
"""

import os
import uuid

import httpx
import pytest

from o_timeusediary_backend.settings import settings


BASE_SCHEME = os.getenv("TUD_BASE_SCHEME", "http://localhost:3000")
BASE_URL = f"{BASE_SCHEME}/" + settings.rootpath.strip("/")
ADMIN_AUTH = (settings.admin_username, settings.admin_password)

SCIENTISTS = settings.scientists
SCIENTIST_AUTH = (
    (SCIENTISTS[0]["name"], SCIENTISTS[0]["password"]) if SCIENTISTS else None
)

requires_scientist = pytest.mark.skipif(
    SCIENTIST_AUTH is None,
    reason="Needs a scientist in TUD_API_SCIENTISTS to verify super-admin-only access.",
)


def _minimal_activities_payload() -> dict:
    return {
        "general": {"app_name": "TRAC", "version": "1.0", "language": "en"},
        "timeline": {
            "primary": {
                "name": "Primary",
                "description": "",
                "mode": "single-choice",
                "min_coverage": 0,
                "categories": [
                    {
                        "name": "General",
                        "activities": [
                            {
                                "name": "Activity 100",
                                "code": 100,
                                "label": "activity-100",
                                "color": "#000000",
                                "childItems": [],
                            }
                        ],
                    }
                ],
            }
        },
    }


def _study_payload(study_name_short: str, participant_id: str) -> dict:
    """Single study, single day label, one pre-registered participant."""
    return {
        "mode": "create_only",
        "transaction_mode": "all_or_nothing",
        "studies": [
            {
                "name": f"Admin Extract {study_name_short}",
                "name_short": study_name_short,
                "description": "Integration test - admin extraction endpoints",
                "day_labels": [
                    {
                        "name": "monday",
                        "display_order": 0,
                        "display_names": {"en": "Monday"},
                    }
                ],
                "study_participant_ids": [participant_id],
                "allow_unlisted_participants": False,
                "default_language": "en",
                "supported_languages": ["en"],
                "activities_json_data": {"en": _minimal_activities_payload()},
                "data_collection_start": "2024-01-01T00:00:00Z",
                "data_collection_end": "2028-12-31T23:59:59Z",
            }
        ],
    }


@requires_scientist
@pytest.mark.asyncio
async def test_extraction_endpoints_are_super_admin_only():
    async with httpx.AsyncClient() as client:
        for path in ("studies", "participants", "activities"):
            response = await client.get(
                f"{BASE_URL}/api/admin/{path}",
                auth=SCIENTIST_AUTH,
            )
            assert response.status_code == 403, (path, response.text)
            assert response.json()["detail"]["code"] == "super_admin_required"


@pytest.mark.asyncio
async def test_submitted_participant_can_be_found_and_extracted():
    study_name_short = f"it_extract_{uuid.uuid4().hex[:8]}"
    participant_id = "p1"

    async with httpx.AsyncClient() as client:
        import_resp = await client.post(
            f"{BASE_URL}/api/admin/studies/import-config",
            json=_study_payload(study_name_short, participant_id),
            auth=ADMIN_AUTH,
        )
        assert import_resp.status_code == 200, import_resp.text

        try:
            # Fill in and submit the single day.
            save_resp = await client.post(
                f"{BASE_URL}/api/studies/{study_name_short}/participants/{participant_id}"
                f"/day_labels/monday/activities",
                json={
                    "activities": [
                        {
                            "timeline_key": "primary",
                            "activity": "Activity 100",
                            "category": "General",
                            "start_minutes": 0,
                            "end_minutes": 10,
                            "mode": "single-choice",
                            "code": 100,
                        }
                    ]
                },
            )
            assert save_resp.status_code == 200, save_resp.text

            submit_resp = await client.post(
                f"{BASE_URL}/api/studies/{study_name_short}/participants/{participant_id}/submit",
            )
            assert submit_resp.status_code == 200, submit_resp.text

            # 1. Poll target: who has finished?
            participants_resp = await client.get(
                f"{BASE_URL}/api/admin/participants",
                params={"study": study_name_short, "submitted": "true"},
                auth=ADMIN_AUTH,
            )
            assert participants_resp.status_code == 200, participants_resp.text
            participants = participants_resp.json()["data"]
            assert len(participants) == 1
            record = participants[0]
            assert record["participant_id"] == participant_id
            assert record["submitted"] is True
            assert record["study_submitted_at"] is not None
            assert record["total_days"] == 1
            assert record["days_meeting_min_coverage"] == 1
            assert record["all_days_meet_min_coverage"] is True
            assert record["day_0_status"] == "complete"

            # Nothing pending: an empty extract is a 200, not a 404.
            pending_resp = await client.get(
                f"{BASE_URL}/api/admin/participants",
                params={"study": study_name_short, "submitted": "false"},
                auth=ADMIN_AUTH,
            )
            assert pending_resp.status_code == 200
            assert pending_resp.json()["data"] == []
            assert pending_resp.json()["metadata"]["total_records"] == 0

            # 2. Pull exactly that participant's activity rows.
            activities_resp = await client.get(
                f"{BASE_URL}/api/admin/activities",
                params={"study": study_name_short, "participant": participant_id},
                auth=ADMIN_AUTH,
            )
            assert activities_resp.status_code == 200, activities_resp.text
            activities = activities_resp.json()["data"]
            assert len(activities) == 1
            activity = activities[0]
            assert activity["participant_id"] == participant_id
            assert activity["day_label"] == "monday"
            assert activity["timeline_name"] == "primary"
            assert activity["activity_code"] == 100
            assert activity["duration_minutes"] == 10
            # No participant-level duplication on activity rows.
            assert "submitted" not in activity
            assert "day_0_status" not in activity

            # 3. Reference data keeps the copy interpretable.
            studies_resp = await client.get(
                f"{BASE_URL}/api/admin/studies",
                params={"study": study_name_short},
                auth=ADMIN_AUTH,
            )
            assert studies_resp.status_code == 200, studies_resp.text
            studies = studies_resp.json()["data"]
            assert len(studies) == 1
            study = studies[0]
            assert study["name_short"] == study_name_short
            assert [label["name"] for label in study["day_labels"]] == ["monday"]
            assert study["timelines"][0]["name"] == "primary"
            assert study["activity_configs"][0]["language"] == "en"
        finally:
            delete_resp = await client.delete(
                f"{BASE_URL}/api/admin/studies/{study_name_short}",
                auth=ADMIN_AUTH,
            )
            assert delete_resp.status_code in {200, 404}


@pytest.mark.asyncio
async def test_unknown_study_filter_is_rejected():
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{BASE_URL}/api/admin/participants",
            params={"study": "definitely_not_a_study"},
            auth=ADMIN_AUTH,
        )
        assert response.status_code == 404, response.text
