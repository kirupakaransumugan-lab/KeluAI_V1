from datetime import datetime, timezone


def utcnow() -> datetime:
    # Stored as naive UTC: MySQL DATETIME has no time zone.
    return datetime.now(timezone.utc).replace(tzinfo=None, microsecond=0)
