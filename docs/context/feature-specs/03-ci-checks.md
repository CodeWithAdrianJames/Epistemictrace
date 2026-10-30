# 03 — CI Checks on Pull Requests

- **Card:** IMP-03 (https://trello.com/c/c2T6L20Y) · **Feature:** process (Done-definition support)
- **Owner:** Noel · **Reviewer:** Adrian
- **Depends on:** 01 (backend tests run without a database), 04 (frontend has a passing test)
- **Gates:** Q9 (GitHub Actions)

## Goal

Every pull request to `main` automatically runs the frontend lint, build and tests and the backend tests, and the result is shown on the PR.

## In Scope

- One workflow file: `.github/workflows/ci.yml`.

## Out of Scope

- Deployment, hosting, release builds (IMP-39).
- Branch protection settings in GitHub (CON-04 covers them; this spec only provides the check to require).
- Code coverage reporting.

## Requirements

- **R1** Triggers: `pull_request` targeting `main`, and `push` to `main`.
- **R2** Job `frontend` on `ubuntu-latest`, `working-directory: frontend`: set up Node 22 with npm cache (was Node 20; superseded by accepted Q19: `vitest@5.0.5` needs Node ≥ 22.12 and Node 20 is end-of-life) keyed on `frontend/package-lock.json`; run `npm ci`, `npm run lint`, `npm run build`, `npm test`.
- **R3** Job `backend` on `ubuntu-latest`, `working-directory: backend`: set up Temurin JDK 21 with Maven cache; run `./mvnw -B test`. Make `mvnw` executable in the step if needed (`chmod +x mvnw`), without changing the committed file.
- **R4** Jobs run in parallel. Neither job needs secrets, a database service or a `.env` file.
- **R5** Use only official `actions/*` actions (`actions/checkout`, `actions/setup-node`, `actions/setup-java`), pinned to a major version.
- **R6** `npm test` must run once and exit (Vitest `run` mode), not watch mode. If the `test` script starts watch mode, call `npx vitest run` in CI instead of changing the script.

## Parts

1. Add the workflow; open a test PR and confirm both jobs pass.
2. Open a second throwaway PR with a deliberate lint error; confirm the `frontend` job fails; close it.

## Acceptance Criteria

- [ ] A PR to `main` shows two checks, `frontend` and `backend`, both green on a clean branch.
- [ ] A lint error makes the `frontend` check fail.
- [ ] A failing JUnit test makes the `backend` check fail.
- [ ] The workflow uses no secrets.

## Tests

- The two throwaway PRs in Parts are the evidence; attach screenshots of the check results to the card.

## Docs to Update

- `PROJECT.md` §6 (CI row) and §8 (`.github/` no longer empty).
- `progress-tracker.md`: Completed entry; remove CI from Q9.
