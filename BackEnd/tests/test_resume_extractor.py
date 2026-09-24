"""Unit tests for ``app/ml/resume_extractor.py``.

The module has three functions:

    clean_text(text)          - lowercase, drop punctuation (keep '+'), squeeze spaces
    extract_resume_text(path) - read a PDF with PyMuPDF ("fitz") -> str
    extract_resume_data(text) - regex out name / email / phone / skills

Testing strategy
----------------
* ``clean_text`` and ``extract_resume_data`` are pure string logic - call them
  directly with crafted inputs.
* ``extract_resume_data`` intersects words against ``KNOWN_SKILLS``, which is
  loaded from ``skills.txt`` at import. We ``monkeypatch`` it to a small known
  set so the assertions are stable no matter what that file contains.
* ``extract_resume_text`` does file I/O through ``fitz``; we monkeypatch
  ``resume_extractor.fitz.open`` with a tiny fake document.
"""

from __future__ import annotations

import pytest

from app.ml import resume_extractor
from app.ml.resume_extractor import clean_text, extract_resume_data

pytestmark = pytest.mark.unit


# ===========================================================================
# clean_text
# ===========================================================================
@pytest.mark.parametrize(
    "raw, expected",
    [
        pytest.param("Hello World", "hello world", id="lowercases"),
        pytest.param(
            "Python, Django | React (advanced)",
            "python django react advanced",
            id="strips-comma-pipe-parens",
        ),
        pytest.param("C++ and C#", "c++ and c", id="keeps-plus-drops-hash"),
        pytest.param("a\t\tb\n\nc   d", "a b c d", id="collapses-all-whitespace"),
        pytest.param("   padded   ", "padded", id="trims-ends"),
        pytest.param("", "", id="empty-stays-empty"),
    ],
)
def test_clean_text(raw: str, expected: str) -> None:
    """
    Scenario: Feed clean_text a range of messy strings.
    Expected: It lowercases, removes every character that is not a letter,
              digit, whitespace or '+', collapses runs of whitespace to a
              single space, and strips the ends. '+' is deliberately kept so
              "c++" survives.

    Arrange: raw / expected pairs from parametrize.
    Act:     call clean_text(raw).
    Assert:  the result equals expected.
    """
    assert clean_text(raw) == expected


# ===========================================================================
# extract_resume_data
# ===========================================================================
@pytest.fixture()
def known_skills(monkeypatch: pytest.MonkeyPatch) -> set[str]:
    """Pin KNOWN_SKILLS so skill-matching assertions don't depend on skills.txt."""
    skills = {"python", "django", "react", "c++"}
    monkeypatch.setattr(resume_extractor, "KNOWN_SKILLS", skills)
    return skills


def test_extracts_first_email(known_skills: set[str]) -> None:
    """
    Scenario: The resume text contains two email addresses.
    Expected: extract_resume_data returns the FIRST one (re.search stops at the
              first match).

    Arrange: text with "jane.doe@example.com" appearing before "hr@corp.co".
    Act:     call extract_resume_data(text).
    Assert:  result["email"] is the first address.
    """
    # Arrange
    text = "Jane Doe\nEmail: jane.doe@example.com\nRecruiter: hr@corp.co"

    # Act
    result = extract_resume_data(text)

    # Assert
    assert result["email"] == "jane.doe@example.com"


@pytest.mark.parametrize(
    "text, expected_phone",
    [
        pytest.param("Tel: 081-234-5678", "081-234-5678", id="leading-zero-dashes"),
        pytest.param("Mobile +66 81 234 5678 (home)", "+66 81 234 5678", id="plus66-spaces"),
    ],
)
def test_extracts_thai_mobile_number(
    known_skills: set[str], text: str, expected_phone: str
) -> None:
    """
    Scenario: The resume contains a Thai-format phone number.
    Expected: The phone regex - (+66|66|0) then 1-2 digits, 3 digits, 4 digits
              with optional separators - captures exactly that substring.

    Arrange: text with the phone number embedded in a sentence.
    Act:     call extract_resume_data(text).
    Assert:  result["phone"] equals the expected substring.
    """
    result = extract_resume_data(text)
    assert result["phone"] == expected_phone


def test_missing_email_and_phone_are_none(known_skills: set[str]) -> None:
    """
    Scenario: Resume text with no contact details at all.
    Expected: result["email"] and result["phone"] are None (not "" and not a
              KeyError) so callers can test `is None`.

    Arrange: a sentence containing no "@" and no phone-shaped digits.
    Act:     call extract_resume_data(text).
    Assert:  both fields are None.
    """
    result = extract_resume_data("Experienced manager who leads teams well.")
    assert result["email"] is None
    assert result["phone"] is None


def test_skills_are_the_intersection_with_known_skills(known_skills: set[str]) -> None:
    """
    Scenario: Resume mentions several technologies, some known and some not.
    Expected: Only the ones present in KNOWN_SKILLS come back. "c++" is included
              to prove clean_text kept the '+' characters.

    Arrange: text listing Python, Django, C++ (all known) and Kubernetes (not).
    Act:     call extract_resume_data(text).
    Assert:  the returned skills, compared as a set, are exactly {python, django, c++}.
             (The function returns a list built from a set, so order is not stable -
             compare as sets.)
    """
    # Arrange
    text = "Strong in Python and Django. Also C++ and some Kubernetes."

    # Act
    result = extract_resume_data(text)

    # Assert
    assert set(result["skills"]) == {"python", "django", "c++"}


def test_skill_not_in_known_set_is_ignored(known_skills: set[str]) -> None:
    """
    Scenario: Resume mentions a real skill that is not in our dictionary.
    Expected: It is not reported.

    Arrange: text mentioning "Rust" while KNOWN_SKILLS has no "rust".
    Act:     call extract_resume_data(text).
    Assert:  "rust" is not in result["skills"].
    """
    result = extract_resume_data("Systems programming in Rust.")
    assert "rust" not in result["skills"]


def test_name_is_the_first_short_line(known_skills: set[str]) -> None:
    """
    Scenario: A normal resume whose first line is the candidate's name.
    Expected: result["name"] is that first non-empty line.

    Arrange: "Jane Doe" on line 1, job title on line 2.
    Act:     call extract_resume_data(text).
    Assert:  result["name"] == "Jane Doe".
    """
    result = extract_resume_data("Jane Doe\nSenior Software Engineer\n...")
    assert result["name"] == "Jane Doe"


def test_line_containing_the_word_resume_is_skipped_for_name(known_skills: set[str]) -> None:
    """
    Scenario: The document starts with a header like "John's Resume".
    Expected: The name heuristic skips any line containing "resume" (case
              insensitive) and picks the next qualifying line instead.

    Arrange: "John's Resume" on line 1, "John Smith" on line 2.
    Act:     call extract_resume_data(text).
    Assert:  result["name"] == "John Smith".
    """
    result = extract_resume_data("John's Resume\nJohn Smith\nDeveloper")
    assert result["name"] == "John Smith"


def test_long_first_line_is_not_treated_as_name(known_skills: set[str]) -> None:
    """
    Scenario: The first line is a long paragraph (>= 50 chars), not a name.
    Expected: The heuristic (len < 50) rejects it and uses the next short line.

    Arrange: a 60-character first line, then "Short Name".
    Act:     call extract_resume_data(text).
    Assert:  result["name"] == "Short Name".
    """
    long_line = "A" * 60
    result = extract_resume_data(f"{long_line}\nShort Name\nEngineer")
    assert result["name"] == "Short Name"


def test_raw_text_is_passed_through_unchanged(known_skills: set[str]) -> None:
    """
    Scenario: Callers need the original text back alongside the parsed fields.
    Expected: result["raw_text"] is byte-for-byte the input.

    Arrange: any multi-line text.
    Act:     call extract_resume_data(text).
    Assert:  result["raw_text"] == text.
    """
    text = "Jane Doe\njane@x.com\nPython"
    assert extract_resume_data(text)["raw_text"] == text


def test_empty_input_returns_all_empty_fields(known_skills: set[str]) -> None:
    """
    Scenario: extract_resume_data is called with "".
    Expected: name/email/phone are None, skills is an empty list, experience is
              None, raw_text is "" - no exception.

    Arrange: empty string.
    Act:     call extract_resume_data("").
    Assert:  every field has its empty value.
    """
    result = extract_resume_data("")
    assert result == {
        "name": None,
        "email": None,
        "phone": None,
        "skills": [],
        "experience": None,
        "raw_text": "",
    }


# ===========================================================================
# extract_resume_text  (PDF reading via fitz)
# ===========================================================================
class _FakePage:
    """Stands in for a PyMuPDF page: only .get_text() is used."""

    def __init__(self, text: str) -> None:
        self._text = text

    def get_text(self) -> str:
        return self._text


class _FakeDoc:
    """Stands in for a PyMuPDF document: iterable of pages, plus .close()."""

    def __init__(self, pages: list[_FakePage]) -> None:
        self._pages = pages
        self.closed = False

    def __iter__(self):
        return iter(self._pages)

    def close(self) -> None:
        self.closed = True


def test_joins_page_text_with_newlines(monkeypatch: pytest.MonkeyPatch) -> None:
    """
    Scenario: A 2-page PDF is opened successfully.
    Expected: The returned string is each page's text followed by "\\n", in
              page order.

    Arrange: monkeypatch fitz.open to return a fake 2-page document.
    Act:     call extract_resume_text("anything.pdf").
    Assert:  result == "page one\\npage two\\n" and the document was closed.
    """
    # Arrange
    fake_doc = _FakeDoc([_FakePage("page one"), _FakePage("page two")])
    monkeypatch.setattr(resume_extractor.fitz, "open", lambda _path: fake_doc)

    # Act
    result = resume_extractor.extract_resume_text("anything.pdf")

    # Assert
    assert result == "page one\npage two\n"
    assert fake_doc.closed is True


def test_returns_empty_string_when_fitz_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    """
    Scenario: The PDF is missing or corrupt, so fitz.open raises.
    Expected: extract_resume_text swallows the exception and returns "" (the
              caller treats "no text" as "nothing to analyse").

    Arrange: monkeypatch fitz.open to raise RuntimeError.
    Act:     call extract_resume_text("broken.pdf").
    Assert:  result == "".
    """
    # Arrange
    def _boom(_path: str):
        raise RuntimeError("cannot open broken.pdf")

    monkeypatch.setattr(resume_extractor.fitz, "open", _boom)

    # Act / Assert
    assert resume_extractor.extract_resume_text("broken.pdf") == ""
