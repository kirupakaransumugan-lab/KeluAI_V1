"""Images a student attaches to a tutor message (a photo of a question, a graph, their working).

They arrive as a data URL from the browser, which has already shrunk them. Nothing here trusts
the declared type: the bytes must start like the format they claim to be. Images are sent to
the model with that one message and never stored.
"""
from __future__ import annotations

import base64
import binascii
import re
from dataclasses import dataclass

MAX_BYTES = 3 * 1024 * 1024          # after decoding; the browser sends ~200-600 KB
_DATA_URL = re.compile(r"^data:(image/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$")


class BadImage(ValueError):
    """`code` is the API error code: bad_image or image_too_large."""

    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


@dataclass(frozen=True)
class Image:
    media_type: str      # image/jpeg | image/png | image/webp
    data: str            # base64, no whitespace

    @property
    def data_url(self) -> str:
        return f"data:{self.media_type};base64,{self.data}"


def _looks_like(media_type: str, raw: bytes) -> bool:
    if media_type == "image/jpeg":
        return raw[:3] == b"\xff\xd8\xff"
    if media_type == "image/png":
        return raw[:8] == b"\x89PNG\r\n\x1a\n"
    return raw[:4] == b"RIFF" and raw[8:12] == b"WEBP"


def parse_data_url(url: str) -> Image:
    m = _DATA_URL.match(url.strip())
    if not m:
        raise BadImage("bad_image")
    media_type, b64 = m.group(1), re.sub(r"\s+", "", m.group(2))
    if len(b64) * 3 // 4 > MAX_BYTES:
        raise BadImage("image_too_large")
    try:
        raw = base64.b64decode(b64, validate=True)
    except (binascii.Error, ValueError):
        raise BadImage("bad_image") from None
    if len(raw) > MAX_BYTES:
        raise BadImage("image_too_large")
    if not _looks_like(media_type, raw):
        raise BadImage("bad_image")
    return Image(media_type, b64)
