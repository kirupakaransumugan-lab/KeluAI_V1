"""The local file store: what S3 does in production, on disk for dev and tests."""
import pytest

from app.services.file_storage import LocalStorage, StorageError


def test_put_get_list_delete(tmp_path):
    store = LocalStorage(tmp_path)
    store.put("ocr/paper/page-002.md", b"two")
    store.put("ocr/paper/page-001.md", b"one")
    assert store.get("ocr/paper/page-001.md") == b"one"
    assert store.list("ocr/paper/") == ["ocr/paper/page-001.md", "ocr/paper/page-002.md"]
    store.delete("ocr/paper/page-001.md")
    store.delete("ocr/paper/page-001.md")          # already gone: still fine
    assert store.get("ocr/paper/page-001.md") is None
    assert store.list("nothing/here/") == []


@pytest.mark.parametrize("key", ["", "../secret", "kb/../../x", "/etc/passwd", "kb\\..\\x"])
def test_keys_cannot_leave_the_store(tmp_path, key):
    with pytest.raises(StorageError):
        LocalStorage(tmp_path).put(key, b"x")
