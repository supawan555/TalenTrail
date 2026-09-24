"""Unit tests for ``app/utils/file_storage.py``.

    unique_name(prefix, original_filename, default_ext) -> "prefix_<uuidhex><ext>"
    save_upload_file(upload_file, destination)          -> writes the stream, returns destination

Testing strategy
----------------
* ``unique_name`` is pure apart from ``uuid.uuid4()``; we patch that to a fixed
  value so the output string is predictable.
* ``save_upload_file`` copies ``upload_file.file`` to disk with
  ``shutil.copyfileobj`` and then closes the source in a ``finally``. We use a
  tiny spy object for ``.file`` (a real ``io.BytesIO`` would reject having its
  ``close`` attribute reassigned) and a ``tmp_path`` for the destination.
"""

from __future__ import annotations

import io

import pytest

from app.utils import file_storage

pytestmark = pytest.mark.unit


# ===========================================================================
# unique_name
# ===========================================================================
@pytest.fixture()
def fixed_uuid(monkeypatch: pytest.MonkeyPatch) -> None:
    """Make uuid.uuid4().hex deterministically equal to 'deadbeef'."""

    class _FixedUuid:
        hex = "deadbeef"

    monkeypatch.setattr(file_storage.uuid, "uuid4", lambda: _FixedUuid())


def test_unique_name_keeps_the_original_extension(fixed_uuid: None) -> None:
    """
    Scenario: The uploaded file is "myCV.pdf".
    Expected: "resume_deadbeef.pdf" - prefix, underscore, uuid hex, original ext.

    Arrange: uuid patched to 'deadbeef'.
    Act:     unique_name("resume", "myCV.pdf", ".bin").
    Assert:  == "resume_deadbeef.pdf".
    """
    assert file_storage.unique_name("resume", "myCV.pdf", ".bin") == "resume_deadbeef.pdf"


def test_unique_name_falls_back_to_default_ext_when_none_present(fixed_uuid: None) -> None:
    """
    Scenario: The original filename has no extension ("noext").
    Expected: The provided default_ext is used instead.

    Arrange: uuid patched.
    Act:     unique_name("resume", "noext", ".bin").
    Assert:  == "resume_deadbeef.bin".
    """
    assert file_storage.unique_name("resume", "noext", ".bin") == "resume_deadbeef.bin"


def test_unique_name_double_extension_keeps_only_the_last_segment(fixed_uuid: None) -> None:
    """
    Scenario: The original filename is "backup.tar.gz".
    Expected: os.path.splitext splits at the LAST dot only, so the extension is
              ".gz" (not ".tar.gz").

    Arrange: uuid patched.
    Act:     unique_name("archive", "backup.tar.gz", ".bin").
    Assert:  == "archive_deadbeef.gz".
    """
    assert file_storage.unique_name("archive", "backup.tar.gz", ".bin") == "archive_deadbeef.gz"


def test_unique_name_layout_is_prefix_underscore_uuid_ext(fixed_uuid: None) -> None:
    """
    Scenario: General shape check.
    Expected: exactly "<prefix>_<uuidhex><ext>".

    Arrange: uuid patched.
    Act:     unique_name("pfx", "f.txt", ".dat").
    Assert:  == "pfx_deadbeef.txt".
    """
    assert file_storage.unique_name("pfx", "f.txt", ".dat") == "pfx_deadbeef.txt"


# ===========================================================================
# save_upload_file
# ===========================================================================
class _SpyFile:
    """Minimal file-like object: supports read() and counts close() calls."""

    def __init__(self, data: bytes) -> None:
        self._buffer = io.BytesIO(data)
        self.close_calls = 0

    def read(self, *args) -> bytes:
        return self._buffer.read(*args)

    def close(self) -> None:
        self.close_calls += 1
        self._buffer.close()


class _FakeUpload:
    """Stands in for starlette's UploadFile - save_upload_file only uses .file."""

    def __init__(self, data: bytes) -> None:
        self.file = _SpyFile(data)


def test_save_upload_file_writes_the_stream_and_returns_the_path(tmp_path) -> None:
    """
    Scenario: Save an uploaded file to a fresh destination path.
    Expected: The bytes land on disk unchanged, and the function returns the
              destination path it was given.

    Arrange: a fake upload holding b"resume bytes"; destination inside tmp_path.
    Act:     save_upload_file(upload, destination).
    Assert:  return value == destination, and the file's contents match.
    """
    # Arrange
    upload = _FakeUpload(b"resume bytes")
    destination = str(tmp_path / "out.bin")

    # Act
    returned = file_storage.save_upload_file(upload, destination)

    # Assert
    assert returned == destination
    assert (tmp_path / "out.bin").read_bytes() == b"resume bytes"


def test_save_upload_file_closes_the_source_on_success(tmp_path) -> None:
    """
    Scenario: A successful save.
    Expected: The source handle (upload.file) is closed exactly once - leaving
              upload handles open leaks file descriptors under load.

    Arrange: fake upload; valid destination.
    Act:     save_upload_file(...).
    Assert:  upload.file.close_calls == 1.
    """
    upload = _FakeUpload(b"x")
    file_storage.save_upload_file(upload, str(tmp_path / "out.bin"))
    assert upload.file.close_calls == 1


def test_save_upload_file_closes_the_source_even_when_writing_fails(tmp_path) -> None:
    """
    Scenario: The destination directory does not exist, so open() raises
              FileNotFoundError.
    Expected: The exception propagates (the caller must know the save failed),
              but the source handle is STILL closed thanks to the finally block.

    Arrange: fake upload; destination inside a directory that was never created.
    Act:     save_upload_file(...) inside pytest.raises.
    Assert:  FileNotFoundError raised AND upload.file.close_calls == 1.
    """
    # Arrange
    upload = _FakeUpload(b"x")
    missing = tmp_path / "no_such_dir" / "out.bin"

    # Act / Assert
    with pytest.raises(FileNotFoundError):
        file_storage.save_upload_file(upload, str(missing))
    assert upload.file.close_calls == 1
