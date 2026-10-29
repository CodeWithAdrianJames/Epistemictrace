# 04 — Frontend App Shell

- **Card:** IMP-04 (https://trello.com/c/uvDWHclM) · **Feature:** PLT foundation
- **Owner:** Jacob · **Reviewer:** Noel
- **Depends on:** — (repository scaffold)
- **Gates:** Q11 (React Router, CSS Modules, no state library), Q12 (Testing Library + jsdom)

## Goal

The Vite starter page is replaced by the app's route skeleton, design tokens, an API client and the first passing tests.

## In Scope

- Router with placeholder pages for every MVP route.
- App layout with a top navigation bar (static links for now).
- `styles/tokens.css` and `styles/global.css` from `ui-context.md`.
- `api/apiFetch.ts` and `api/ApiError.ts`.
- Vitest configured for `jsdom` and Testing Library; first tests.

## Out of Scope

- Auth state, login pages and route guards (spec 07).
- Real page content (later specs).
- Monaco and Pyodide (specs 11, 12).

## Requirements

- **R1** Add `react-router` as a dependency; add `@testing-library/react`, `@testing-library/jest-dom` and `jsdom` as dev dependencies. Nothing else.
- **R2** Delete the starter content (`App.css`, demo assets, counter) that is not used.
- **R3** `src/app/router.tsx` defines these routes, each rendering a placeholder component that shows the page title in an `<h1>`:

| Path | Page | Future spec |
|---|---|---|
| `/` | redirect to `/login` | 07 replaces with role redirect |
| `/login` | Log in | 07 |
| `/register` | Create an account | 07 |
| `/student/activities` | Activities | 10 |
| `/student/activities/:activityId` | Activity workspace | 14 |
| `/student/history` | My history | 27 |
| `/student/history/:sessionId` | Session details | 27 |
| `/instructor/activities` | My activities | 09 |
| `/instructor/activities/new` | New activity | 09 |
| `/instructor/activities/:activityId` | Edit activity | 09 |
| `*` | Page not found | — |

- **R4** `src/app/AppLayout.tsx`: top bar with the product name "EpistemicTrace" and an `<Outlet />`. The workspace route uses full width; other routes use a max width of 1200px (`ui-context.md` → Layout Patterns).
- **R5** `src/styles/tokens.css` declares every token in `ui-context.md` (colors, fonts, spacing, radius) on `:root`. `global.css` sets `body` background, color and font from tokens. Both are imported once in `main.tsx`.
- **R6** `src/api/apiFetch.ts`:
  - `apiFetch<T>(path: string, options?: { method?, body?, token?, signal?, keepalive? }): Promise<T>`.
  - Base URL from `import.meta.env.VITE_API_URL`; `path` must start with `/api/`.
  - Sends and accepts JSON; sets `Authorization: Bearer <token>` when `token` is given.
  - `204` resolves to `undefined`.
  - Non-2xx responses throw `ApiError { status: number; title: string; detail: string; fieldErrors: Record<string, string> }`, parsed from a `ProblemDetail` body when present, with safe fallbacks when the body is empty or not JSON.
  - Network failures throw `ApiError` with `status: 0` and detail "Can't reach the server. Check your connection."
- **R7** `vite.config.ts` (or `vitest.config.ts`) sets the test environment to `jsdom` and a setup file that imports `@testing-library/jest-dom/vitest`. `npm test` runs once in CI mode (`vitest run`) or the CI uses `npx vitest run` (spec 03).
- **R8** TypeScript formatting per `code-standards.md` (2 spaces, single quotes, no semicolons); `npm run lint` and `npm run build` pass.

## Parts

1. Dependencies, test setup, tokens/global CSS, delete starter content.
2. Router, layout and placeholder pages.
3. `apiFetch` and `ApiError` with tests.

## Acceptance Criteria

- [ ] `npm run dev` shows the login placeholder at `/` (after redirect) with the top bar.
- [ ] Every route in R3 renders its placeholder title; an unknown path shows "Page not found".
- [ ] `npm test` passes with at least the tests listed below.
- [ ] `npm run lint` and `npm run build` pass.
- [ ] No hex colors appear in component CSS; all come from `tokens.css`.

## Tests

- `router.test.tsx`: renders the router in a `MemoryRouter`-style setup for `/student/activities`, `/instructor/activities` and `/nope`, and checks the headings.
- `apiFetch.test.ts` (mock `globalThis.fetch`): success JSON; `204`; `ProblemDetail` with `errors` → `ApiError.fieldErrors`; non-JSON error body; network failure → status `0`; Authorization header present only when a token is passed.

## Docs to Update

- `PROJECT.md` §6: React Router and test libraries recorded; §8: `npm test` no longer fails.
- `progress-tracker.md`: Completed entry; remove the "npm test fails" note.
