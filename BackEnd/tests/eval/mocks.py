"""Offline stand-ins for the LLM and the SBERT model.

The goal is maximum fidelity: in mocked mode ``_run_llm_analysis`` still runs its own
real code. It builds the real ``ChatPromptTemplate``, renders the real prompt, and
feeds the canned response through the real fence-stripping and ``json.loads`` path.
Only the network call is replaced.

That is what makes the offline suite worth running: a regression in the prompt template,
the ``{{ }}`` escaping, the fence handling or the clamping is caught in CI without Gemini.

Mechanism: ``langchain_core.prompts`` and ``langchain_google_genai`` are imported
*inside* ``_run_llm_analysis``, so swapping ``sys.modules`` before the call is enough.
"""

from __future__ import annotations

import contextlib
import sys
import types
from dataclasses import dataclass, field
from typing import Any, Callable, Iterator, Optional

# A responder maps the rendered prompt to the raw string the model would return.
Responder = Callable[[str], str]


@dataclass
class LLMCall:
    """One recorded round trip through the fake model."""

    model: str
    temperature: Any
    kwargs: dict[str, Any]
    rendered_prompt: str
    variables: dict[str, str]
    raw_response: str


@dataclass
class CallRecorder:
    calls: list[LLMCall] = field(default_factory=list)

    @property
    def last(self) -> LLMCall:
        if not self.calls:
            raise AssertionError("the LLM was never called")
        return self.calls[-1]

    @property
    def count(self) -> int:
        return len(self.calls)


class _FakeResponse:
    """Mirrors the AIMessage surface that _run_llm_analysis reads."""

    def __init__(self, content: Any) -> None:
        self.content = content


class _FakeChatPromptTemplate:
    def __init__(self, messages: list[tuple[str, str]]) -> None:
        self.messages = messages

    @classmethod
    def from_messages(cls, messages: list[tuple[str, str]]) -> "_FakeChatPromptTemplate":
        return cls(messages)

    def render(self, variables: dict[str, str]) -> str:
        """Substitute like LangChain's f-string formatter, including {{ }} escaping."""
        parts = []
        for role, text in self.messages:
            # Protect doubled braces first so the schema literal survives intact.
            body = text.replace("{{", "\x00").replace("}}", "\x01")
            for key, value in variables.items():
                body = body.replace("{" + key + "}", str(value))
            body = body.replace("\x00", "{").replace("\x01", "}")
            parts.append(f"[{role}]\n{body}")
        return "\n\n".join(parts)

    def __or__(self, llm: "_FakeChatGoogleGenerativeAI") -> "_FakeChain":
        return _FakeChain(self, llm)


class _FakeChain:
    def __init__(self, template: _FakeChatPromptTemplate, llm: "_FakeChatGoogleGenerativeAI") -> None:
        self._template = template
        self._llm = llm

    def invoke(self, variables: dict[str, str]) -> _FakeResponse:
        rendered = self._template.render(variables)
        try:
            raw = self._llm.respond(rendered)
        except Exception:
            # Record the attempt before re-raising, so tests can assert on how
            # many calls a transport failure produced.
            self._llm.recorder.calls.append(
                LLMCall(
                    model=self._llm.model,
                    temperature=self._llm.temperature,
                    kwargs=self._llm.kwargs,
                    rendered_prompt=rendered,
                    variables=dict(variables),
                    raw_response="",
                )
            )
            raise
        self._llm.recorder.calls.append(
            LLMCall(
                model=self._llm.model,
                temperature=self._llm.temperature,
                kwargs=self._llm.kwargs,
                rendered_prompt=rendered,
                variables=dict(variables),
                raw_response=raw,
            )
        )
        return _FakeResponse(raw)


class _FakeChatGoogleGenerativeAI:
    # Populated by install_fake_langchain() before the production code constructs it.
    responder: Responder = staticmethod(lambda prompt: '{"score": 0, "strengths": [], "missing_skills": []}')
    recorder: CallRecorder = CallRecorder()

    def __init__(self, model: str = "", temperature: Any = None, **kwargs: Any) -> None:
        self.model = model
        self.temperature = temperature
        self.kwargs = kwargs

    def respond(self, rendered_prompt: str) -> str:
        return type(self).responder(rendered_prompt)


@contextlib.contextmanager
def install_fake_langchain(
    responder: Responder,
    recorder: Optional[CallRecorder] = None,
) -> Iterator[CallRecorder]:
    """Swap langchain out for the fakes above for the duration of the block."""
    recorder = recorder or CallRecorder()

    core = types.ModuleType("langchain_core")
    prompts = types.ModuleType("langchain_core.prompts")
    prompts.ChatPromptTemplate = _FakeChatPromptTemplate  # type: ignore[attr-defined]
    core.prompts = prompts  # type: ignore[attr-defined]

    genai = types.ModuleType("langchain_google_genai")
    genai.ChatGoogleGenerativeAI = _FakeChatGoogleGenerativeAI  # type: ignore[attr-defined]

    replacements = {
        "langchain_core": core,
        "langchain_core.prompts": prompts,
        "langchain_google_genai": genai,
    }
    saved = {name: sys.modules.get(name) for name in replacements}
    prev_responder = _FakeChatGoogleGenerativeAI.responder
    prev_recorder = _FakeChatGoogleGenerativeAI.recorder

    sys.modules.update(replacements)
    _FakeChatGoogleGenerativeAI.responder = staticmethod(responder)  # type: ignore[assignment]
    _FakeChatGoogleGenerativeAI.recorder = recorder
    try:
        yield recorder
    finally:
        _FakeChatGoogleGenerativeAI.responder = prev_responder  # type: ignore[assignment]
        _FakeChatGoogleGenerativeAI.recorder = prev_recorder
        for name, module in saved.items():
            if module is None:
                sys.modules.pop(name, None)
            else:
                sys.modules[name] = module


def json_responder(score: int, strengths: list[str], missing: list[str]) -> Responder:
    """Return a responder emitting the exact JSON the prompt asks for."""
    import json

    payload = json.dumps(
        {"score": score, "strengths": strengths, "missing_skills": missing}
    )
    return lambda _prompt: payload


def fixed_responder(raw: str) -> Responder:
    """Return a responder emitting an arbitrary raw string (malformed output tests)."""
    return lambda _prompt: raw


def sequence_responder(responses: list[str]) -> Responder:
    """Return a responder that walks a list, repeating the last entry.

    Used to drive the retry path: a bad first response followed by a good one.
    """
    remaining = list(responses)

    def _respond(_prompt: str) -> str:
        if len(remaining) > 1:
            return remaining.pop(0)
        return remaining[0] if remaining else ""

    return _respond


# --------------------------------------------------------------------------
# SBERT stand-in
# --------------------------------------------------------------------------


@contextlib.contextmanager
def stub_semantic_score(monkeypatch_target: Any, value: float) -> Iterator[None]:
    """Pin ``match_resume_to_job`` so offline runs need no model download.

    ``combine_scores`` resolves ``match_resume_to_job`` as a module global, so
    replacing the module attribute is enough.
    """
    original = monkeypatch_target.match_resume_to_job
    monkeypatch_target.match_resume_to_job = lambda _resume, _job: value
    try:
        yield
    finally:
        monkeypatch_target.match_resume_to_job = original
