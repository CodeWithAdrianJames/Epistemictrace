# Development Workflow

## Approach

Build EpistemicTrace incrementally using a spec-driven workflow. Context files define what to build, how to build it, and what the current state of progress is. Always implement against these specs — do not infer or invent behavior from scratch.

Read in this order before starting any unit:

1. `PROJECT.md` (repository root) — product source of truth.
2. `docs/context/project-overview.md` — what the product does.
3. `docs/context/architecture-context.md` — boundaries, storage, models, API, invariants.
4. `docs/context/code-standards.md` — how code is written and tested.
5. `docs/context/ui-context.md` — visual and wording rules (frontend units).
6. `docs/context/progress-tracker.md` — what is done, what is next, which questions are open.
7. The one feature spec being implemented, from `docs/context/feature-specs/`.

If two files disagree, `PROJECT.md` wins, then `architecture-context.md`, then the feature spec. Report the conflict in `progress-tracker.md` → Open Questions instead of picking a side silently.

## Scoping Rules

- Work on one feature spec at a time, and on one **part** of it at a time when the spec has parts.
- Implement only what the spec's **In scope** and **Requirements** list. Anything under **Out of scope** is not built, even if it seems easy.
- Prefer small, verifiable increments over large speculative changes.
- Do not combine unrelated system boundaries in a single implementation step.
- Do not create files, endpoints, tables or components that the spec does not name, except tests and small private helpers.

## Gates

A feature spec lists **Gates**: open questions (`Qn`) that must be **Accepted** in `progress-tracker.md` before work starts.

- If a gate is still **Open** or **Proposed**, stop. Do not implement against the proposal "for now".
- If a gate was accepted with a different answer than the spec assumes, update the spec and `architecture-context.md` first, in their own commit, then implement.

## When To Split Work

Split an implementation step if it combines:

- Frontend UI changes and backend API changes
- Database schema changes and the UI that uses them
- The Pyodide worker / sandbox and telemetry capture
- SDI or breaker logic and the code that persists or displays it
- Multiple unrelated API endpoints
- Behavior that is not clearly defined in the context files

If a change cannot be verified end to end quickly, the scope is too broad — split it.

## Handling Missing Requirements

- Do not invent product behavior that is not defined in the context files.
- If a requirement is ambiguous, resolve it in the relevant context file before implementing.
- If a requirement is missing, add it as an open question in `progress-tracker.md` (next free `Qn`, with the Trello card that should decide it) before continuing.
- Never guess library APIs. Check the version installed in the repo and its official documentation. If unsure, write a small test that proves the API behaves as expected.

## Protected Foundation Components

Do not modify generated or third-party foundation files unless a spec explicitly says so.

This includes:

- The Maven wrapper: `backend/mvnw`, `backend/mvnw.cmd`, `backend/.mvn/`
- Lock files: `frontend/package-lock.json` changes only through `npm install` / `npm ci`, never by hand
- Migration files that have already been merged to `main`
- `.env.example` keys (add keys only when a spec says so, and update `PROJECT.md` §8 in the same PR)
- Third-party library internals, including Monaco and Pyodide assets

Project-specific behavior is implemented in app-level code (`frontend/src/...`, `com.episteme.epistemictrace...`) instead of patching foundation files.

## Keeping Docs In Sync

Update the relevant context file whenever implementation changes:

- System architecture or boundaries → `architecture-context.md`
- Storage model or schema → `architecture-context.md` and `PROJECT.md` §7
- API paths or payloads → `architecture-context.md` → API Surface
- Code conventions or standards → `code-standards.md`
- Feature scope → `project-overview.md` and `PROJECT.md` §3
- A decision is accepted → `progress-tracker.md` (move the question to Architecture Decisions) and `PROJECT.md` (§11 row deleted, answer moved into the right section)

Progress state must reflect the actual state of the implementation, not the intended state.

## Before Moving To The Next Unit

1. The current unit works end to end within its defined scope.
2. Every acceptance criterion in the spec is checked, and the evidence (test output or screenshots) is attached to the Trello card.
3. Backend: `./mvnw test` passes. Frontend: `npm run lint`, `npm run build` and `npm test` pass.
4. No invariant defined in `architecture-context.md` was violated.
5. `progress-tracker.md` reflects the completed work, including anything learned under Session Notes.
6. The PR was reviewed and approved by someone other than the author.
