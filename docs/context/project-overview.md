# EpistemicTrace

## Overview

EpistemicTrace is a web-based Python coding platform that tracks *how* students solve problems, not only whether their final code passes. Students write and run Python in the browser. The platform records their edits, test runs, errors and timing, computes a Struggle Dynamics Index (SDI, 0–100) after every run, and pauses the test runner with a Metacognitive Circuit Breaker when a student is wheel-spinning. The student unlocks the runner by writing a hypothesis and a planned fix. Instructors see process analytics so they know which students and activities need help.

`PROJECT.md` at the repository root is the source of truth for product decisions. This file restates it for the coding agent. If the two disagree, `PROJECT.md` wins and this file is corrected in the same pull request.

## Goals

1. Let students and instructors register, log in and see only the pages for their role.
2. Let instructors create, edit, publish and archive Python activities with test cases.
3. Let students write Python in the browser and run it against test cases in a sandbox.
4. Record each student's edits, runs and errors per session, only on the activity page and only after consent.
5. Compute the SDI after every run and lock the test runner when it reaches the threshold.
6. Require a hypothesis and a planned fix to unlock the runner, then apply a cooldown.
7. Let students review their past sessions and reflections.

## Core User Flow

### Student

1. Student registers or logs in.
2. Student sees the list of published activities.
3. Student opens an activity. The first time, a consent notice is shown.
4. A coding session starts (or resumes after a refresh).
5. Student reads the problem statement, edits code and clicks **Run tests**.
6. Code runs in a sandboxed Web Worker; pass/fail per test and any runtime error are shown.
7. Each run is recorded and the server recomputes the SDI.
8. When the SDI reaches the threshold, **Run tests** is disabled. The editor stays usable.
9. Student writes a hypothesis and a planned fix. The runner unlocks and a cooldown starts.
10. Student leaves the page; the session end is recorded.
11. Student reviews past sessions and reflections on the history page.

### Instructor

1. Instructor logs in (instructor accounts are not self-registered; see Q3 in `progress-tracker.md`).
2. Instructor creates an activity: title, problem statement, starter code, test cases.
3. Instructor publishes the activity so students can see it.
4. Instructor edits or archives activities.
5. (Should have, after MVP) Instructor reviews analytics, reflections and alerts.

## Features

### Accounts and Roles (PLT-01)

- Register, log in, log out.
- Role (`STUDENT` / `INSTRUCTOR`) stored on the account.
- Pages and API endpoints restricted by role.

### Activity Management (PLT-02)

- Instructors create, edit, publish and archive activities.
- Each activity has a problem statement, starter code and one or more test cases (input, expected output, hidden flag).
- Students see only published activities.

### Coding Workspace (CW-01, CW-02, CW-03)

- Monaco editor with Python highlighting; code survives a page refresh.
- Code runs in Pyodide inside a Web Worker with a time limit that stops infinite loops.
- Pass/fail per test case and runtime errors are shown.
- Problem statement, editor and results are visible together on desktop.

### Telemetry and Consent (TEL-01, TEL-02, consent notice)

- Consent notice before a student's first session.
- `EDIT`, `RUN` and `ERROR` events captured on the activity page only, buffered and sent in batches.
- The server stores events per session and rejects events for sessions the student does not own.

### Struggle Dynamics Index (TEL-03)

- Four signals over a rolling window: test-run frequency, edit-to-run time, repeated error signatures, no-progress runs.
- Normalize, weight, sum, multiply by 100, clamp to 0–100.
- Saved on the run event; the session's peak SDI is updated.

### Metacognitive Circuit Breaker (MCB-01, MCB-02)

- Locks the runner when SDI ≥ threshold (default 70) and no cooldown is active.
- Unlocks after a valid reflection (hypothesis + planned fix, minimum length).
- Cooldown prevents an immediate re-trigger.
- The lock survives a page refresh.

### Student History (STU-01)

- List of past sessions with date, activity, duration and reflections.

### Should Have (after MVP)

- Struggle level indicator for students (STU-02) — specced as `28-struggle-level-indicator.md`.
- Instructor dashboard (INS-01), difficulty heatmap (INS-02), per-activity SDI settings (INS-03), repeated-trigger alerts (INS-04), JSON/CSV export (INS-05), instructor reflection review.

### Could Have

- AI Socratic assistant (AI-01), AI reflection questions (AI-02), instructor fallback prompts (AI-03).

## Scope

### In Scope

- Authentication and role-based access
- Activity and test-case management
- In-browser Python editor with local draft persistence
- Sandboxed execution in a Web Worker with a time limit
- Consent notice
- Session and telemetry capture and storage
- SDI computation after every run
- Circuit breaker lock, reflection, cooldown
- Student session and reflection history

### Out Of Scope

- Languages other than Python
- Real-time collaborative editing
- Grading or penalties based on the SDI
- Server-side execution of student code
- Courses, sections and enrollment (MVP shows every published activity to every student; see Q3)
- Should-have and could-have features until every must-have spec is done
- Mobile-native applications

## Success Criteria

1. A student and an instructor can register or be seeded, log in, and reach only their role's pages.
2. An instructor can create, publish and archive an activity with test cases, and students see only published ones.
3. A student can write Python, refresh without losing code, and run it against tests with pass/fail per test; an infinite loop is stopped.
4. Edits, runs and errors are stored per session only after consent and only from the activity page.
5. A seeded wheel-spinning sequence scores above 70 and a steady-progress sequence scores below 70 in unit tests.
6. Reaching the threshold disables **Run tests** (editor still usable), a valid reflection unlocks it, and a cooldown prevents an immediate re-trigger, including across a refresh.
7. A student can see their past sessions and reflections, and never sees a raw SDI value.
