"""Where the backend keeps files: local disk (dev, tests) or an S3 bucket (production).

Callers name a file by a key such as "feedback/3f2a.png" or "ocr/<stem>/page-001.md" and never
see a path, so the same code runs on a laptop and on a host whose disk is wiped on restart.

    STORAGE_BACKEND=local   files under backend/var/<key>  (the default)
    STORAGE_BACKEND=s3      files in S3_BUCKET at <key>    (Amazon S3, or any S3-compatible store
                                                            via S3_ENDPOINT_URL)

The bucket must stay private: student photos are minors' data, so files are always served
through the backend (which checks the admin's login), never by public bucket URLs.
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path, PurePosixPath
from typing import Protocol

from app.core.config import BACKEND_DIR, get_settings


class StorageError(Exception):
    pass


def _check_key(key: str) -> str:
    """Keys are relative POSIX paths; refuse anything that could step outside the store."""
    p = PurePosixPath(key)
    if not key or p.is_absolute() or ".." in p.parts or "\\" in key:
        raise StorageError(f"bad storage key: {key!r}")
    return key


class FileStorage(Protocol):
    def put(self, key: str, data: bytes, content_type: str | None = None) -> None: ...
    def get(self, key: str) -> bytes | None: ...          # None = no such file
    def delete(self, key: str) -> None: ...               # deleting a missing file is fine
    def list(self, prefix: str) -> list[str]: ...         # keys under prefix, sorted


class LocalStorage:
    def __init__(self, root: Path):
        self.root = Path(root)

    def _path(self, key: str) -> Path:
        return self.root / _check_key(key)

    def put(self, key: str, data: bytes, content_type: str | None = None) -> None:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)

    def get(self, key: str) -> bytes | None:
        path = self._path(key)
        return path.read_bytes() if path.is_file() else None

    def delete(self, key: str) -> None:
        self._path(key).unlink(missing_ok=True)

    def list(self, prefix: str) -> list[str]:
        base = self._path(prefix.rstrip("/"))
        if not base.is_dir():
            return []
        return sorted(p.relative_to(self.root).as_posix() for p in base.rglob("*") if p.is_file())


class S3Storage:
    def __init__(self, bucket: str, *, region: str | None = None, endpoint_url: str | None = None,
                 access_key_id: str | None = None, secret_access_key: str | None = None):
        import boto3  # only needed when S3 is switched on

        # No keys given = boto3's own lookup (AWS_* environment variables, ~/.aws, or the
        # server's IAM role), which is the safest option on AWS itself.
        self._s3 = boto3.client("s3", region_name=region, endpoint_url=endpoint_url,
                                aws_access_key_id=access_key_id, aws_secret_access_key=secret_access_key)
        self.bucket = bucket

    def put(self, key: str, data: bytes, content_type: str | None = None) -> None:
        extra = {"ContentType": content_type} if content_type else {}
        self._s3.put_object(Bucket=self.bucket, Key=_check_key(key), Body=data,
                            ServerSideEncryption="AES256", **extra)

    def get(self, key: str) -> bytes | None:
        from botocore.exceptions import ClientError

        try:
            return self._s3.get_object(Bucket=self.bucket, Key=_check_key(key))["Body"].read()
        except ClientError as e:
            # TODO(human): tell "file isn't there" apart from every other S3 failure.
            raise

    def delete(self, key: str) -> None:
        self._s3.delete_object(Bucket=self.bucket, Key=_check_key(key))

    def list(self, prefix: str) -> list[str]:
        keys: list[str] = []
        for page in self._s3.get_paginator("list_objects_v2").paginate(Bucket=self.bucket, Prefix=_check_key(prefix)):
            keys += [o["Key"] for o in page.get("Contents", [])]
        return sorted(keys)


@lru_cache
def get_storage() -> FileStorage:
    s = get_settings()
    if s.storage_backend == "s3":
        if not s.s3_bucket:
            raise StorageError("STORAGE_BACKEND=s3 needs S3_BUCKET")
        return S3Storage(s.s3_bucket, region=s.s3_region, endpoint_url=s.s3_endpoint_url,
                         access_key_id=s.aws_access_key_id,
                         secret_access_key=s.aws_secret_access_key.get_secret_value() if s.aws_secret_access_key else None)
    return LocalStorage(BACKEND_DIR / "var")
