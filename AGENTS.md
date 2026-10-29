# AGENTS.md — EpistemicTrace

This is the shared context and operating rules for **every AI coding agent and human contributor** working in this repository: Claude Code, Codex, Copilot, Cursor and others.

It is intentionally short. The detail lives in two companion files:

| File | Read it for |
|---|---|
| [`docs/PROJECT.md`](docs/PROJECT.md) | What we are building and why: requirements, architecture, data model, data flow, decisions, open questions. |
| [`docs/TRELLO.md`](docs/TRELLO.md) | How work is organized: board workflow, every card's acceptance criteria, dependencies, milestones, progress. |

> **Before making any change, read this file, then the parts of `docs/PROJECT.md` and `docs/TRELLO.md` that relate to your task.** Preserve established decisions, and update these documents in the same change when your work affects them.

---

## 1. Project in one minute

- **What it is:** EpistemicTrace (Team Episteme Labs, CIT-U CSIT321) is a web-based Python coding platform. It records **how** students solve problems (edits, test runs, errors, pass counts, timing) and computes a **Struggle Dynamics Index (SDI, 0–100)**.
- **The circuit breaker:** when the SDI reaches a threshold (default 70), a **Metacognitive Circuit Breaker** locks the test runner until the student writes a hypothesis and a planned fix.
- **Users:** **students** and **instructors**. The course professor only monitors the project; they are not an app user role and never take tasks.
- **MVP:** the full loop of login → solve an activity → telemetry → SDI → breaker locks → reflection → reflection appears in history.

**Current state (2026-10-29):** repository scaffold only.

- **Backend:** a Spring Boot app with `GET /api/health`.
- **Frontend:** still the Vite starter page.
- **Board:** no feature cards started. Details: [`docs/PROJECT.md` §11](docs/PROJECT.md#11-implementation-plan-and-status).

## 2. Sources of truth

When two sources disagree, use this order, and **report the conflict** instead of silently picking one.

| Topic | Authoritative source |
|---|---|
| Decisions, requirements, invariants, open questions | `docs/PROJECT.md` (§6, §14, §15) |
| A card's scope, acceptance criteria, dependencies | The Trello card, mirrored in `docs/TRELLO.md` §8 |
| A card's status, owner, due date | Trello (`docs/TRELLO.md` §11 is only a dated snapshot) |
| What the code actually does | The code |
| Setup overview | `README.md`. It has known conflicts with the requirements (`docs/PROJECT.md` §16, R-01 to R-03); `docs/PROJECT.md` wins until the team reconciles them. |

**Board:** https://trello.com/b/nwPfFX7D/episteme-labs-epistemictrace. Agents usually cannot access it, so rely on `docs/TRELLO.md` and say how old its snapshot is.

## 3. Tech stack

The full table with status and sources is in [`docs/PROJECT.md` §8.1](docs/PROJECT.md#81-technology-stack).

| Layer | Stack | Status |
|---|---|---|
| Frontend | React 19, TypeScript ~6.0, Vite 8, `@monaco-editor/react`, Vitest, oxlint | In repo |
| Code execution | Pyodide in a Web Worker with a time limit (Python only) | Decided, not yet added |
| Backend | Java 21, Spring Boot 4.1.2 (`webmvc`, `validation`), Maven wrapper, JUnit 5 + MockMvc | In repo |
| Auth | Spring Security + JWT | Decided, not yet added |
| Database | PostgreSQL via Spring Data JPA | Decided, not yet added |
| CI, hosting, frontend router/state/HTTP/UI/chart libraries, AI provider | — | **Not decided** |

**Do not add a framework or library outside this table** without first recording a decision in `docs/PROJECT.md` §14, in the same PR, for the team to review.

## 4. Repository map

```text
AGENTS.md                 ← you are here
CLAUDE.md                 ← imports this file for Claude Code
README.md                 overview + setup
.env.example              DB_URL, DB_USERNAME, DB_PASSWORD, JWT_SECRET, VITE_API_URL
frontend/                 Vite + React + TS app (src/, public/, oxlint, tsconfig*)
backend/                  Spring Boot app, Maven wrapper
  src/main/java/com/episteme/epistemictrace/   EpistemictraceApplication, CorsConfig, HealthController
  src/test/java/com/episteme/epistemictrace/   *Tests.java (JUnit 5)
docs/                     PROJECT.md, TRELLO.md
tests/                    cross-cutting tests (empty; usage not decided)
.github/                  CI/PR config (empty; PR template comes with SP-07)
```

## 5. Commands

Prerequisites: Node.js 20+ and JDK 21 (README). Copy `.env.example` to `.env` for local values, and never commit `.env`.

```bash
# Frontend (from frontend/)
npm ci                 # install exactly from package-lock.json
npm run dev            # http://localhost:5173
npm run build          # tsc -b && vite build
npm run lint           # oxlint
npm test               # vitest run

# Backend (from backend/; on Windows use mvnw.cmd)
./mvnw test
./mvnw spring-boot:run # http://localhost:8080
curl http://localhost:8080/api/health   # {"status":"ok"}
```

**Known state (verified 2026-10-29):**

- **Frontend:** `build` and `lint` pass. `npm test` exits 1 with "No test files found" until the first test is added. Add a real test; don't work around it.
- **Backend:** the backend tests were not runnable in the documentation environment because Maven Central was unreachable. Run `./mvnw test` locally before relying on them.

## 6. Invariants: never break these

Each rule maps to a requirement in [`docs/PROJECT.md` §6.2](docs/PROJECT.md#62-quality-and-constraint-requirements). If a task seems to require breaking one, stop and ask.

1. **Sandboxed execution:** student code runs only in a browser Web Worker, with a time limit that stops infinite loops (NFR-01).
2. **Telemetry scope:** telemetry is captured only on the activity page, after the consent notice (NFR-02, NFR-07).
3. **Ownership:** a student can write only their own events; session data is visible only to that student and their instructor (NFR-03).
4. **SDI bounds:** the SDI is always 0–100, recalculated after each run, and **never used for grading or penalties** (NFR-04, NFR-05).
5. **Student wording:** students see struggle *levels* (low/medium/high), never raw scores or punishing wording (NFR-05).
6. **Editor stays usable:** the editor remains usable while the runner is locked (NFR-06).
7. **Configurable SDI settings:** weights, window, threshold and cooldown are configuration, not hard-coded constants. Their values are still open (Q-01); the threshold default is 70.
8. **No secrets:** no real secrets, credentials or `.env` files in commits (NFR-10).
9. **AI assistance:** if built, it never returns a full solution and its responses are logged (NFR-11).

## 7. Coding conventions

**Agreed** (Trello SP-07; `CONTRIBUTING.md` will formalize them):

- **Branches:** `feature/<issue#>-<short-name>` or `fix/<issue#>-<short-name>`.
- **`main` is stable only.** Never commit or push directly to `main`.
- **Reviews:** every change merges through a pull request reviewed by at least one person who is not the author. The professor is never the reviewer.

**Observed in the scaffold** (keep consistent until a team decision says otherwise):

- **Java:**
  - Every class lives under `com.episteme.epistemictrace`.
  - Indent with tabs, as Spring Initializr generates.
  - Test classes are named `<Subject>Tests`. Use plain MockMvc (`standaloneSetup`) for controller slices and `@SpringBootTest` only for context tests.
- **TypeScript/React:**
  - ES modules, function components, 2-space indent, single quotes, no semicolons (as in `vite.config.ts` and `App.tsx`).
  - Keep the `tsconfig.app.json` checks (`noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, …) and the oxlint rules passing.
  - Note: `strict` is not enabled in `tsconfig.app.json`. Do not change that without a team decision.
- **Commit messages:** the only commit so far uses a Conventional Commits prefix (`chore: …`). Use `type: summary` (`feat`, `fix`, `docs`, `test`, `chore`, `refactor`) until SP-07 defines the format.
- **API paths:** all endpoints live under `/api`. CORS currently allows `http://localhost:5173` only.

**Not yet decided** (ask, or propose in the PR and record it in `docs/PROJECT.md`):

- the backend package structure below the root (Q-18);
- REST paths and payloads (Q-07);
- the telemetry batch schema (Q-08);
- frontend routing, state and HTTP libraries;
- how the `tests/` folder is used.

## 8. How to work on a task

1. **Find the card.** Every code change maps to one Trello card ID (for example `TEL-03`). Read its acceptance criteria in `docs/TRELLO.md` §8, and the matching feature spec in `docs/PROJECT.md` §7.
2. **Check readiness.**
   - All *Depends on* cards must be done. The graph is in `docs/TRELLO.md` §9.
   - Check `docs/PROJECT.md` §15 for open questions that block the card.
   - If a blocking question is unanswered, do not guess silently. Either ask, or implement behind configuration, label the choice **Assumption** in the PR, and add or extend the question.
3. **Branch** from up-to-date `main` using the naming convention above.
4. **Implement the smallest change** that meets the acceptance criteria. Don't refactor unrelated code or delete the `.gitkeep` placeholders.
5. **Test.**
   - Add or extend tests for the behavior: JUnit for the backend, Vitest for the frontend. The SDI and the circuit breaker need deterministic unit tests (seeded wheel-spinning vs steady-progress sequences).
   - Run the relevant commands in §5 and report their real output. Never claim a check passed without running it.
6. **Update the docs in the same change** (see §9).
7. **Open a PR** that names the card ID, links its GitHub issue, explains what changed and how it was tested, and lists any assumptions. Moving the Trello card and attaching evidence is the team's job. Agents do not move, create or edit Trello cards unless a team member explicitly asks.

## 9. Keeping documentation current

| If your change… | Update |
|---|---|
| Adds or changes a requirement, invariant or feature behavior | `docs/PROJECT.md` §6–§7 |
| Introduces or changes a library, framework, service or architectural boundary | `docs/PROJECT.md` §8 and a new §14 decision row (mark replaced decisions *Superseded*) |
| Changes the data model or the API | `docs/PROJECT.md` §8.4 / §9 |
| Answers an open question | Move it from `docs/PROJECT.md` §15 into the relevant section or §14 |
| Changes card scope, acceptance criteria, estimates, owners or dependencies | `docs/TRELLO.md` §8–§9 (and the Trello card, by a team member) |
| Changes commands, setup or repo layout | §4–§5 of this file and `README.md` |
| Changes agent rules or conventions | This file |

**Additional rules:**

- **Dates:** bump *Last reconciled* or *Snapshot date* when you edit those files.
- **Reconcile, don't overwrite:** if documentation disagrees with the code or the board, reconcile it. Record the conflict (for example in `docs/PROJECT.md` §16) instead of overwriting another author's content.

## 10. Never do

- Change a **Decided** item in `docs/PROJECT.md` §14 (stack, roles, SDI principles, workflow) on your own initiative.
- Present invented API paths, schemas, thresholds or dates as agreed. Label proposals as **Proposed** or **Assumption**.
- Report progress that did not happen: ticking acceptance criteria, saying a card is done, or claiming tests pass without running them.
- Commit secrets, `.env` files, personal data or real student telemetry.
- Assign work or reviews to the professor (Member D).
- Bypass review: push to `main`, merge your own PR, or force-push shared branches.

## 11. Definition of Done

This is the team's board rule ([`docs/TRELLO.md` §3](docs/TRELLO.md#3-workflow-rules)). A card is **Done** only when:

1. The code is merged to `main` through a PR approved by a non-author reviewer.
2. Every acceptance criterion on the card has been verified.
3. Evidence (screenshots or test output) is attached to the card.
4. Affected documentation is updated (§9).

---

*Maintenance: keep this file under ~250 lines. Put detail in `docs/PROJECT.md` or `docs/TRELLO.md` and link to it from here.*
