import logging

from o_timeusediary_backend.logging_config import get_admin_audit_logger


def test_admin_audit_logger_writes_to_dedicated_file(tmp_path, monkeypatch):
    log_file = tmp_path / "admin_actions.log"
    monkeypatch.setenv("TUD_ADMIN_AUDIT_LOG_FILE", str(log_file))
    monkeypatch.setenv("TUD_ADMIN_AUDIT_LOG_MAX_BYTES", "1024")
    monkeypatch.setenv("TUD_ADMIN_AUDIT_LOG_BACKUP_COUNT", "2")

    # Reset handlers to allow test-specific reconfiguration.
    named_logger = logging.getLogger("tud.admin_audit")
    for handler in list(named_logger.handlers):
        named_logger.removeHandler(handler)
        handler.close()

    audit_logger = get_admin_audit_logger()
    audit_logger.info("Admin 'bernd' added 3 users to study 'xy'")

    assert log_file.exists()
    content = log_file.read_text(encoding="utf-8")
    assert "Admin 'bernd' added 3 users to study 'xy'" in content
