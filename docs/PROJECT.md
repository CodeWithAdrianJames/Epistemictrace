# EpistemicTrace — Project Context

> **Read this first.** This is the single source of project context for team members and AI agents. Keep it accurate: when a decision, requirement or convention changes, update this file in the same pull request.

**Last updated:** 2026-10-29 · **Team:** Episteme Labs (CIT-U, CSIT321) · **Board:** https://trello.com/b/nwPfFX7D/episteme-labs-epistemictrace

---

## 1. What we are building

EpistemicTrace is a web-based **Python coding platform** that tracks *how* students solve problems, not only whether their final code passes.

1. Students write and run Python in the browser.
2. The platform records their edits, test runs, errors, passing-test counts and timing.
3. It computes a **Struggle Dynamics Index (SDI, 0–100)**, which rises when a student is *wheel-spinning*: repeating rapid edit-and-run cycles without making progress.
4. When the SDI reaches the threshold (default **70**), a **Metacognitive Circuit Breaker** pauses the test runner. The student must write a **hypothesis** about what is wrong and a **planned fix** before testing again.
5. Instructors see process analytics, so they know which students and activities need help.

**Why:** grading tools show only final results. Students stuck in trial and error get no help during the session, and instructors find out too late.

## 2. Users and team

| Role | Description |
|---|---|
| **Student** (app role) | Opens published activities, writes and runs code, answers reflection prompts, reviews own history |
| **Instructor** (app role) | Creates activities and test cases, adjusts SDI settings, views analytics, reviews student reflections |
| Adrian Bona — Member A | Hardest implementation parts: execution sandbox, SDI engine, circuit breaker |
| Noel Arcenio Cortes — Member B | Developer |
| Jacob Roph A. Bucton — Member C | Developer; also owns process and documentation tasks |
| Course professor — Member D | **Monitors only.** Never an assignee or reviewer |

## 3. Scope

**Must have (MVP):**

| ID | Requirement | Card |
|---|---|---|
| M1 | Register, log in, log out; pages restricted by role | PLT-01 |
| M2 | Instructors create, edit, publish and archive activities, with a problem statement and test cases | PLT-02 |
| M3 | In-browser Python editor (Monaco) that keeps code after a refresh | CW-01, CW-03 |
| M4 | Run code against test cases in a sandboxed Web Worker with a time limit; show pass/fail per test and any runtime error | CW-02, CW-03 |
| M5 | Record edits, runs, errors, pass counts and timestamps per session, only on the activity page | TEL-01, TEL-02 |
| M6 | Compute the SDI (0–100) after every test run | TEL-03 |
| M7 | Lock the runner at the threshold; unlock after a hypothesis and planned fix; apply a cooldown | MCB-01, MCB-02 |
| M8 | Students review their past sessions and reflections | STU-01 |

**Should have:**

- Instructor dashboard: runs, session time, peak SDI and breaker triggers per student (INS-01).
- Difficulty heatmap (INS-02).
- Per-activity SDI threshold and cooldown (INS-03).
- Repeated-trigger alerts (INS-04).
- JSON/CSV export with anonymization (INS-05).
- Low/medium/high struggle indicator for students (STU-02).

**Could have:**

- AI Socratic assistant (AI-01).
- AI-generated reflection questions (AI-02).
- Instructor-written fallback prompts (AI-03).

**Out of scope:** languages other than Python, real-time collaborative editing, and grading with the SDI.

**Also in the CSIT321 doc but missing a card:**

- A consent notice before a student's first session.
- Instructor review of student reflections.

## 4. Rules that must never be broken

1. **Sandboxed execution:** student code runs **only in a browser Web Worker**, with a time limit that stops infinite loops.
2. **Telemetry scope:** telemetry is captured **only on the activity page**, after the consent notice.
3. **Ownership:** a student can write only their own events; session data is visible only to that student and their instructor.
4. **SDI bounds:** the SDI is always **0–100** and is **never used for grading or penalties**.
5. **Student wording:** students see struggle **levels** (low/medium/high), never raw scores or punishing wording.
6. **Editor stays usable:** the editor remains usable while the runner is locked.
7. **Configurable SDI settings:** weights, window, threshold and cooldown are **configuration, not hard-coded constants**.
8. **No secrets:** no real secrets, `.env` files or real student data are ever committed.
9. **AI limits:** the AI assistant, if built, never returns a full solution, and its responses are logged.

## 5. How it works

**Session and telemetry**

1. Opening an activity starts a session.
2. `EDIT`, `RUN` and `ERROR` events are timestamped, buffered and sent to the API in batches.
3. The server rejects a batch for a session the student does not own.
4. Leaving the page records the session end.

**SDI**

After every run, four signals are measured over a rolling window:

| # | Signal | Raises SDI when… |
|---|---|---|
| 1 | Test-run frequency | tests are run often |
| 2 | Edit-to-run time | little time passes between an edit and the next run |
| 3 | Repeated error signatures | the same error keeps recurring |
| 4 | No-progress runs | runs pass without an increase in passing tests |

**Calculation:**

- Normalize each signal.
- Take the weighted sum.
- Multiply by 100 and clamp to 0–100.

**Recording:** the value is saved on the run event, and the session's peak SDI is updated.

**Circuit breaker**

```
Unlocked ──(SDI ≥ threshold, no cooldown)──► Locked ──(valid reflection)──► Cooldown ──(time passes)──► Unlocked
```

- **While locked:** "Run tests" is disabled, but the editor works.
- **The reflection:** two required fields, a hypothesis and a planned fix, each with a minimum length. It is saved with the timestamp and the SDI at trigger.

## 6. Tech stack

| Layer | Technology | Status |
|---|---|---|
| Frontend | React 19, TypeScript, Vite 8, Monaco (`@monaco-editor/react`), Vitest, oxlint | In repo |
| Code execution | Pyodide (Python) in a Web Worker with a time limit | Decided, not yet added |
| Backend | Java 21, Spring Boot 4.1, Maven wrapper, JUnit 5 + MockMvc | In repo |
| Auth | Spring Security + JWT | Decided, not yet added |
| Database | PostgreSQL via Spring Data JPA | Decided, not yet added |
| CI, hosting, DB migrations, frontend router/state/UI libraries, AI provider | — | **Not decided** |

Do not add a library or framework outside this table without a team decision recorded here.

## 7. Data model

| Entity | Key fields |
|---|---|
| USER | id, name, email, password_hash, role (STUDENT / INSTRUCTOR), consent_accepted_at |
| ACTIVITY | id, instructor_id, title, problem_statement, starter_code, status (DRAFT / PUBLISHED / ARCHIVED) |
| TEST_CASE | id, activity_id, input, expected_output, is_hidden |
| SDI_CONFIG | id, activity_id, threshold (default 70), cooldown_seconds, window_minutes |
| CODING_SESSION | id, student_id, activity_id, started_at, ended_at, peak_sdi |
| TELEMETRY_EVENT | id, session_id, type (EDIT / RUN / ERROR), timestamp, chars_added/removed, passed/total_count, error_signature, sdi_value |
| REFLECTION | id, session_id, hypothesis, planned_fix, sdi_at_trigger, submitted_at |
| ALERT | id, student_id, activity_id, trigger_count, dismissed |
| DEBUGGING_PROMPT | id, activity_id, prompt_text |

**Relationships:**

- An activity has one or more test cases and one SDI config.
- A session belongs to one student and one activity, and holds events and reflections.

**Gap:** there is no course or enrollment link between students and instructors yet.

## 8. Repository and commands

```text
frontend/   React + TypeScript (Vite) — still the starter page
backend/    Spring Boot — package com.episteme.epistemictrace (GET /api/health only)
docs/       project documentation
tests/      cross-cutting tests (empty)
.github/    CI and PR config (empty)
```

Prerequisites: Node.js 20+ and JDK 21. Copy `.env.example` to `.env` (`DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `JWT_SECRET`, `VITE_API_URL`).

```bash
# frontend/
npm ci && npm run dev     # http://localhost:5173
npm run build && npm run lint
npm test                  # fails until the first test exists

# backend/  (Windows: mvnw.cmd)
./mvnw test
./mvnw spring-boot:run    # http://localhost:8080/api/health → {"status":"ok"}
```

## 9. Conventions

- **Branches:** `feature/<issue#>-<name>` or `fix/<issue#>-<name>`. `main` is stable only: no direct pushes.
- **Reviews:** every change goes through a pull request approved by someone other than the author.
- **Commits:** `type: summary` (`feat`, `fix`, `docs`, `test`, `chore`, `refactor`).
- **Java:**
  - Classes under `com.episteme.epistemictrace`.
  - Tab indentation.
  - Test classes named `<Subject>Tests`.
- **TypeScript:**
  - Function components.
  - 2-space indent, single quotes, no semicolons.
  - Lint and type checks must pass.
- **API:** all endpoints under `/api`. CORS currently allows `http://localhost:5173` only.
- **Tests:** the SDI and the circuit breaker need deterministic unit tests: a seeded wheel-spinning sequence scores **above** 70, and a steady-progress sequence scores **below** it.
- **Board workflow:** Backlog → To Do → In Progress → For Review (PR open) → Testing (approved) → Done (criteria verified, evidence attached).
  - Maximum 2 cards In Progress per member.
- **Done means:**
  - merged through a reviewed PR;
  - every acceptance criterion verified;
  - evidence attached to the card;
  - this file updated if anything here changed.

## 10. Current status (2026-10-29)

- **Repo:** scaffold only. Security, JPA, PostgreSQL and Pyodide are not added yet. No GitHub issues exist.
- **Board:** no feature work has started.
  - **To Do:** PLT-01, CW-01, TEL-01, TEL-03 and the process tasks SP-01, SP-04, SP-05, SP-07.
- **Dates:** no due dates are set except CW-01's, which has passed.

## 11. Open questions

| # | Question | Blocks |
|---|---|---|
| 1 | SDI weights, normalization, window length and default cooldown | TEL-03, MCB-01 |
| 2 | Is the SDI computed in the browser or on the server, and which is authoritative? | TEL-03, MCB-01 |
| 3 | How students are linked to instructors (course/enrollment); how instructor accounts are created | PLT-01, PLT-02, TEL-02 |
| 4 | Telemetry batch format, when batches are sent, how error signatures are defined | TEL-01, TEL-02 |
| 5 | REST API paths and payloads | All API work |
| 6 | Consent notice text and what happens if a student declines; data retention | TEL-01 |
| 7 | Execution time limit; reflection minimum length; how hidden tests are shown | CW-02, MCB-02 |
| 8 | CI, hosting and deployment | Release |
| 9 | Term dates, MVP demo date, pilot plan | Planning |

When a question is answered, move the answer into the relevant section above and delete the row.

## 12. Glossary

| Term | Meaning |
|---|---|
| **Wheel-spinning** | Repeated attempts without progress: rapid edit–run cycles, the same errors, no gain in passing tests. |
| **SDI** | Struggle Dynamics Index: a 0–100 score from four telemetry signals. |
| **Circuit breaker** | Locks the test runner at the SDI threshold until a reflection is submitted. |
| **Reflection** | The student's hypothesis and planned fix, saved with the SDI at trigger. |
| **Cooldown** | The period after a reflection during which the breaker cannot trigger again. |
| **Session** | One student's continuous work on one activity page. |
