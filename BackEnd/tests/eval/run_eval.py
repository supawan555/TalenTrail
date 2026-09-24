"""Standalone eval runner.

    cd BackEnd
    .venv/Scripts/python -m tests.eval.run_eval --live
    .venv/Scripts/python -m tests.eval.run_eval                 # offline, mocked
    .venv/Scripts/python -m tests.eval.run_eval --live --runs 5 --variance-threshold 10
    .venv/Scripts/python -m tests.eval.run_eval --live --category strong_match
    .venv/Scripts/python -m tests.eval.run_eval --live --json results.json

Prints the results table, the per-category summary, the variance table and a
diagnosis. Exit code is 0 when every case lands in its band, 1 otherwise, so this
can gate a pipeline if you want it to.
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict
from pathlib import Path

# Allow `python tests/eval/run_eval.py` as well as `python -m tests.eval.run_eval`.
if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from tests.eval import report  # noqa: E402
from tests.eval.fixtures.cases import ALL_CATEGORIES, CASES, CASES_BY_NAME  # noqa: E402
from tests.eval.harness import LIVE, OFFLINE, run_all, run_all_n  # noqa: E402


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="run_eval",
        description="Evaluate resume-matching score quality.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--live",
        action="store_true",
        help="Call the real LLM path (Gemini + SBERT). Default is mocked/offline.",
    )
    parser.add_argument(
        "--runs",
        type=int,
        default=5,
        help="Repetitions per case for the variance report (default: 5).",
    )
    parser.add_argument(
        "--variance-threshold",
        type=float,
        default=15.0,
        help="Flag a case when max-min spread exceeds this (default: 15.0).",
    )
    parser.add_argument(
        "--category",
        action="append",
        choices=ALL_CATEGORIES,
        help="Limit to one or more categories. Repeatable.",
    )
    parser.add_argument(
        "--case",
        action="append",
        help="Limit to specific case names. Repeatable.",
    )
    parser.add_argument(
        "--no-variance",
        action="store_true",
        help="Skip the repeated-run variance pass (much faster under --live).",
    )
    parser.add_argument(
        "--json",
        dest="json_out",
        metavar="PATH",
        help="Also write the raw results to a JSON file.",
    )
    return parser


def select_cases(args: argparse.Namespace):
    selected = CASES
    if args.category:
        wanted = set(args.category)
        selected = [c for c in selected if c.category in wanted]
    if args.case:
        missing = [n for n in args.case if n not in CASES_BY_NAME]
        if missing:
            raise SystemExit(f"unknown case name(s): {', '.join(missing)}")
        wanted_names = set(args.case)
        selected = [c for c in selected if c.name in wanted_names]
    if not selected:
        raise SystemExit("no cases matched the given filters")
    return selected


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    mode = LIVE if args.live else OFFLINE
    cases = select_cases(args)

    if mode == LIVE:
        print(
            f"Running {len(cases)} case(s) against the REAL LLM path "
            "(Gemini + SBERT). First run downloads the SBERT model.",
            file=sys.stderr,
        )
    else:
        print(
            f"Running {len(cases)} case(s) OFFLINE with mocked LLM responses. "
            "Pass --live to score the real model.",
            file=sys.stderr,
        )

    outcomes = run_all(cases, mode=mode)
    print(report.results_table(outcomes))
    print(report.category_summary(outcomes))

    stats = []
    if not args.no_variance:
        print(
            f"\nScoring each case {args.runs}x for the variance report...",
            file=sys.stderr,
        )
        stats = run_all_n(cases, args.runs, mode=mode)
        print(report.variance_table(stats, args.variance_threshold))

    print(report.diagnosis(outcomes))

    if args.json_out:
        payload = {
            "mode": mode,
            "runs": args.runs,
            "variance_threshold": args.variance_threshold,
            "results": [asdict(o) for o in outcomes],
            "variance": [
                {
                    "case_name": s.case_name,
                    "category": s.category,
                    "expected_band": list(s.expected_band),
                    "scores": s.scores,
                    "mean": s.mean,
                    "stdev": s.stdev,
                    "min": s.minimum,
                    "max": s.maximum,
                    "spread": s.spread,
                    "pass_rate": s.pass_rate,
                }
                for s in stats
            ],
        }
        Path(args.json_out).write_text(json.dumps(payload, indent=2), encoding="utf-8")
        print(f"\nWrote {args.json_out}", file=sys.stderr)

    failed = [o for o in outcomes if not o.passed]
    print(f"\n{len(outcomes) - len(failed)}/{len(outcomes)} cases in band.")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
