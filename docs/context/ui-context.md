# UI Context

> **Status:** draft for PLN-07 (Frontend design). The visual values below are a starting proposal so that specs can be implemented consistently. Change them through a PR that updates this file; the wording rules in **Student-Facing Wording** come from `PROJECT.md` and are not optional.

## Theme

Dark only for the MVP, modelled on mimo.org's deep navy / indigo product theme: a midnight-navy canvas, indigo cards, white headings, periwinkle secondary text, one purple accent for actions, a golden highlight for callouts, rounded components and gamified pill badges. Students may already be frustrated when the runner locks; the interface should feel like a pause, not a punishment, so no struggle color is red.

All colors are CSS custom properties defined in `frontend/src/styles/tokens.css` and used through `var(--token)` in CSS Modules (`*.module.css`). Components must use these tokens — no hard-coded hex values in component styles. `global.css` sets `color-scheme: dark` so native controls and scrollbars match.

| Role                  | CSS Variable           | Value      |
| --------------------- | ---------------------- | ---------- |
| Page canvas           | `--bg-page`            | `#151833`  |
| Card / panel surface  | `--bg-surface`         | `#23274d`  |
| Secondary surface (top bar, inset blocks) | `--bg-subtle` | `#1c1f3f` |
| Form field fill       | `--bg-input`           | `#2a2e59`  |
| Dialog backdrop       | `--bg-overlay`         | `rgba(10, 12, 26, 0.75)` |
| Card border / divider | `--border-default`     | `rgba(255, 255, 255, 0.08)` |
| Field / outlined-button border | `--border-strong` | `#3d437a` |
| Primary text          | `--text-primary`       | `#ffffff`  |
| Secondary / meta text | `--text-secondary`, `--text-muted` | `#8f94c2` |
| Placeholder           | `--text-placeholder`   | `#6c729c`  |
| Text on accent fill   | `--text-on-accent`     | `#ffffff`  |
| Accent (actions)      | `--accent`             | `#7952f5`  |
| Accent hover          | `--accent-hover`       | `#683fe0`  |
| Accent soft           | `--accent-soft`        | `rgba(121, 82, 245, 0.2)` |
| Accent as text        | `--accent-text`        | `#b89ced`  |
| Highlight callout     | `--highlight`          | `#ffc72c`  |
| Text on highlight     | `--highlight-text`     | `#151833`  |
| Danger (invalid field border) | `--danger`     | `#f05a6e`  |
| Focus ring            | `--focus-ring`         | `#b89ced`  |
| Pass                  | `--state-pass`         | `#a4e59b`  |
| Pass soft             | `--state-pass-soft`    | `rgba(164, 229, 155, 0.14)` |
| Fail (text)           | `--state-fail`         | `#f6a0ac`  |
| Fail soft             | `--state-fail-soft`    | `rgba(240, 90, 110, 0.14)` |
| Steady                | `--state-steady`       | `#22c55e`  |
| Steady soft           | `--state-steady-soft`  | `rgba(34, 197, 94, 0.14)` |
| Notice                | `--state-notice`       | `#facc15`  |
| Notice soft           | `--state-notice-soft`  | `rgba(250, 204, 21, 0.14)` |
| Pause (breaker)       | `--state-pause`        | `#c084fc`  |
| Pause border          | `--state-pause-border` | `#a855f7`  |
| Pause soft            | `--state-pause-soft`   | `rgba(168, 85, 247, 0.16)` |

Pass/fail tokens are for **test results only**; the struggle level and the locked runner use their own tokens (`--state-steady`, `--state-notice`, `--state-pause`). Both the Steady pill and a passed test are green by design decision (2026-11-02); they stay separate tokens with different values (`#22c55e` vs `#a4e59b`) so either can change alone.

Contrast (WCAG AA, 4.5:1 for body text) drives four values that differ from the raw reference palette:

- `#7952f5` as text on `--bg-surface` is 2.95:1, so purple text (links, "Published", the saved message) uses `--accent-text` (6.1:1). `--accent` stays the button fill (white text on it: 4.8:1).
- `#f05a6e` as text on the fail-soft fill is 3.7:1, so error text uses `--state-fail` `#f6a0ac` (mimo's dark-mode error tone, 6.1:1); `#f05a6e` is kept as `--danger` for invalid-field borders.
- `#a855f7` as pill text is 3.0–3.6:1, so the HIGH pill text uses `--state-pause` `#c084fc` (5.4:1) and `#a855f7` becomes its outline.
- `#6c729c` is 3.1:1 on cards, so it is used only for placeholders; meta text uses `#8f94c2` (4.9:1 on cards, 5.9:1 on the canvas).

Re-check contrast when changing a value.

### Navigation Bar

| Role              | CSS Variable   | Value     |
| ----------------- | -------------- | --------- |
| Bar background    | `--nav-bg`     | `#1c1f3f` |
| Bar bottom border | `--nav-border` | `#2e3363` |

The bar holds the animated logo (a link to `/`), pill navigation links (`--radius-pill`; hover `--bg-surface`, active `--accent-soft` with white text) and an outlined **Log out** button (`--border-strong`). It is at least `--topbar-height` (64px) tall; the workspace height on desktop is computed from it.

### Brand Logo

`frontend/src/components/BrandLogo.tsx`, used in the top bar (`md`) and above the heading on the Log in and Create an account cards (`lg`).

- Wordmark: "Epistemic" in `--text-primary` and "Trace" in `--accent`, `--font-brand` at weight 800. Both sizes count as large text, so 3:1 applies; "Trace" on the top bar is 3.3:1.
- Emblem: a rounded badge with an `--accent` → `--state-pause-border` gradient and an inline SVG circuit trace whose end node is a `--highlight` spark. It is `aria-hidden`, so the accessible name of the logo is exactly "EpistemicTrace".
- Motion (pure CSS): the glyph floats 2px up and down every 3s; the emblem's glow pulses between `--glow-accent` and `--glow-accent-strong`; on hover the logo scales to 1.06 and the emblem tilts −8°, with a 0.25s `--ease-bounce` transition.
- `@media (prefers-reduced-motion: reduce)` turns off the float, the glow pulse and the hover transform.

## Typography

No web-font dependency. System stacks defined as tokens:

| Role      | CSS Variable   | Value |
| --------- | -------------- | ----- |
| UI text   | `--font-ui`    | `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` |
| Brand     | `--font-brand` | `ui-rounded, "SF Pro Rounded", "Arial Rounded MT Bold", Nunito, system-ui, sans-serif` |
| Code/mono | `--font-mono`  | `ui-monospace, "Cascadia Code", Consolas, "Liberation Mono", monospace` |

Base size 16px, line height 1.5. Problem statements, test input/output and error messages that show code use `--font-mono`. Monaco uses its own font settings with the dark `vs-dark` theme inside a `--bg-surface` container with a `--border-strong` frame.

The reference site's typeface (Aeonik) is a licensed commercial font and is not used; `--font-brand` uses a rounded system face where the platform has one. Headings (`h1`–`h4`) are weight 600 with `--tracking-tight` (`-0.02em`) and line height 1.25.

| Token          | Value      | Use |
| -------------- | ---------- | --- |
| `--text-sm`    | 0.875rem   | Badges, metadata, field errors, nav links |
| `--text-base`  | 1rem       | Body text, small headings |
| `--text-lg`    | 1.125rem   | Panel and card headings |
| `--text-xl`    | 1.25rem    | Dialog titles, top-bar wordmark |
| `--text-2xl`   | 1.5rem     | Workspace title, auth card heading |
| `--text-3xl`   | 2rem       | Page headings |

## Spacing, Radius and Elevation

| Token            | Value  | Use |
| ---------------- | ------ | --- |
| `--space-1`..`--space-6` | 4, 8, 12, 16, 24, 32 px | Padding and gaps |
| `--radius-sm`    | 12px   | Inputs, buttons, inline messages |
| `--radius-md`    | 16px   | Panels and cards |
| `--radius-lg`    | 24px   | Dialogs, the auth card and the breaker panel |
| `--radius-pill`  | 9999px | Status chips, nav links and the struggle badge |
| `--shadow`       | `0 4px 20px rgba(0, 0, 0, 0.25)` | Auth card, dialogs, breaker panel, clickable cards on hover |
| `--glow-accent`, `--glow-accent-strong` | `0 0 12px rgba(121, 82, 245, 0.4)`, `0 0 20px rgba(121, 82, 245, 0.65)` | Logo emblem; focused fields |
| `--transition-fast` | `0.15s cubic-bezier(0.4, 0, 0.2, 1)` | Hover and focus color changes |
| `--ease-bounce`  | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Logo hover |

Form fields are `--bg-input` with a 1px `--border-strong` border; on focus the border becomes a 2px `--accent` line (1px border plus a 1px ring) with `--glow-accent`. Buttons and links show a 2px `--focus-ring` outline. Callouts (the consent banner and the "not tracked" notice) are `--highlight` with `--highlight-text`. Clickable cards (student activity rows, history rows) show an `--accent` border and `--shadow` on hover.

## Coding Workspace

### Layout

- Desktop (≥ 1024px wide): three regions visible together (CW-03).
  - Left column (about 35%): problem statement, scrollable.
  - Right column (about 65%), split vertically: editor on top (about 60%), results panel below (about 40%).
- Narrower screens: the regions stack (problem, editor, results). Tablet and mobile polish is out of MVP scope.
- A top bar above the regions shows the activity title, the **Run tests** button and (after spec 28) the struggle-level badge.

### Run Tests Button

| State | Label | Enabled |
| --- | --- | --- |
| Ready | Run tests | Yes |
| Interpreter loading | Preparing Python… | No |
| Running | Running… | No |
| Waiting for the server after a run (≤ 5 s) | Running… | No |
| Locked by the breaker | Paused — see below | No |
| Cooldown | Run tests | Yes |

### Results Panel

- Summary line: `3 of 5 tests passed`.
- One row per test case, in `position` order:
  - Visible test: name `Test 1`, status, and on failure the input, expected output and actual output in mono blocks.
  - Hidden test: name `Hidden test 3` and status only (Q8).
- Statuses: `Passed`, `Failed`, `Error`, `Timed out`, `Not run`.
- A runtime error shows the exception type, line and message in a `--state-fail-soft` block. A timeout says: "Your code ran longer than {N} seconds and was stopped. Check for a loop that never ends." where `{N}` comes from `RUN_TIMEOUT_MS` (spec 12).
- Before the first run: "Run your code to see test results here."

### Breaker Panel (Locked Runner)

- Appears above the results panel when the state is `LOCKED`. An elevated `--bg-surface` panel with a `--state-pause-border` outline, `--shadow` and `--radius-lg`; the heading uses `--state-pause`, the reflection fields use `--bg-input` and **Continue** is the `--accent` primary button. It is **not** a modal and has no backdrop: the editor and problem statement stay visible and editable.
- Contains the heading, a short explanation, the two reflection fields and the submit button (spec 25).
- During cooldown, a small notice in the top bar: "Tests are running again. Keep going step by step."

### Struggle Level Badge (spec 28)

| Level | Text | Colors |
| --- | --- | --- |
| LOW | Steady | `--state-steady` on `--state-steady-soft` (green pill) |
| MEDIUM | Take a moment | `--state-notice` on `--state-notice-soft` (amber pill) |
| HIGH | Time to pause and plan | `--state-pause` on `--state-pause-soft`, `--state-pause-border` outline (purple pill) |

Never show a number, a percentage, a progress bar toward the threshold, or the word "SDI" to students.

## Student-Facing Wording

| Do say | Don't say |
| --- | --- |
| "Let's pause and plan your next step." | "You failed", "Too many attempts", "Penalty" |
| "Write what you think is wrong and what you'll try next." | "Explain your mistake" |
| "Tests are paused." | "You are blocked", "Locked out" |
| "Steady / Take a moment / Time to pause and plan" | Any SDI number or score |
| "Hidden test" | "Secret test" |

Locked panel copy:

- Heading: **Let's pause and plan**
- Body: "You've run the tests several times in a short while. Before the next run, write down what you think is going wrong and what you'll change. You can keep editing your code while you write."
- Field labels: **What do you think is wrong?** (hypothesis) and **What will you try next?** (planned fix)
- Button: **Continue**

## Component Library

None. Shared components live in `frontend/src/components/` and are built on plain HTML elements with CSS Modules: `Button`, `TextField`, `TextArea`, `Panel`, `Badge`, `PageHeader`, `EmptyState`, `ErrorMessage`. Build a shared component only when a second feature needs it. `BrandLogo` (used by the app top bar and the auth pages) is the first one built.

## Layout Patterns

- App shell: top navigation bar (product name, role-specific links, user name, **Log out**) over the page content, max content width 1200px except the workspace, which uses the full width.
- Student links: Activities, History. Instructor links: My activities.
- Lists: a `Panel` per item with title and secondary text; an `EmptyState` when there are none.
- Forms: one column, labels above fields, errors under the field in `--state-fail`, submit button bottom-left.
- Loading: inline text ("Loading activities…"), no spinners required.
- Errors from the API: a top-of-page `ErrorMessage` with the `ProblemDetail.detail` text.

## Accessibility

- Every input has a visible `<label>`.
- Disabled **Run tests** has `aria-disabled` and a visible reason next to it.
- Status is never shown by color alone: every status has a text label.
- Keyboard: all actions reachable with Tab; the breaker panel moves focus to its first field when it appears.

## Icons

No icon library in the MVP (adding one needs a Stack decision). Use text labels. A small inline SVG is acceptable when text alone is unclear.
