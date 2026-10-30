# Workflow orchestrator

`orchestrator.py` drives the spec-driven workflow without a human in the loop. Gemini Flash plans each unit of work and reviews pull requests once CI is green; Claude Code runs headless and does the work. The loop moves from spec to spec until every spec in `docs/context/progress-tracker.md` is under **Completed**.

> **Warning.** The executor runs with `--dangerously-skip-permissions` and the orchestrator squash-merges to `main` with no human review. This skips rule 6 of `docs/context/ai-workflow-rules.md` ("reviewed and approved by someone other than the author"). Run it only on a repository and machine where that is acceptable.

## Each tick

1. Gather state: `git branch --show-current`, `git status --short`, `git log -n 5 --oneline`, `progress-tracker.md`, the active spec, and the branch's pull request (`gh pr view --json number,state,statusCheckRollup,mergeable`, plus `gh pr diff` while it is open).
2. If the pull request's CI is still running, poll until it settles. Waiting does not use a tick.
3. Ask Gemini for one action:
   - **execute** (Mode A): a three-step prompt (Setup → Context/Tracking → Execute), run as
     `claude -p --model <model> [--effort <level>] --dangerously-skip-permissions` with the prompt on stdin.
   - **merge** (Mode B): the pull request is open, CI is `SUCCESS` and it is `MERGEABLE`; Gemini checked the diff against the active spec. The orchestrator writes the audit log and runs `gh pr merge <number> --squash --body "..."`.
   - **stop**: `STOP: COMPLETE` (all specs completed) or `STOP: FAILED` (open gate, executor reported `BLOCKED:`, unrecoverable state).
4. Record the decision and result in `.orchestrator/run-<timestamp>.jsonl`.

The merge gate (open PR of the current branch, CI `SUCCESS`, `MERGEABLE`) is checked by the script, not trusted to Gemini.

## Setup

Requires Python 3.10+, `git`, the GitHub CLI `gh` (logged in with `gh auth login`) and Claude Code `claude` (logged in), all on `PATH`.

```bash
python -m venv .venv
# Windows (PowerShell): .venv\Scripts\Activate.ps1    macOS/Linux: source .venv/bin/activate
pip install -r scripts/requirements.txt
```

### GEMINI_API_KEY

Create a key at <https://aistudio.google.com/apikey>, then either export it:

```bash
export GEMINI_API_KEY=...            # bash
$env:GEMINI_API_KEY = "..."          # PowerShell
```

or add it to the repository root `.env` (already git-ignored):

```dotenv
GEMINI_API_KEY=...
```

Real environment variables win over `.env`. From `.env` the script reads only `GEMINI_*`, `CLAUDE_MODEL_*` and `ORCH_*` keys; when run from a git worktree it also falls back to the main checkout's `.env`. Without a key it exits with code 2 and says how to set one.

## Run

```bash
python scripts/orchestrator.py                  # full loop, at most 30 ticks
python scripts/orchestrator.py --max-ticks 10
python scripts/orchestrator.py --dry-run        # one tick: print Gemini's decision, execute nothing
python scripts/orchestrator.py --show-context   # print the state Gemini would receive (no key needed)
```

Exit codes: `0` STOP: COMPLETE · `1` STOP: FAILED · `2` configuration error (missing key, package or CLI) · `3` tick budget used up · `130` interrupted.

## Model tiers

Gemini tags every action `hard` or `simple`; the tier picks the Claude model.

| Tier | Used for | Default |
|---|---|---|
| `hard` | feature implementation, production code, refactoring, unit and integration test suites, fixing CI or review defects | `opus 5.5 high` |
| `simple` | commits, pushes, opening PRs, docs and progress-tracker updates, squash-merging, chore scripts | `sonnet 5.5 high` |

Override with environment variables (or `.env`):

```bash
CLAUDE_MODEL_HARD="opus 5.5 max"
CLAUDE_MODEL_SIMPLE="sonnet"
```

`claude --model` takes an alias (`opus`, `sonnet`, `fable`) or a full model ID, and the effort level is a separate `--effort` flag. The script translates the tier string: a trailing `low`/`medium`/`high`/`xhigh`/`max` becomes `--effort`, and `<family> <version>` becomes the full ID. So `opus 5.5 high` runs `--model claude-opus-5-5 --effort high`; `sonnet` runs `--model sonnet` with the session's default effort; `claude-opus-5-5` passes through.

## Other settings

| Variable | Default | Meaning |
|---|---|---|
| `GEMINI_MODEL` | `gemini-flash-latest` | Gemini model for planning and review |
| `ORCH_CI_POLL_SECONDS` | `60` | Seconds between CI status polls |
| `ORCH_CI_TIMEOUT_SECONDS` | `1800` | Give up (`STOP: FAILED`) if CI has not settled by then |
| `ORCH_EXECUTOR_TIMEOUT_SECONDS` | `3600` | Kill a Claude run after this long (counts as a failure) |

## Circuit breaker

Two consecutive failures end the run with `STOP: FAILED`: a non-zero exit from `claude`, a failed `gh pr merge`, or a Gemini decision the script refuses (unknown action or tier, merge of a PR that is not green and mergeable). Any successful action resets the count. Gemini API errors are retried 3 times with backoff before the run stops.

## Logs

`.orchestrator/` (git-ignored) holds `run-<timestamp>.jsonl` (one line per tick: state, decision, result) and `audit-pr-<number>-<timestamp>.md` (each review's audit log).
