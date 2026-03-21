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
        assert f'Participants in "{study_name_short}"' in selected_page.text

        assign_response = await client.post(
            f"{BASE_URL}/api/admin/studies/{study_name_short}/assign-participants",
            json={"participant_ids": [participant_keep, participant_remove]},
            auth=ADMIN_AUTH,
        )
        assert assign_response.status_code == 200
        assign_data = assign_response.json()
        assert "summary" in assign_data
        assert assign_data["summary"]["created_and_assigned"] + assign_data["summary"]["already_existed_and_assigned"] >= 2

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
