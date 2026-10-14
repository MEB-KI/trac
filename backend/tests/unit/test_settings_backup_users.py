"""Tests for the read-only backup account configuration in `TUD_API_BACKUP_USERS`.

Backup accounts may only call the three extraction endpoints. Their credentials
are validated as strictly as the scientist ones, and the parser deliberately
rejects unknown keys so that a mistaken ``studies`` list (which this account
type does not honour) fails loudly instead of silently granting server-wide
access.
"""

import pytest

from o_timeusediary_backend.settings import TUDBackendSettings


def _set_admin_env(monkeypatch):
    monkeypatch.setenv("TUD_API_ADMIN_USERNAME", "super_admin")
    monkeypatch.setenv("TUD_API_ADMIN_PASSWORD", "super_password")


def _clear_account_env(monkeypatch):
    monkeypatch.delenv("TUD_API_SCIENTISTS", raising=False)
    monkeypatch.delenv("TUD_API_BACKUP_USERS", raising=False)


def test_backup_users_unset_yields_empty_configuration(monkeypatch):
    _clear_account_env(monkeypatch)
    _set_admin_env(monkeypatch)

    settings = TUDBackendSettings()

    assert settings.backup_users == []
    assert settings.backup_names == []
    assert settings.backup_credentials == []

    # No backup accounts configured is a valid configuration.
    settings.validate_auth_configuration()


def test_backup_users_from_json_list(monkeypatch):
    _clear_account_env(monkeypatch)
    _set_admin_env(monkeypatch)
    monkeypatch.setenv(
        "TUD_API_BACKUP_USERS",
        (
            '[{"name": "backup_bot", "password": "pw_bot"},'
            ' {"name": "backup_two", "password": "pw_two"}]'
        ),
    )

    settings = TUDBackendSettings()

    assert settings.backup_names == ["backup_bot", "backup_two"]
    assert settings.backup_credentials == [
        ("backup_bot", "pw_bot"),
        ("backup_two", "pw_two"),
    ]

    settings.validate_auth_configuration()


@pytest.mark.parametrize(
    "raw_value, expected_message",
    [
        ("[not-json", "valid JSON list"),
        ('{"name": "backup_bot"}', "JSON list"),
        ('["backup_bot"]', "must be an object"),
        ('[{"password": "pw"}]', "non-empty string 'name'"),
        ('[{"name": "", "password": "pw"}]', "non-empty string 'name'"),
        ('[{"name": "backup_bot"}]', "non-empty string 'password'"),
        ('[{"name": "backup_bot", "password": ""}]', "non-empty string 'password'"),
        (
            '[{"name": "b", "password": "p"}, {"name": "b", "password": "q"}]',
            "duplicate backup user names",
        ),
        # Backup accounts are server-wide; a study scope is not part of the schema.
        (
            '[{"name": "backup_bot", "password": "pw", "studies": ["study_a"]}]',
            "unsupported field\\(s\\): studies",
        ),
        (
            '[{"name": "backup_bot", "passwd": "pw"}]',
            "unsupported field\\(s\\): passwd",
        ),
    ],
)
def test_backup_users_reject_invalid_entries(monkeypatch, raw_value, expected_message):
    _clear_account_env(monkeypatch)
    _set_admin_env(monkeypatch)
    monkeypatch.setenv("TUD_API_BACKUP_USERS", raw_value)

    settings = TUDBackendSettings()

    with pytest.raises(ValueError, match=expected_message):
        _ = settings.backup_users


def test_scientist_entries_reject_unknown_keys_as_well(monkeypatch):
    """The strictness applies to both account lists, not just the new one."""
    _clear_account_env(monkeypatch)
    _set_admin_env(monkeypatch)
    monkeypatch.setenv(
        "TUD_API_SCIENTISTS", '[{"name": "alice", "password": "pw", "studys": ["a"]}]'
    )

    settings = TUDBackendSettings()

    with pytest.raises(ValueError, match="unsupported field\\(s\\): studys"):
        _ = settings.scientists


def test_validate_auth_configuration_rejects_backup_admin_name_overlap(monkeypatch):
    _clear_account_env(monkeypatch)
    monkeypatch.setenv("TUD_API_ADMIN_USERNAME", "shared_name")
    monkeypatch.setenv("TUD_API_ADMIN_PASSWORD", "super_password")
    monkeypatch.setenv(
        "TUD_API_BACKUP_USERS", '[{"name": "shared_name", "password": "pw"}]'
    )

    settings = TUDBackendSettings()

    with pytest.raises(ValueError, match="both as super admin .* and as backup user"):
        settings.validate_auth_configuration()


def test_validate_auth_configuration_rejects_backup_scientist_name_overlap(monkeypatch):
    _clear_account_env(monkeypatch)
    _set_admin_env(monkeypatch)
    monkeypatch.setenv(
        "TUD_API_SCIENTISTS", '[{"name": "shared_name", "password": "pw"}]'
    )
    monkeypatch.setenv(
        "TUD_API_BACKUP_USERS", '[{"name": "shared_name", "password": "pw2"}]'
    )

    settings = TUDBackendSettings()

    with pytest.raises(ValueError, match="both as scientist .* and as backup user"):
        settings.validate_auth_configuration()
