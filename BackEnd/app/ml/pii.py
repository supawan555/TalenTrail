"""Remove direct identifiers from resume text before it leaves the server.

Only the language-model call needs this; SBERT runs locally. The Gemini API
terms forbid sending personal information to the unpaid tier, and the PDPA asks
for data minimisation, so the candidate's name, email addresses, phone numbers
and profile links are replaced with placeholders. The work history stays: the
model needs it to judge the candidate.
"""
from __future__ import annotations

import re

EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
URL_RE = re.compile(
    r"(?:https?://|www\.)\S+"
    r"|\b(?:linkedin\.com|github\.com|gitlab\.com|behance\.net)/\S*",
    re.IGNORECASE,
)
# A run of digits with the separators phones use. Validated by digit count below,
# so year ranges such as "2018-2021" (8 digits) are never taken for a phone number.
PHONE_CANDIDATE_RE = re.compile(r"(?<![\w/])\+?\(?\d[\d\s().-]{6,}\d(?![\w/])")
NAME_RE = re.compile(r"^[A-Z][A-Za-z'.-]+(?: [A-Z][A-Za-z'.-]+){1,3}$")
NOT_A_NAME = re.compile(
    r"\b(resume|curriculum|vitae|cv|developer|engineer|manager|designer|analyst|"
    r"specialist|consultant|intern|officer|lead|senior|junior|director|profile|summary)\b",
    re.IGNORECASE,
)


def _redact_phones(text: str) -> str:
    def repl(m: re.Match) -> str:
        digits = sum(c.isdigit() for c in m.group(0))
        return "[PHONE]" if 9 <= digits <= 15 else m.group(0)

    return PHONE_CANDIDATE_RE.sub(repl, text)


def _candidate_name(text: str) -> str | None:
    """The name on the first line, if that line looks like a person's name."""
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        first = re.split(r"\s*[|•,]\s*", line)[0].strip()
        if NAME_RE.match(first) and not NOT_A_NAME.search(first):
            return first
        return None
    return None


def redact_pii(text: str) -> str:
    """Return ``text`` with the name, emails, phone numbers and links replaced."""
    if not text:
        return text
    name = _candidate_name(text)
    text = EMAIL_RE.sub("[EMAIL]", text)
    text = URL_RE.sub("[LINK]", text)
    text = _redact_phones(text)
    if name:
        text = re.sub(re.escape(name), "[NAME]", text, flags=re.IGNORECASE)
    return text
