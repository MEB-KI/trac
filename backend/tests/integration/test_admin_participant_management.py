import os
import uuid

import httpx
import pytest

from o_timeusediary_backend.settings import settings


BASE_SCHEME = os.getenv("TUD_BASE_SCHEME", "http://localhost:3000")
BASE_URL = f"{BASE_SCHEME}/" + settings.rootpath.strip("/")
ADMIN_AUTH = (settings.admin_username, settings.admin_password)


@pytest.mark.asyncio
async def test_admin_participant_management_page_and_actions_work():
    study_name_short = "default"
    participant_keep = f"it_pm_keep_{uuid.uuid4().hex[:8]}"
    participant_remove = f"it_pm_remove_{uuid.uuid4().hex[:8]}"

    async with httpx.AsyncClient() as client:
        unauthorized_page = await client.get(f"{BASE_URL}/admin/participant-management")
        assert unauthorized_page.status_code == 401

        page_response = await client.get(
            f"{BASE_URL}/admin/participant-management",
            auth=ADMIN_AUTH,
        )
        assert page_response.status_code == 200
        assert "Participant Management" in page_response.text

        selected_page = await client.get(
            f"{BASE_URL}/admin/participant-management",
            params={"study_name_short": study_name_short},
            auth=ADMIN_AUTH,
        )
        assert selected_page.status_code == 200
        assert f'Participants in study {study_name_short}' in selected_page.text

        assign_response = await client.post(
            f"{BASE_URL}/api/admin/studies/{study_name_short}/assign-participants",
            json={"participant_ids": [participant_keep, participant_remove]},
            auth=ADMIN_AUTH,
        )
        assert assign_response.status_code == 200
        assign_data = assign_response.json()
        assert "summary" in assign_data
        assert (
            assign_data["summary"]["created_and_assigned"]
            + assign_data["summary"]["already_existed_and_assigned"]
            >= 2
        )

        after_assign_page = await client.get(
            f"{BASE_URL}/admin/participant-management",
            params={"study_name_short": study_name_short},
            auth=ADMIN_AUTH,
        )
        assert after_assign_page.status_code == 200
        assert participant_keep in after_assign_page.text
        assert participant_remove in after_assign_page.text

        remove_response = await client.delete(
            f"{BASE_URL}/api/admin/studies/{study_name_short}/participants/{participant_remove}",
            auth=ADMIN_AUTH,
        )
        assert remove_response.status_code == 200
        remove_data = remove_response.json()
        assert remove_data["participant_id"] == participant_remove

        after_remove_page = await client.get(
            f"{BASE_URL}/admin/participant-management",
            params={"study_name_short": study_name_short},
            auth=ADMIN_AUTH,
        )
        assert after_remove_page.status_code == 200
        assert participant_keep in after_remove_page.text
        assert participant_remove not in after_remove_page.text


    @pytest.mark.asyncio
    async def test_admin_participant_management_external_tasks_ui():
        study_name_short = "adult_pilot_de2"

        async with httpx.AsyncClient() as client:
            page_response = await client.get(
                f"{BASE_URL}/admin/participant-management",
                params={"study_name_short": study_name_short},
                auth=ADMIN_AUTH,
            )
            assert page_response.status_code == 200
            # The CSV upload card title should be present
            assert "Add participants and task tokens" in page_response.text
            # The configured external task keys should be visible
            assert "depression_survey" in page_response.text
            assert "payment_info" in page_response.text


    @pytest.mark.asyncio
    async def test_admin_delete_tokens_preview_and_commit_scoped():
        study_name_short = "adult_pilot_de2"
        # Use values unlikely to exist to exercise 'not found' branch
        sample_pids = [f"it_del_preview_{uuid.uuid4().hex[:6]}"]
        sample_tokens = [f"tok_del_preview_{uuid.uuid4().hex[:6]}"]

        async with httpx.AsyncClient() as client:
            # Preview by pid
            resp = await client.post(
                f"{BASE_URL}/api/admin/studies/{study_name_short}/delete-tokens/by-pid/preview",
                json={"task_key": "depression_survey", "participant_ids": sample_pids},
                auth=ADMIN_AUTH,
            )
            assert resp.status_code == 200
            data = resp.json()
            assert "total_input" in data

            # Commit by pid (should be harmless, 0 deleted)
            resp2 = await client.post(
                f"{BASE_URL}/api/admin/studies/{study_name_short}/delete-tokens/by-pid/commit",
                json={"task_key": "depression_survey", "participant_ids": sample_pids},
                auth=ADMIN_AUTH,
            )
            assert resp2.status_code == 200
            data2 = resp2.json()
            assert "deleted" in data2

            # Preview by token
            resp3 = await client.post(
                f"{BASE_URL}/api/admin/studies/{study_name_short}/delete-tokens/by-token/preview",
                json={"task_key": "depression_survey", "tokens": sample_tokens},
                auth=ADMIN_AUTH,
            )
            assert resp3.status_code == 200
            data3 = resp3.json()
            assert "total_input" in data3

            # Commit by token
            resp4 = await client.post(
                f"{BASE_URL}/api/admin/studies/{study_name_short}/delete-tokens/by-token/commit",
                json={"task_key": "depression_survey", "tokens": sample_tokens},
                auth=ADMIN_AUTH,
            )
            assert resp4.status_code == 200
            data4 = resp4.json()
            assert "deleted" in data4


@pytest.mark.asyncio
async def test_admin_generate_tokens_creates_assignments():
    """Generate tokens for a study with external tasks and verify assignments."""
    study_name_short = "adult_pilot_de2"
    # Use a unique participant that won't collide with other tests
    pid = f"it_gen_{uuid.uuid4().hex[:8]}"

    async with httpx.AsyncClient() as client:
        # First assign a participant to the study
        assign_resp = await client.post(
            f"{BASE_URL}/api/admin/studies/{study_name_short}/assign-participants",
            json={"participant_ids": [pid]},
            auth=ADMIN_AUTH,
        )
        assert assign_resp.status_code == 200

        # Now generate tokens
        gen_resp = await client.post(
            f"{BASE_URL}/api/admin/studies/{study_name_short}/generate-tokens",
            auth=ADMIN_AUTH,
        )
        assert gen_resp.status_code == 200
        gen_data = gen_resp.json()
        assert gen_data["ok"] is True
        summary = gen_data["summary"]
        assert summary["tokens_generated"] >= 1
        assert summary["participants_in_study"] >= 1

        # Second call should skip (participant already has tokens)
        gen_resp2 = await client.post(
            f"{BASE_URL}/api/admin/studies/{study_name_short}/generate-tokens",
            auth=ADMIN_AUTH,
        )
        assert gen_resp2.status_code == 200
        gen_data2 = gen_resp2.json()
        assert gen_data2["summary"]["tokens_generated"] == 0
        assert gen_data2["summary"]["tokens_skipped_existing"] >= 1


@pytest.mark.asyncio
async def test_admin_generate_tokens_study_not_found():
    """Call generate-tokens for a non-existent study."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{BASE_URL}/api/admin/studies/nonexistent_study/generate-tokens",
            auth=ADMIN_AUTH,
        )
        assert resp.status_code == 404


@pytest.mark.asyncio
async def test_admin_generate_tokens_no_external_tasks():
    """Call generate-tokens for a study without external tasks."""
    study_name_short = "default"

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{BASE_URL}/api/admin/studies/{study_name_short}/generate-tokens",
            auth=ADMIN_AUTH,
        )
        assert resp.status_code == 400


@pytest.mark.asyncio
async def test_admin_export_tokens_csv_includes_participants():
    """Export tokens CSV for a study with external tasks and verify content."""
    study_name_short = "adult_pilot_de2"
    pid = f"it_exp_{uuid.uuid4().hex[:8]}"

    async with httpx.AsyncClient() as client:
        # Assign participant and generate tokens first
        await client.post(
            f"{BASE_URL}/api/admin/studies/{study_name_short}/assign-participants",
            json={"participant_ids": [pid]},
            auth=ADMIN_AUTH,
        )
        await client.post(
            f"{BASE_URL}/api/admin/studies/{study_name_short}/generate-tokens",
            auth=ADMIN_AUTH,
        )

        # Export CSV
        csv_resp = await client.get(
            f"{BASE_URL}/api/admin/studies/{study_name_short}/export-tokens-csv",
            auth=ADMIN_AUTH,
        )
        assert csv_resp.status_code == 200
        assert csv_resp.headers["content-type"].startswith("text/csv")
        assert "attachment" in csv_resp.headers.get("content-disposition", "")

        text = csv_resp.text
        assert "pid" in text
        assert pid in text
        # Should have at least depression_survey and payment_info columns
        assert "depression_survey" in text
        assert "payment_info" in text


@pytest.mark.asyncio
async def test_admin_export_tokens_csv_no_external_tasks():
    """Export CSV for a study without external tasks — only pid column."""
    study_name_short = "default"

    async with httpx.AsyncClient() as client:
        csv_resp = await client.get(
            f"{BASE_URL}/api/admin/studies/{study_name_short}/export-tokens-csv",
            auth=ADMIN_AUTH,
        )
        assert csv_resp.status_code == 200
        text = csv_resp.text
        lines = text.strip().split("\n")
        header = lines[0].strip()
        # Only pid column, no task columns
        assert header == "pid"
        assert len(lines) >= 1


@pytest.mark.asyncio
async def test_admin_export_tokens_csv_unauthorized():
    """CSV export should require authentication."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{BASE_URL}/api/admin/studies/default/export-tokens-csv",
        )
        assert resp.status_code == 401
