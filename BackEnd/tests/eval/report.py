"""Plain-text tables for eval results."""

from __future__ import annotations

from typing import Iterable, Optional

from .harness import CaseStats, ScoreOutcome


def _fmt(value: Optional[float], places: int = 1) -> str:
    """Render an optional score. Non-scored shows as '-', never as 0."""
    return "-" if value is None else f"{value:.{places}f}"


def _rule(widths: Iterable[int], char: str = "-") -> str:
    return "-+-".join(char * w for w in widths)


def _row(cells: Iterable[str], widths: Iterable[int]) -> str:
    return " | ".join(str(c).ljust(w) for c, w in zip(cells, widths))


def results_table(outcomes: list[ScoreOutcome], title: str = "EVAL RESULTS") -> str:
    """case name | expected band | actual score | pass/fail (STEP 2)."""
    if not outcomes:
        return f"{title}\n(no results)"

    name_w = max(len("case name"), max(len(o.case_name) for o in outcomes))
    cat_w = max(len("category"), max(len(o.category) for o in outcomes))
    widths = [name_w, cat_w, 13, 12, 9, 9, 9]

    lines = [
        "",
        f"{title}  (mode={outcomes[0].mode})",
        "=" * (sum(widths) + 3 * (len(widths) - 1)),
        _row(
            ["case name", "category", "expected band", "actual score", "llm", "semantic", "result"],
            widths,
        ),
        _rule(widths),
    ]

    for o in outcomes:
        low, high = o.expected_band
        if not o.scored:
            verdict = o.status.upper()
        elif o.passed:
            verdict = "PASS"
        else:
            verdict = f"FAIL {o.band_miss:+.0f}"
        lines.append(
            _row(
                [
                    o.case_name,
                    o.category,
                    f"{low}-{high}",
                    _fmt(o.final_score, 1),
                    _fmt(o.llm_score, 0),
                    _fmt(o.semantic_score, 1),
                    verdict,
                ],
                widths,
            )
        )

    passed = sum(1 for o in outcomes if o.passed)
    lines.append(_rule(widths))
    lines.append(f"{passed}/{len(outcomes)} in band")
    return "\n".join(lines)


def category_summary(outcomes: list[ScoreOutcome]) -> str:
    """Per-category pass rate and average band miss (STEP 6)."""
    if not outcomes:
        return ""

    by_cat: dict[str, list[ScoreOutcome]] = {}
    for o in outcomes:
        by_cat.setdefault(o.category, []).append(o)

    cat_w = max(len("category"), max(len(c) for c in by_cat))
    widths = [cat_w, 7, 12, 14]

    lines = [
        "",
        "PER-CATEGORY SUMMARY",
        "=" * (sum(widths) + 3 * (len(widths) - 1)),
        _row(["category", "in band", "avg score", "avg band miss"], widths),
        _rule(widths),
    ]
    for cat, items in by_cat.items():
        passed = sum(1 for o in items if o.passed)
        scored = [o for o in items if o.scored]
        avg = sum(o.final_score for o in scored) / len(scored) if scored else None
        misses = [o.band_miss for o in items if o.scored and not o.passed]
        avg_miss = sum(misses) / len(misses) if misses else None
        lines.append(
            _row(
                [
                    cat,
                    f"{passed}/{len(items)}",
                    _fmt(avg, 1),
                    f"{avg_miss:+.1f}" if avg_miss is not None else "-",
                ],
                widths,
            )
        )
    return "\n".join(lines)


def variance_table(stats: list[CaseStats], threshold: float) -> str:
    """mean / stddev / min / max per case, flagging spread over threshold (STEP 5)."""
    if not stats:
        return "(no variance results)"

    name_w = max(len("case name"), max(len(s.case_name) for s in stats))
    widths = [name_w, 6, 8, 8, 7, 7, 8, 6]

    runs = len(stats[0].outcomes)
    lines = [
        "",
        f"CONSISTENCY / VARIANCE  (runs={runs}, spread threshold={threshold})",
        "=" * (sum(widths) + 3 * (len(widths) - 1)),
        _row(["case name", "runs", "mean", "stddev", "min", "max", "spread", "flag"], widths),
        _rule(widths),
    ]

    for s in stats:
        flag = "HIGH" if s.unstable(threshold) else ""
        lines.append(
            _row(
                [
                    s.case_name,
                    len(s.outcomes),
                    f"{s.mean:.1f}",
                    f"{s.stdev:.2f}",
                    f"{s.minimum:.1f}",
                    f"{s.maximum:.1f}",
                    f"{s.spread:.1f}",
                    flag,
                ],
                widths,
            )
        )

    unstable = [s.case_name for s in stats if s.unstable(threshold)]
    lines.append(_rule(widths))
    if unstable:
        lines.append(f"{len(unstable)} case(s) over threshold: {', '.join(unstable)}")
        lines.append("High spread at temperature=0 means the prompt is underspecified.")
    else:
        lines.append("All cases within the spread threshold.")
    return "\n".join(lines)


def ordering_table(pairs: list[tuple[str, str, float, float, bool]]) -> str:
    """Rendered relative-ordering results (STEP 4)."""
    if not pairs:
        return ""
    left_w = max(len("higher"), max(len(p[0]) for p in pairs))
    right_w = max(len("lower"), max(len(p[1]) for p in pairs))
    widths = [left_w, right_w, 8, 8, 8]

    lines = [
        "",
        "RELATIVE ORDERING",
        "=" * (sum(widths) + 3 * (len(widths) - 1)),
        _row(["higher", "lower", "score", "score", "result"], widths),
        _rule(widths),
    ]
    for high_name, low_name, high_score, low_score, ok in pairs:
        lines.append(
            _row(
                [
                    high_name,
                    low_name,
                    f"{high_score:.1f}",
                    f"{low_score:.1f}",
                    "PASS" if ok else "FAIL",
                ],
                widths,
            )
        )
    return "\n".join(lines)


def diagnosis(outcomes: list[ScoreOutcome]) -> str:
    """Classify failures as prompt / parsing / truncation / dependency problems."""
    if not outcomes:
        return ""

    lines = ["", "DIAGNOSIS", "=" * 60]

    total = len(outcomes)
    by_status: dict[str, list[ScoreOutcome]] = {}
    for o in outcomes:
        by_status.setdefault(o.status, []).append(o)

    unavailable = by_status.get("model_unavailable", [])
    parse_errors = by_status.get("parse_error", [])
    invalid = by_status.get("input_invalid", [])
    genuine_zero = [o for o in outcomes if o.scored and o.llm_returned_zero]

    if unavailable:
        lines.append(
            f"MODEL UNAVAILABLE: {len(unavailable)}/{total} case(s) never reached a "
            "model. Scores are null, not zero. "
            f"First error: {unavailable[0].error}"
        )

    if parse_errors:
        lines.append(
            f"PARSING: {len(parse_errors)}/{total} case(s) returned output that "
            "survived neither repair nor the strict retry. Sample:"
        )
        preview = (parse_errors[0].raw_response or "")[:220].replace("\n", "\\n")
        lines.append(f'  {parse_errors[0].case_name}: "{preview}"')

    if invalid:
        lines.append(
            f"INPUT INVALID (expected for empty-input cases): {len(invalid)} - "
            + ", ".join(o.case_name for o in invalid[:6])
        )

    if genuine_zero:
        lines.append(
            f'GENUINE ZEROS: {len(genuine_zero)} case(s) were scored 0 by the model '
            f'- {", ".join(o.case_name for o in genuine_zero[:6])}'
        )

    over = [o for o in outcomes if o.scored and not o.passed and o.band_miss > 0]
    under = [o for o in outcomes if o.scored and not o.passed and o.band_miss < 0]
    if over:
        lines.append(
            f"PROMPT (too generous): {len(over)} case(s) scored above band - "
            + ", ".join(f"{o.case_name} {o.band_miss:+.0f}" for o in over[:8])
        )
    if under:
        lines.append(
            f"PROMPT (too harsh): {len(under)} case(s) scored below band - "
            + ", ".join(f"{o.case_name} {o.band_miss:+.0f}" for o in under[:8])
        )

    by_name = {o.case_name: o for o in outcomes}
    front = by_name.get("edge_long_resume_front_loaded")
    back = by_name.get("edge_long_resume_back_loaded")
    if front and back and front.scored and back.scored:
        gap = front.final_score - back.final_score
        if gap > 15:
            lines.append(
                f"TRUNCATION: identical candidate scored {front.final_score:.0f} "
                f"front-loaded vs {back.final_score:.0f} back-loaded (gap {gap:.0f}). "
                "resume_text[:3000] is discarding the qualifications."
            )

    if len(lines) == 3:
        lines.append("No systematic failure pattern detected.")
    return "\n".join(lines)


def full_report(
    outcomes: list[ScoreOutcome],
    stats: Optional[list[CaseStats]] = None,
    threshold: float = 15.0,
) -> str:
    parts = [results_table(outcomes), category_summary(outcomes)]
    if stats:
        parts.append(variance_table(stats, threshold))
    parts.append(diagnosis(outcomes))
    return "\n".join(parts)
