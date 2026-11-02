# UI Context

> **Status:** draft for PLN-07 (Frontend design). The visual values below are a starting proposal so that specs can be implemented consistently. Change them through a PR that updates this file; the wording rules in **Student-Facing Wording** come from `PROJECT.md` and are not optional.

## Theme

Dark only for the MVP. The palette, radii and button treatment are taken from mimo.org's dark product design system (inspected 2026-11-03 from the public landing and login pages and their stylesheets; the signed-in dashboard redirects to the login page, so dashboard values come from the same design system's product tokens): an indigo-navy canvas, lighter indigo cards, white headings, lavender-grey secondary text, one purple accent for actions with a light top edge and a translucent elevation ring, a pale-yellow highlight for callouts and pill chips. No Mimo name, logo, illustration, copy or font is used. Students may already be frustrated when the runner locks; the interface should feel like a pause, not a punishment, so no struggle color is red.

All colors are CSS custom properties defined in `frontend/src/styles/tokens.css` and used through `var(--token)` in CSS Modules (`*.module.css`). Components must use these tokens — no hard-coded hex values in component styles. The one exception is `frontend/src/features/workspace/editorTheme.ts`: Monaco cannot read CSS variables, so its theme repeats token values in a single documented module. `global.css` sets `color-scheme: dark` so native controls and scrollbars match.

| Role                  | CSS Variable           | Value      |
| --------------------- | ---------------------- | ---------- |
| Page canvas, top bar  | `--bg-page`, `--nav-bg` | `#252746` |
| Card / panel surface  | `--bg-surface`         | `#333661`  |
| Clickable card hover  | `--bg-surface-hover`   | `#3f4273`  |
| Inset / code surface (Monaco, value blocks, read-only fields) | `--bg-subtle` | `#191b33` |
| Form field fill       | `--bg-input`           | `#3f4273`  |
| Ghost control hover   | `--bg-hover`           | `rgba(252, 252, 253, 0.09)` |
| Pressed overlay       | `--bg-pressed`         | `rgba(8, 10, 43, 0.16)` |
| Dialog backdrop       | `--bg-overlay`         | `rgba(15, 16, 36, 0.45)` |
| Card border / divider, top-bar border | `--border-default`, `--nav-border` | `#3f4273` |
| Strong border (hovered card, editor frame, dashed empty state) | `--border-strong` | `#4a4d85` |
| Outlined-button border | `--border-highlight`  | `#626596`  |
| Primary text          | `--text-primary`       | `#ffffff`  |
| Secondary / meta text | `--text-secondary`     | `#ced0e2`  |
| Muted text            | `--text-muted`         | `#b9bbd2`  |
| Placeholder           | `--text-placeholder`   | `rgba(255, 255, 255, 0.6)` |
| Text on accent fill   | `--text-on-accent`     | `#ffffff`  |
| Accent (actions)      | `--accent`             | `#7e4bde`  |
| Accent hover          | `--accent-hover`       | `#8d60e2`  |
| Accent soft           | `--accent-soft`        | `rgba(141, 96, 226, 0.2)` |
| Accent as text (links)| `--accent-text`        | `#b89ced`  |
| Text on accent soft   | `--accent-soft-text`   | `#cebbf3`  |
| Highlight callout     | `--highlight`          | `#f8e08e`  |
| Text on highlight     | `--highlight-text`     | `#252746`  |
| Danger (invalid field border) | `--danger`     | `#f05a6e`  |
| Focus ring            | `--focus-ring`         | `#b89ced`  |
| Pass                  | `--state-pass`         | `#a4e59b`  |
| Pass soft             | `--state-pass-soft`    | `rgba(164, 229, 155, 0.14)` |
| Fail (text)           | `--state-fail`         | `#f6a0ac`  |
| Fail soft             | `--state-fail-soft`    | `rgba(240, 90, 110, 0.14)` |
| Steady                | `--state-steady`       | `#22c55e`  |
| Steady soft           | `--state-steady-soft`  | `rgba(34, 197, 94, 0.14)` |
| Notice                | `--state-notice`       | `#f8e08e`  |
| Notice soft           | `--state-notice-soft`  | `rgba(248, 224, 142, 0.14)` |
| Pause (breaker)       | `--state-pause`        | `#cebbf3`  |
| Pause border          | `--state-pause-border` | `#8d60e2`  |
| Pause soft            | `--state-pause-soft`   | `rgba(141, 96, 226, 0.16)` |

Pass/fail tokens are for **test results only**; the struggle level and the locked runner use their own tokens (`--state-steady`, `--state-notice`, `--state-pause`). Both the Steady pill and a passed test are green by design decision (2026-11-02); they stay separate tokens with different values (`#22c55e` vs `#a4e59b`) so either can change alone. `--state-notice` shares its value with `--highlight` but stays a separate token for the same reason.

Contrast (WCAG AA, 4.5:1 for body text, 3:1 for large text) drives these choices:

- `#7e4bde` as text is 2.7:1 on the canvas and 2.2:1 on cards, so purple text uses `--accent-text` `#b89ced` (6.2:1 on the canvas, 4.9:1 on cards). `--accent` stays the button fill (white text on it: 5.3:1).
- On the `--accent-soft` fill (the Published chip, the saved message) `#b89ced` drops to about 4:1, so text there uses `--accent-soft-text` `#cebbf3` (5.4:1).
- `#f05a6e` as text is 4.4:1 on the canvas, so error text uses `--state-fail` `#f6a0ac`; `#f05a6e` is kept as `--danger` for invalid-field borders. `--state-fail-soft` keeps the `#f05a6e`-based 14% fill: `#f6a0ac` on it over a card is 5.0:1 (a `#f6a0ac`-based 20% fill would be 3.9:1).
- `--text-secondary` `#ced0e2` is 7.5:1 on cards; `--text-muted` `#b9bbd2` is 6.0:1 on cards.
- The "Trace" half of the wordmark is gradient text from `#cebbf3` to `#8d60e2`; its darkest stop is 3.4:1 on the canvas (large text).

Re-check contrast when changing a value.

### Navigation Bar

| Role              | CSS Variable   | Value     |
| ----------------- | -------------- | --------- |
| Bar background    | `--nav-bg`     | `#252746` |
| Bar bottom border | `--nav-border` | `#3f4273` |

The bar is sticky at the top, at least `--topbar-height` (64px) tall, on the canvas color with a 1px bottom border. It holds the animated logo (a link to `/`), ghost navigation links and a ghost **Log out** button: `--control-height` (32px) tall, `--radius-control` (10px), 14px weight-600 white text, `--bg-hover` on hover, `--bg-pressed` while pressed. The active link has the `--bg-surface` fill. The workspace height on desktop is computed from `--topbar-height`.

### Brand Logo

`frontend/src/components/BrandLogo.tsx`, used in the top bar (`md`) and above the heading on the Log in and Create an account pages (`lg`).

- Wordmark: "Epistemic" in `--text-primary` and "Trace" as gradient text from `--accent-soft-text` to `--accent-hover` (solid `--accent-text` where `background-clip: text` is unsupported), `--font-brand` at weight 800.
- Emblem: a rounded badge with an `--accent-hover` → `--accent` gradient and an inline SVG circuit trace whose end node is a `--highlight` spark. It is `aria-hidden`, so the accessible name of the logo is exactly "EpistemicTrace".
- Motion (pure CSS): the glyph floats 2px up and down every 3s; the emblem's glow pulses between `--glow-accent` and `--glow-accent-strong`; on hover the logo scales to 1.06 and the emblem tilts −8°, with a 0.25s `--ease-bounce` transition.
- `@media (prefers-reduced-motion: reduce)` turns off the float, the glow pulse and the hover transform.

### Auth Pages

Log in and Create an account have no card: a centred column up to 440px wide on the canvas, with 32px between the logo, the heading, the form and the switch link. The heading is `--text-4xl` (40px), weight 700, centred. Labels are `--text-xs` (12px) weight 600 above 48px (`--field-height`) fields. The submit button is the large primary button at full width; the 401 message and the switch link are centred under it.

## Typography

No web-font dependency. System stacks defined as tokens:

| Role      | CSS Variable   | Value |
| --------- | -------------- | ----- |
| UI text   | `--font-ui`    | `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` |
| Brand     | `--font-brand` | `ui-rounded, "SF Pro Rounded", "Arial Rounded MT Bold", Nunito, system-ui, sans-serif` |
| Code/mono | `--font-mono`  | `ui-monospace, "Cascadia Code", Consolas, "Liberation Mono", monospace` |

Base size 16px, line height 1.5. Problem statements, test input/output and error messages that show code use `--font-mono`. Monaco uses the `epistemictrace-dark` theme (`editorTheme.ts`, built on `vs-dark`): `--bg-subtle` background, `--bg-page` current-line highlight, `--border-highlight` line numbers, a 40% `--accent` selection and an `--accent-text` cursor, inside a `--bg-subtle` container with a `--border-default` frame.

The reference site's typefaces (Aeonik family) are licensed commercial fonts and are not used. Its medium (500) weight is rendered as 600 here because system fonts such as Segoe UI have no 500 face and would fall back to 400. Headings (`h1`–`h4`) are weight 600 with `--tracking-tight` (`-0.02em`) and line height 1.25.

| Token          | Value      | Use |
| -------------- | ---------- | --- |
| `--text-xs`    | 0.75rem    | Auth field labels and field errors |
| `--text-sm`    | 0.875rem   | Badges, metadata, form labels and errors in the app, nav links |
| `--text-base`  | 1rem       | Body text, small headings, buttons |
| `--text-lg`    | 1.125rem   | Panel and card headings, the large auth button |
| `--text-xl`    | 1.25rem    | Dialog titles, top-bar wordmark |
| `--text-2xl`   | 1.5rem     | Workspace title |
| `--text-3xl`   | 2rem       | Page headings |
| `--text-4xl`   | 2.5rem     | Auth page headings |

## Spacing, Radius and Elevation

| Token            | Value  | Use |
| ---------------- | ------ | --- |
| `--space-1`..`--space-7` | 4, 8, 12, 16, 24, 32, 56 px | Padding and gaps |
| `--control-height` | 32px | Top-bar links, Log out, the Edit link |
| `--button-height` | 40px | App buttons (min-height) |
| `--field-height` | 48px | Single-line fields (min-height), the auth submit button |
| `--radius-control` | 10px | 32px ghost and outlined controls |
| `--radius-sm`    | 12px   | Fields, 40px buttons, inline messages |
| `--radius-button` | 14px  | The 48px auth submit button |
| `--radius-md`    | 16px   | Panels and cards |
| `--radius-lg`    | 24px   | Dialogs and the breaker panel |
| `--radius-pill`  | 9999px | Status chips and the struggle badge |
| `--shadow`       | `0 4px 20px rgba(0, 0, 0, 0.25)` | Dialogs and the breaker panel |
| `--shadow-button` | 2px `rgba(252, 252, 253, 0.09)` ring, 1px inset white-30% top edge, 1px inset black-10% bottom edge | Primary buttons |
| `--shadow-button-active` | the same with a 4px ring | Primary buttons while pressed |
| `--glow-accent`, `--glow-accent-strong` | `0 0 12px rgba(126, 75, 222, 0.4)`, `0 0 20px rgba(126, 75, 222, 0.65)` | Logo emblem only |
| `--transition-fast` | `0.15s cubic-bezier(0.4, 0, 0.2, 1)` | Hover and focus color changes |
| `--ease-bounce`  | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Logo hover |

Buttons:

- **Primary** (submit, Run tests, New activity, Continue, consent accept): `--accent` fill, white weight-600 text, `--shadow-button`; hover `--accent-hover`; pressed `--shadow-button-active`; disabled 60% opacity with no shadow.
- **Secondary** (Delete, Archive, pager, consent decline): transparent with a 2px `--border-highlight` outline and white text; hover `--bg-hover`; pressed `--bg-pressed`.
- **Ghost** (top-bar links, Log out): no fill or border until hover (`--bg-hover`).

Form fields are `--bg-input` with a 1px border of the same color; on hover the border becomes `--accent`; on focus the border becomes a 2px `--accent` line (1px border plus a 1px ring); an invalid field has a `--danger` border. Read-only fields use `--bg-subtle` with a `--border-default` border. Buttons and links show a 2px `--focus-ring` outline. Callouts (the consent banner and the "not tracked" notice) are `--highlight` with `--highlight-text`. Clickable cards (student activity rows, history rows) switch to `--bg-surface-hover` with a `--border-strong` border on hover; they do not lift or glow.

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

- Appears above the results panel when the state is `LOCKED`. An elevated `--bg-surface` panel with a 2px `--state-pause-border` outline, `--shadow` and `--radius-lg`; the heading uses `--state-pause`, the reflection fields use `--bg-input` and **Continue** is the `--accent` primary button. It is **not** a modal and has no backdrop: the editor and problem statement stay visible and editable.
- Contains the heading, a short explanation, the two reflection fields and the submit button (spec 25).
- During cooldown, a small notice in the top bar: "Tests are running again. Keep going step by step."

### Struggle Level Badge (spec 28)

| Level | Text | Colors |
| --- | --- | --- |
| LOW | Steady | `--state-steady` on `--state-steady-soft` (green pill) |
| MEDIUM | Take a moment | `--state-notice` on `--state-notice-soft` (yellow pill) |
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

- App shell: top navigation bar (product name, role-specific links, user name, **Log out**) over the page content, max content width 1280px except the workspace, which uses the full width.
- Student links: Activities, History. Instructor links: My activities.
- Lists: a `Panel` per item with title and secondary text; an `EmptyState` when there are none.
- Forms: one column, labels above fields, errors under the field in `--state-fail`, submit button bottom-left (the auth pages use a full-width submit, see Auth Pages).
- Loading: inline text ("Loading activities…"), no spinners required.
- Errors from the API: a top-of-page `ErrorMessage` with the `ProblemDetail.detail` text.

## Accessibility

- Every input has a visible `<label>`.
- Disabled **Run tests** has `aria-disabled` and a visible reason next to it.
- Status is never shown by color alone: every status has a text label.
- Keyboard: all actions reachable with Tab; the breaker panel moves focus to its first field when it appears.

## Icons

No icon library in the MVP (adding one needs a Stack decision). Use text labels. A small inline SVG is acceptable when text alone is unclear.
