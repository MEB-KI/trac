import logging
import os
from pathlib import Path
from logging.handlers import RotatingFileHandler


def setup_logging():
    """Set up consistent logging configuration for the entire application"""
    logging.basicConfig(
        format="%(levelname)s: %(name)s: %(message)s",
        level=logging.INFO,
        datefmt="%Y-%m-%d %H:%M:%S",
    )


def get_admin_audit_logger() -> logging.Logger:
    """Return a dedicated logger for persistent admin action audit events."""
    logger_name = "tud.admin_audit"
    audit_logger = logging.getLogger(logger_name)
    audit_logger.setLevel(logging.INFO)
    audit_logger.propagate = False

    if audit_logger.handlers:
        return audit_logger

    log_file = os.getenv("TUD_ADMIN_AUDIT_LOG_FILE", "admin_actions.log")
    max_bytes = int(os.getenv("TUD_ADMIN_AUDIT_LOG_MAX_BYTES", str(5 * 1024 * 1024)))
    backup_count = int(os.getenv("TUD_ADMIN_AUDIT_LOG_BACKUP_COUNT", "10"))

    log_path = Path(log_file).expanduser()
    log_path.parent.mkdir(parents=True, exist_ok=True)

    handler = RotatingFileHandler(
        filename=str(log_path),
        maxBytes=max_bytes,
        backupCount=backup_count,
        encoding="utf-8",
    )
    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    handler.setFormatter(formatter)
    audit_logger.addHandler(handler)

    return audit_logger
