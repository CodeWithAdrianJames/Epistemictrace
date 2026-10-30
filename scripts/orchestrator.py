#!/usr/bin/env python3
"""Autonomous spec-to-merge loop for EpistemicTrace.

Gemini Flash plans each unit of work and reviews green pull requests; Claude Code
runs headless as the executor. Every tick gathers the repository state, asks
Gemini for one action, and carries it out:

  execute -> claude -p --model <tier model> [--effort <level>] --dangerously-skip-permissions
  merge   -> gh pr merge <number> --squash --body "<audit summary>"
  stop    -> STOP: COMPLETE | STOP: FAILED

Exit codes: 0 STOP: COMPLETE, 1 STOP: FAILED, 2 configuration error,
3 tick budget exhausted, 130 interrupted.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import threading
import time
from collections import deque
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
TRACKER_PATH = REPO_ROOT / "docs" / "context" / "progress-tracker.md"
WORKFLOW_RULES_PATH = REPO_ROOT / "docs" / "context" / "ai-workflow-rules.md"
SPECS_DIR = REPO_ROOT / "docs" / "context" / "feature-specs"
LOG_DIR = REPO_ROOT / ".orchestrator"

# Only these keys are read from .env, so DB credentials and secrets stay out of the orchestrator.
ENV_FILE_PREFIXES = ("GEMINI_", "CLAUDE_MODEL_", "ORCH_")


def _main_checkout_root() -> Path | None:
    """Root of the main checkout when REPO_ROOT is a git worktree (where the shared .env usually lives)."""
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--path-format=absolute", "--git-common-dir"],
            cwd=REPO_ROOT, capture_output=True, text=True, timeout=15,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    if result.returncode != 0 or not result.stdout.strip():
        return None
    return Path(result.stdout.strip()).parent


def _load_env_file() -> None:
    """Fill missing GEMINI_*, CLAUDE_MODEL_* and ORCH_* variables from the root .env; real env vars win."""
    candidates = [REPO_ROOT / ".env"]
    main_root = _main_checkout_root()
    if main_root is not None and main_root.resolve() != REPO_ROOT.resolve():
        candidates.append(main_root / ".env")
    for path in candidates:
        if not path.is_file():
            continue
        for raw in path.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip().removeprefix("export ").strip()
            value = value.strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
                value = value[1:-1]
            if key.startswith(ENV_FILE_PREFIXES) and value:
                os.environ.setdefault(key, value)


_load_env_file()

MODEL_TIERS = {
    "hard": os.getenv("CLAUDE_MODEL_HARD", "opus 5.5 high"),
    "simple": os.getenv("CLAUDE_MODEL_SIMPLE", "sonnet 5.5 high"),
}
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-flash-latest")
EFFORT_LEVELS = ("low", "medium", "high", "xhigh", "max")

DEFAULT_MAX_TICKS = 30
MAX_CONSECUTIVE_FAILURES = 2
GEMINI_ATTEMPTS = 3
CI_POLL_SECONDS = int(os.getenv("ORCH_CI_POLL_SECONDS", "60"))
CI_TIMEOUT_SECONDS = int(os.getenv("ORCH_CI_TIMEOUT_SECONDS", "1800"))
EXECUTOR_TIMEOUT_SECONDS = int(os.getenv("ORCH_EXECUTOR_TIMEOUT_SECONDS", "3600"))
DIFF_CHAR_LIMIT = 150_000
TRACKER_CHAR_LIMIT = 80_000
OUTPUT_TAIL_LINES = 60
HISTORY_LENGTH = 10

STOP_COMPLETE = "STOP: COMPLETE"
STOP_FAILED = "STOP: FAILED"

# Appended in code to every executor prompt, so it never depends on what Gemini wrote.
EXECUTION_CONTRACT = (
    "\n\nRun non-interactively. Never merge pull requests. If blocked by missing context, fatal errors, "
    "or failing tests, explain why and prefix your response with BLOCKED:"
)

SYSTEM_PROMPT = f"""\
You are the planner and code reviewer of an autonomous delivery loop for the EpistemicTrace repository.
A headless Claude Code agent executes your prompts; the orchestrator script runs the squash-merge itself.
No human reviews anything, so you are the only gate between a pull request and main.

Each tick you receive the repository state and return exactly one JSON object, no prose, no code fences:
{{
  "action": "execute" | "merge" | "stop",
  "tier": "hard" | "simple",
  "summary": "<one line: what this action does and why>",
  "prompt": "<execute only: the prompt for Claude Code>",
  "pr_number": <merge only: integer>,
  "merge_body": "<merge only: squash commit body, at most 15 lines>",
  "audit_log": "<merge, or execute after a review that found defects: the audit, format below>",
  "status": "<stop only: \\"{STOP_COMPLETE}\\" or \\"{STOP_FAILED}\\">"
}}

Decide in this order:
1. REMAINING SPECS is empty -> "stop" with "{STOP_COMPLETE}".
2. An OPEN pull request with CI SUCCESS and mergeable MERGEABLE -> review it (Mode B). Check the diff against
   the active spec: only its In Scope and Requirements are built, nothing from Out of Scope; acceptance criteria
   and listed tests are covered; progress-tracker.md matches the work (a spec whose last part this PR delivers is
   moved to Completed); files under "Docs to Update" changed where required; no protected foundation file
   (Maven wrapper, lock files edited by hand, merged migrations, .env.example keys) changed without the spec
   saying so; no secrets committed. Pass -> "merge" with pr_number, merge_body and audit_log.
   Fail -> "execute" (hard) with a prompt that fixes every defect on the same branch, plus the audit_log.
3. An OPEN pull request with CI FAILURE -> "execute" (hard): read the failing logs (`gh run view --log-failed`),
   fix on the same branch, re-run the local checks, push.
4. An OPEN pull request with mergeable CONFLICTING -> "execute" (hard): merge origin/main into the branch,
   resolve the conflicts, re-run the local checks, push.
5. No OPEN pull request, but the branch holds uncommitted or unpushed work for a spec part -> "execute" (simple):
   run the local checks, commit, push, open the pull request against main. If the last result shows those
   checks failing, use "hard" and have it fix them first.
6. Otherwise start the next unit: the next part of the active spec, or else the first spec in the Next Up table
   whose dependencies are all completed -> "execute" (hard). A pull request in state MERGED or CLOSED means that
   part is finished: the next unit gets a new branch cut fresh from main, never the old branch.
7. "stop" with "{STOP_FAILED}" when: the next unit's gates (Qn) are not Accepted in progress-tracker.md; the last
   result shows the same failure twice; the executor replied BLOCKED; or the state is unrecoverable or
   ambiguous. Give the reason in summary.

Model tier, required on every action:
- "hard": feature implementation, writing production code, refactoring, writing unit or integration test
  suites, fixing failing CI or review defects.
- "simple": git commits, pushing branches, creating pull requests, documentation and progress-tracker
  updates, squash-merging, chore scripts. A "stop" action uses "simple".

Execute prompt format: concise, exactly three numbered steps.
1. Setup: new work always gets a branch cut fresh from an up-to-date main:
   `git checkout main && git pull origin main && git checkout -b <branch>`.
   Branch names, one spec part per branch:
   - Part 1 of a spec: feature/imp-<spec-num>-<short-name>, for example feature/imp-06-rbac.
   - Part 2 and later: feature/imp-<spec-num>-part-<part-num>, for example feature/imp-06-part-2.
   <spec-num> is the two-digit spec number. Only when continuing unmerged work (fixing CI or review defects,
   resolving conflicts, committing and pushing leftovers) check out the existing branch instead of creating one.
2. Context/Tracking: always tell Claude to read and follow @CLAUDE.md, @docs/context/ai-workflow-rules.md,
   @docs/context/code-standards.md and the active feature spec (give its path under
   docs/context/feature-specs/), naming the one spec part to build; then the progress-tracker.md update to make
   (In Progress, Completed, Session Notes).
3. Execute: the concrete work; the local checks (backend: `./mvnw test` in backend/; frontend: `npm run lint`,
   `npm run build`, `npm test` in frontend/); atomic conventional commits ending "(spec NN part N)"; push;
   open a PR targeting main using `gh pr create --base main` with a body naming the spec part, and take its
   number from the URL that command prints.
Never invent, guess or predict a pull request number, and never write one in a prompt (do not say "open PR
#17"). Refer to it as "the pull request" or "this branch's pull request" (`gh pr view` finds it).
Do not add an execution contract or closing instructions (non-interactive, no merging, BLOCKED); the
orchestrator appends them to every prompt itself.

Audit log format, at most 20 lines: PR number, spec and part, CI result, each check performed with pass or
fail, defects found (or "none"), verdict APPROVE or CHANGES REQUESTED.
"""


class ConfigError(Exception):
    """Missing key, package or CLI: the orchestrator exits 2 before the loop starts."""


class OrchestratorError(Exception):
    """Unrecoverable failure: the loop ends with STOP: FAILED."""


class InvalidDecision(Exception):
    """Gemini returned an action the orchestrator refuses to carry out."""


@dataclass
class PullRequest:
    number: int
    state: str
    mergeable: str
    ci: str
    failing_checks: list[str]
    diff: str = ""


@dataclass
class Context:
    branch: str
    status: str
    log: str
    tracker: str
    completed: list[str]
    remaining: list[str]
    active_spec: Path | None
    pr: PullRequest | None


@dataclass
class Decision:
    action: str
    tier: str
    summary: str
    prompt: str = ""
    pr_number: int | None = None
    merge_body: str = ""
    audit_log: str = ""
    status: str = ""


TOOLS: dict[str, str] = {}


def log(message: str) -> None:
    print(f"[{datetime.now():%H:%M:%S}] {message}", flush=True)


def truncate(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    return f"{text[:limit]}\n... [truncated {len(text) - limit} characters]"


def run(cmd: list[str], *, timeout: int = 120) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        cmd, cwd=REPO_ROOT, capture_output=True, text=True,
        encoding="utf-8", errors="replace", timeout=timeout,
    )


def git(*args: str) -> str:
    result = run([TOOLS["git"], *args])
    if result.returncode != 0:
        raise OrchestratorError(f"git {' '.join(args)} failed ({result.returncode}): {result.stderr.strip()}")
    return result.stdout.rstrip()


def resolve_tools() -> None:
    for name in ("git", "gh", "claude"):
        path = shutil.which(name)
        if path is None:
            raise ConfigError(f"'{name}' is not on PATH; install it before running the orchestrator.")
        TOOLS[name] = path


def resolve_model(tier_value: str) -> list[str]:
    """Turn a tier string into Claude Code flags.

    "opus 5.5 high" -> ["--model", "claude-opus-5-5", "--effort", "high"]. A trailing effort level becomes
    --effort; "<family> <version>" becomes the full model ID; aliases ("opus") and full IDs pass through.
    """
    tokens = tier_value.split()
    effort = None
    if len(tokens) > 1 and tokens[-1].lower() in EFFORT_LEVELS:
        effort = tokens.pop().lower()
    model = " ".join(tokens)
    match = re.fullmatch(r"(fable|opus|sonnet|haiku)\s+(\d+)(?:\.(\d+))?", model, re.IGNORECASE)
    if match:
        model = f"claude-{match[1].lower()}-{match[2]}" + (f"-{match[3]}" if match[3] else "")
    flags = ["--model", model]
    if effort:
        flags += ["--effort", effort]
    return flags


def spec_files() -> dict[str, Path]:
    specs = {}
    for path in sorted(SPECS_DIR.glob("*.md")):
        match = re.match(r"(\d{2})-", path.name)
        if match:
            specs[match[1]] = path
    if not specs:
        raise OrchestratorError(f"No feature specs found in {SPECS_DIR}")
    return specs


def completed_specs(tracker: str) -> set[str]:
    """Spec numbers listed under '## Completed' as '- NN Title (IMP-NN) — completed ...'."""
    section = re.search(r"^## Completed\s*\n(.*?)(?=^## )", tracker, re.MULTILINE | re.DOTALL)
    if section is None:
        return set()
    return set(re.findall(r"^- (\d{2}) .*?\s[—–-]+\s*completed", section[1], re.MULTILINE))


def active_spec(branch: str, specs: dict[str, Path], remaining: list[str]) -> Path | None:
    match = re.search(r"imp-(\d+)", branch)
    if match:
        number = f"{int(match[1]):02d}"
        if number in remaining:
            return specs[number]
    return specs[remaining[0]] if remaining else None


def ci_state(rollup: list[dict[str, Any]]) -> tuple[str, list[str]]:
    """Collapse statusCheckRollup (CheckRun and StatusContext entries) to SUCCESS, FAILURE, PENDING or NONE."""
    if not rollup:
        return "NONE", []
    failing: list[str] = []
    pending = False
    for check in rollup:
        name = check.get("name") or check.get("context") or "unnamed check"
        if check.get("__typename") == "StatusContext":
            state = (check.get("state") or "").upper()
            if state in ("FAILURE", "ERROR"):
                failing.append(name)
            elif state != "SUCCESS":
                pending = True
            continue
        if (check.get("status") or "").upper() != "COMPLETED":
            pending = True
            continue
        if (check.get("conclusion") or "").upper() not in ("SUCCESS", "NEUTRAL", "SKIPPED"):
            failing.append(name)
    if failing:
        return "FAILURE", failing
    if pending:
        return "PENDING", []
    return "SUCCESS", []


def fetch_pr() -> PullRequest | None:
    """The pull request of the current branch, or None when the branch has none."""
    result = run([TOOLS["gh"], "pr", "view", "--json", "number,state,statusCheckRollup,mergeable"])
    if result.returncode != 0:
        if "no pull requests found" in result.stderr.lower():
            return None
        raise OrchestratorError(f"gh pr view failed ({result.returncode}): {result.stderr.strip()}")
    data = json.loads(result.stdout)
    ci, failing = ci_state(data.get("statusCheckRollup") or [])
    return PullRequest(
        number=int(data["number"]),
        state=str(data.get("state", "")).upper(),
        mergeable=str(data.get("mergeable", "")).upper(),
        ci=ci,
        failing_checks=failing,
    )


def fetch_diff(pr: PullRequest) -> str:
    result = run([TOOLS["gh"], "pr", "diff", str(pr.number)], timeout=300)
    if result.returncode != 0:
        raise OrchestratorError(f"gh pr diff {pr.number} failed ({result.returncode}): {result.stderr.strip()}")
    return result.stdout


def ci_unsettled(pr: PullRequest) -> bool:
    # GitHub runs no pull_request workflow while a PR conflicts, so NONE + CONFLICTING is settled.
    if pr.state != "OPEN":
        return False
    if pr.mergeable == "UNKNOWN" or pr.ci == "PENDING":
        return True
    return pr.ci == "NONE" and pr.mergeable != "CONFLICTING"


def wait_for_ci(pr: PullRequest) -> PullRequest:
    """Poll until checks finish and GitHub knows the merge state. Waiting does not use a tick."""
    deadline = time.monotonic() + CI_TIMEOUT_SECONDS
    while ci_unsettled(pr):
        if time.monotonic() >= deadline:
            raise OrchestratorError(
                f"PR #{pr.number} CI still {pr.ci} (mergeable {pr.mergeable}) after {CI_TIMEOUT_SECONDS} s"
            )
        log(f"PR #{pr.number}: CI {pr.ci}, mergeable {pr.mergeable}; polling again in {CI_POLL_SECONDS} s")
        time.sleep(CI_POLL_SECONDS)
        refreshed = fetch_pr()
        if refreshed is None:
            raise OrchestratorError(f"PR #{pr.number} disappeared while waiting for CI")
        pr = refreshed
    return pr


def gather_context() -> Context:
    branch = git("branch", "--show-current") or "(detached HEAD)"
    status = git("status", "--short")
    history = git("log", "-n", "5", "--oneline")
    tracker = TRACKER_PATH.read_text(encoding="utf-8") if TRACKER_PATH.is_file() else ""
    specs = spec_files()
    done = completed_specs(tracker)
    remaining = [number for number in specs if number not in done]
    pr = fetch_pr()
    if pr is not None:
        pr = wait_for_ci(pr)
        if pr.state == "OPEN":
            pr.diff = fetch_diff(pr)
    return Context(
        branch=branch,
        status=status,
        log=history,
        tracker=tracker,
        completed=sorted(done & specs.keys()),
        remaining=remaining,
        active_spec=active_spec(branch, specs, remaining),
        pr=pr,
    )


def render_context(ctx: Context, tick: int, max_ticks: int, last_result: str, history: deque[str]) -> str:
    if ctx.pr is None:
        pr_block = "None for this branch."
    else:
        pr_block = (
            f"#{ctx.pr.number} state={ctx.pr.state} mergeable={ctx.pr.mergeable} CI={ctx.pr.ci}"
            + (f" failing={', '.join(ctx.pr.failing_checks)}" if ctx.pr.failing_checks else "")
        )
    spec_name = ctx.active_spec.name if ctx.active_spec else "none"
    spec_text = ctx.active_spec.read_text(encoding="utf-8") if ctx.active_spec else "(no active spec)"
    rules = WORKFLOW_RULES_PATH.read_text(encoding="utf-8") if WORKFLOW_RULES_PATH.is_file() else "(missing)"
    sections = [
        f"# Repository state, tick {tick} of {max_ticks}",
        f"## Branch\n{ctx.branch}",
        f"## git status --short\n{ctx.status or '(clean)'}",
        f"## git log -n 5 --oneline\n{ctx.log}",
        f"## Pull request\n{pr_block}",
        f"## Specs\nCOMPLETED SPECS: {', '.join(ctx.completed) or 'none'}\n"
        f"REMAINING SPECS: {', '.join(ctx.remaining) or 'none'}\nACTIVE SPEC: {spec_name}",
        f"## Last action result\n{last_result}",
        "## Recent actions\n" + ("\n".join(history) if history else "(none)"),
        f"## Active spec: {spec_name}\n{spec_text}",
        f"## docs/context/ai-workflow-rules.md\n{rules}",
        f"## docs/context/progress-tracker.md\n{truncate(ctx.tracker, TRACKER_CHAR_LIMIT)}",
    ]
    if ctx.pr is not None and ctx.pr.state == "OPEN":
        sections.append(f"## gh pr diff {ctx.pr.number}\n{truncate(ctx.pr.diff, DIFF_CHAR_LIMIT)}")
    return "\n\n".join(sections)


class Planner:
    def __init__(self, api_key: str, model: str) -> None:
        try:
            from google import genai
            from google.genai import types
        except ImportError as exc:
            raise ConfigError(
                "the google-genai package is missing. Run: pip install -r scripts/requirements.txt"
            ) from exc
        self._client = genai.Client(api_key=api_key)
        self._config = types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            response_mime_type="application/json",
            temperature=0.2,
        )
        self._model = model

    def decide(self, state: str) -> dict[str, Any]:
        last_error: Exception | None = None
        for attempt in range(1, GEMINI_ATTEMPTS + 1):
            try:
                response = self._client.models.generate_content(
                    model=self._model, contents=state, config=self._config,
                )
                data = json.loads(response.text or "")
                if not isinstance(data, dict):
                    raise ValueError(f"expected a JSON object, got {type(data).__name__}")
                return data
            except Exception as exc:  # API, transport and JSON errors all get the same retry
                if getattr(exc, "code", None) in (401, 403):
                    raise ConfigError(f"Gemini rejected GEMINI_API_KEY ({exc}). Check or replace the key.") from exc
                last_error = exc
                log(f"Gemini attempt {attempt}/{GEMINI_ATTEMPTS} failed: {exc}")
                if attempt < GEMINI_ATTEMPTS:
                    time.sleep(5 * 2 ** attempt)
        raise OrchestratorError(f"Gemini ({self._model}) failed {GEMINI_ATTEMPTS} times: {last_error}")


def parse_decision(data: dict[str, Any], ctx: Context) -> Decision:
    action = str(data.get("action", "")).strip().lower()
    tier = str(data.get("tier", "")).strip().lower()
    if action not in ("execute", "merge", "stop"):
        raise InvalidDecision(f"unknown action {action!r}")
    if tier not in MODEL_TIERS:
        raise InvalidDecision(f"unknown tier {tier!r}; expected one of {', '.join(MODEL_TIERS)}")
    decision = Decision(
        action=action,
        tier=tier,
        summary=str(data.get("summary", "")).strip(),
        prompt=str(data.get("prompt", "")).strip(),
        merge_body=str(data.get("merge_body", "")).strip(),
        audit_log=str(data.get("audit_log", "")).strip(),
        status=str(data.get("status", "")).strip(),
    )
    if action == "execute" and not decision.prompt:
        raise InvalidDecision("execute action without a prompt")
    if action == "stop" and decision.status not in (STOP_COMPLETE, STOP_FAILED):
        raise InvalidDecision(f"stop status must be {STOP_COMPLETE!r} or {STOP_FAILED!r}, got {decision.status!r}")
    if action == "stop" and decision.status == STOP_COMPLETE and ctx.remaining:
        raise InvalidDecision(f"{STOP_COMPLETE} while specs remain: {', '.join(ctx.remaining)}")
    if action == "merge":
        try:
            decision.pr_number = int(data.get("pr_number"))
        except (TypeError, ValueError) as exc:
            raise InvalidDecision(f"merge without a valid pr_number: {data.get('pr_number')!r}") from exc
        pr = ctx.pr
        # The merge gate is checked here, not trusted to the model.
        if pr is None or pr.number != decision.pr_number:
            raise InvalidDecision(f"merge of PR #{decision.pr_number}, which is not this branch's pull request")
        if pr.state != "OPEN" or pr.ci != "SUCCESS" or pr.mergeable != "MERGEABLE":
            raise InvalidDecision(
                f"merge refused: PR #{pr.number} state={pr.state} CI={pr.ci} mergeable={pr.mergeable}"
            )
        if not decision.merge_body or not decision.audit_log:
            raise InvalidDecision("merge needs both merge_body and audit_log")
    return decision


def write_audit(decision: Decision, ctx: Context) -> Path:
    LOG_DIR.mkdir(exist_ok=True)
    number = decision.pr_number or (ctx.pr.number if ctx.pr else 0)
    path = LOG_DIR / f"audit-pr-{number}-{datetime.now():%Y%m%d-%H%M%S}.md"
    spec_name = ctx.active_spec.name if ctx.active_spec else "none"
    path.write_text(
        f"# Audit: PR #{number}\n\n"
        f"- Time: {datetime.now().isoformat(timespec='seconds')}\n"
        f"- Branch: {ctx.branch}\n"
        f"- Spec: {spec_name}\n"
        f"- CI: {ctx.pr.ci if ctx.pr else 'n/a'}\n"
        f"- Action: {decision.action} ({decision.tier})\n\n"
        f"{decision.audit_log}\n",
        encoding="utf-8",
    )
    return path


def build_prompt(decision: Decision) -> str:
    return decision.prompt.rstrip() + EXECUTION_CONTRACT


def execute(decision: Decision) -> tuple[bool, str]:
    """Run Claude Code headless. The prompt goes through stdin so Windows argument quoting cannot mangle it."""
    flags = resolve_model(MODEL_TIERS[decision.tier])
    cmd = [TOOLS["claude"], "-p", *flags, "--dangerously-skip-permissions"]
    log(f"Executor: claude -p {' '.join(flags)} --dangerously-skip-permissions")
    started = time.monotonic()
    tail: deque[str] = deque(maxlen=OUTPUT_TAIL_LINES)
    proc = subprocess.Popen(
        cmd, cwd=REPO_ROOT, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        text=True, encoding="utf-8", errors="replace",
    )
    killed = threading.Event()

    def kill_on_timeout() -> None:
        killed.set()
        proc.kill()

    timer = threading.Timer(EXECUTOR_TIMEOUT_SECONDS, kill_on_timeout)
    timer.start()
    try:
        assert proc.stdin is not None and proc.stdout is not None
        proc.stdin.write(build_prompt(decision))
        proc.stdin.close()
        for line in proc.stdout:
            print(line, end="", flush=True)
            tail.append(line.rstrip())
        code = proc.wait()
    finally:
        timer.cancel()
    elapsed = int(time.monotonic() - started)
    header = f"Executor ({decision.tier}) exited {code} after {elapsed} s"
    if killed.is_set():
        header += f" (killed at the {EXECUTOR_TIMEOUT_SECONDS} s timeout)"
    return code == 0, f"{header}. Output tail:\n" + "\n".join(tail)


def merge(decision: Decision) -> tuple[bool, str]:
    cmd = [TOOLS["gh"], "pr", "merge", str(decision.pr_number), "--squash", "--body", decision.merge_body]
    log(f"Merge: gh pr merge {decision.pr_number} --squash --body <{len(decision.merge_body)} chars>")
    result = run(cmd, timeout=300)
    output = (result.stdout + result.stderr).strip()
    if result.returncode != 0:
        return False, f"gh pr merge {decision.pr_number} failed ({result.returncode}): {output}"
    return True, f"PR #{decision.pr_number} squash-merged. {output}"


def record(run_log: Path, entry: dict[str, Any]) -> None:
    with run_log.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(entry, ensure_ascii=False) + "\n")


def finish(status: str, reason: str) -> int:
    log(f"{status} - {reason}")
    return 0 if status == STOP_COMPLETE else 1


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--max-ticks", type=int, default=DEFAULT_MAX_TICKS,
                        help=f"loop iterations before giving up (default {DEFAULT_MAX_TICKS})")
    parser.add_argument("--dry-run", action="store_true",
                        help="run one tick: ask Gemini, print the decision, execute nothing")
    parser.add_argument("--show-context", action="store_true",
                        help="print the state Gemini would receive and exit (no API key needed)")
    return parser.parse_args()


def loop(args: argparse.Namespace, planner: Planner) -> int:
    LOG_DIR.mkdir(exist_ok=True)
    run_log = LOG_DIR / f"run-{datetime.now():%Y%m%d-%H%M%S}.jsonl"
    log(f"Gemini {GEMINI_MODEL}; tiers hard={MODEL_TIERS['hard']!r} simple={MODEL_TIERS['simple']!r}; "
        f"max {args.max_ticks} ticks; log {run_log}")
    last_result = "Orchestrator started; no action taken yet."
    history: deque[str] = deque(maxlen=HISTORY_LENGTH)
    failures = 0

    for tick in range(1, args.max_ticks + 1):
        log(f"--- tick {tick}/{args.max_ticks} ---")
        ctx = gather_context()
        if not ctx.remaining:
            return finish(STOP_COMPLETE, "every feature spec is marked completed in progress-tracker.md")

        raw = planner.decide(render_context(ctx, tick, args.max_ticks, last_result, history))
        entry: dict[str, Any] = {"tick": tick, "time": datetime.now().isoformat(timespec="seconds"),
                                 "branch": ctx.branch, "decision": raw}
        try:
            decision = parse_decision(raw, ctx)
        except InvalidDecision as exc:
            failures += 1
            last_result = f"Your previous decision was rejected: {exc}. Raw decision: {json.dumps(raw)}"
            entry["result"] = last_result
            record(run_log, entry)
            log(f"Rejected decision ({failures}/{MAX_CONSECUTIVE_FAILURES}): {exc}")
            if failures >= MAX_CONSECUTIVE_FAILURES:
                return finish(STOP_FAILED, f"{failures} consecutive failures; last: {exc}")
            continue

        log(f"Decision: {decision.action} [{decision.tier} -> {MODEL_TIERS[decision.tier]}] {decision.summary}")
        if decision.audit_log and not args.dry_run:
            log(f"Audit log written to {write_audit(decision, ctx)}")

        if decision.action == "stop":
            entry["result"] = decision.status
            record(run_log, entry)
            return finish(decision.status, decision.summary or "no reason given")

        if args.dry_run:
            if decision.action == "execute":
                print(f"\nWould run: claude -p {' '.join(resolve_model(MODEL_TIERS[decision.tier]))} "
                      f"--dangerously-skip-permissions\nPrompt (stdin):\n{build_prompt(decision)}\n")
            else:
                print(f"\nWould run: gh pr merge {decision.pr_number} --squash --body "
                      f"{json.dumps(decision.merge_body)}\nAudit log:\n{decision.audit_log}\n")
            entry["result"] = "dry run"
            record(run_log, entry)
            return 0

        ok, last_result = execute(decision) if decision.action == "execute" else merge(decision)
        entry["result"] = last_result
        entry["ok"] = ok
        record(run_log, entry)
        history.append(f"tick {tick}: {decision.action} [{decision.tier}] "
                       f"{'ok' if ok else 'FAILED'} - {decision.summary}")
        if ok:
            failures = 0
            continue
        failures += 1
        log(f"Action failed ({failures}/{MAX_CONSECUTIVE_FAILURES})")
        if failures >= MAX_CONSECUTIVE_FAILURES:
            return finish(STOP_FAILED, f"circuit breaker: {failures} consecutive non-zero exits")

    log(f"Tick budget of {args.max_ticks} exhausted; repository state is preserved, rerun to continue.")
    return 3


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    args = parse_args()
    try:
        if args.show_context:
            resolve_tools()
            ctx = gather_context()
            print(render_context(ctx, 0, args.max_ticks, "(context preview)", deque()))
            return 0
        api_key = os.getenv("GEMINI_API_KEY", "").strip()
        if not api_key:
            raise ConfigError(
                "GEMINI_API_KEY is not set.\n"
                "Set it in the environment or add GEMINI_API_KEY=<key> to the repository root .env file.\n"
                "Create a key at https://aistudio.google.com/apikey"
            )
        resolve_tools()
        planner = Planner(api_key, GEMINI_MODEL)
        return loop(args, planner)
    except ConfigError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    except OrchestratorError as exc:
        return finish(STOP_FAILED, str(exc))
    except KeyboardInterrupt:
        log("Interrupted.")
        return 130


if __name__ == "__main__":
    sys.exit(main())
