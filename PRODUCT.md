# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Students (primary).** Intro Python learners in the CIT-U CSIT321 pilot. They work alone in a browser on a published activity, often mid-struggle: re-running tests, making tiny edits, getting the same error. Job: solve the problem, and when stuck, rethink the approach instead of looping.
- **Instructor (secondary).** Creates and publishes activities with test cases, then reads process analytics (which students and activities struggle). Instructor accounts are seeded, not self-registered.
- **Course professor.** Monitors only; never edits or runs student code.
- When student and instructor needs conflict, the student's workspace and pause-and-reflect flow win.

## Product Purpose

EpistemicTrace is a browser-based Python coding platform that tracks *how* students solve problems, not only whether the final code passes. Students write and run Python against test cases. The server computes a Struggle Dynamics Index (SDI, 0-100) after every run from edit, run, and error telemetry. When the SDI reaches the threshold (default 70), a Metacognitive Circuit Breaker pauses the test runner until the student writes a hypothesis and a planned fix; a cooldown follows. Success: students break out of wheel-spinning with a plan, and instructors see struggle while it is happening, not after grading.

## Positioning

Grading tools show only final results. EpistemicTrace measures the process (edit-to-run time, repeated error signatures, no-progress runs) and intervenes with reflection, not a hint or a penalty. A neighboring autograder or code-judge cannot truthfully claim a behavior-driven runner pause that requires metacognition before the next attempt.

## Operating Context

- Students open published activities, consent once on first session, code in Monaco, run in a Pyodide Web Worker with a time limit.
- Telemetry (`EDIT`, `RUN`, `ERROR`) is captured only on the activity page after consent, batched to the Spring Boot API. A declined consent still allows coding and running tests, with no session, SDI, or breaker.
- Evaluated as an academic final project (CSIT321, team Episteme Labs); the professor reviews progress.

## Capabilities and Constraints

- Stack: React 19, TypeScript, Vite, React Router, Monaco, Pyodide; Java 21, Spring Boot, PostgreSQL. No new libraries without a team decision recorded in `PROJECT.md`. No icon library, no bundled web fonts, CSS Modules with tokens in `frontend/src/styles/tokens.css`.
- Python only. No real-time collaboration, no server-side code execution, no grading by SDI, no courses or enrollment.
- The editor stays usable while the runner is locked. SDI weights, window, threshold, cooldown are configuration. If the server does not answer a run within 5 s, the browser fails open.
- Undecided: hosting, AI provider, term dates, final execution time limit and reflection minimum length (see `PROJECT.md` section 11).

## Brand Commitments

Binding (confirmed by the user):
- Name "EpistemicTrace"; the mascot logo (`frontend/src/components/Mascot.tsx`), purple/indigo dark theme and component patterns drawn from the four reference screens in `ui/main screens/`, as recorded in `docs/context/ui-context.md`. Dark only for the MVP.
- Tone: a pause, not a punishment. No struggle state is red.

## Evidence on Hand

- Reference screens: `ui/main screens/epistemictrace-login.png`, `epistemictrace-signup.png`, `epistemictrace-instructor-dashboard.png`, `epistemictrace-workspace.svg`.
- Specs 01-29 under `docs/context/feature-specs/`; `PROJECT.md` and `docs/context/project-overview.md` as source of truth.
- Absent: real student data, pilot results, testimonials, hosting details. Do not fabricate.

## Product Principles

1. **Process over product.** Design makes the how of problem solving visible and useful, never reduced to a final score.
2. **Pause, don't punish.** Interventions invite planning; wording and color never shame or alarm.
3. **Students never see the number.** Only levels (Steady / Take a moment / Time to pause and plan); never raw SDI, percentages, or progress toward the threshold.
4. **Keep the student working.** The editor is always usable; the runner lock must never trap or block the student from thinking.
5. **Privacy by consent and scope.** Telemetry only on the activity page after consent; students own their events.

## Accessibility & Inclusion

- WCAG AA contrast (4.5:1 body text, 3:1 large text); re-check when changing a color.
- Every input has a visible label; status is never shown by color alone; all actions keyboard-reachable; focus moves to the first reflection field when the breaker panel appears; `prefers-reduced-motion` turns off logo motion.
- Student-facing wording rules in `docs/context/ui-context.md` are mandatory (never "failed", "blocked", "penalty", "locked out").
