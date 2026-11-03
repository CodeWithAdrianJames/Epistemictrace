# UI Context

> **Status:** draft for PLN-07 (Frontend design). The visual values below are a starting proposal so that specs can be implemented consistently. Change them through a PR that updates this file; the wording rules in **Student-Facing Wording** come from `PROJECT.md` and are not optional.

## Theme

Dark only for the MVP. The visual design follows the four reference screens in `ui/main screens/` (2026-11-04): `epistemictrace-login.png`, `epistemictrace-signup.png`, `epistemictrace-instructor-dashboard.png` and `epistemictrace-workspace.svg`. Pages without a reference (student activity list, history, activity editor, consent dialog) reuse the same tokens and component patterns. The canvas is a deep indigo (`#1b1d3a`) with a purple glow at the top right and a purple → lavender → cyan line along the top edge; panels are a lighter indigo with a thin outline and a soft shadow; one purple accent fills primary actions as a top-lit gradient with a purple glow; status uses tinted icon tiles (purple, green, blue, orange). Students may already be frustrated when the runner locks; the interface should feel like a pause, not a punishment, so no struggle color is red.

All colors are CSS custom properties defined in `frontend/src/styles/tokens.css` and used through `var(--token)` in CSS Modules (`*.module.css`). Components must use these tokens — no hard-coded color values in component styles. The one exception is `frontend/src/features/workspace/editorTheme.ts`: Monaco cannot read CSS variables, so its theme repeats token values in a single documented module. `global.css` sets `color-scheme: dark` so native controls and scrollbars match.

`DESIGN.md` is the canonical design system and token source (colors, typography, spacing, radius, elevation, contrast rationale). This file only notes where and how those tokens are applied in the UI.

Pass/fail tokens are for **test results only**; the struggle level and the locked runner use their own tokens (`--state-steady`, `--state-notice`, `--state-pause`). The Steady pill follows the workspace reference's cyan "Pace · Steady" pill (2026-11-04), replacing the green chosen on 2026-11-02, so it no longer shares a hue with a passed test. The Published status chip uses the green tile tokens, not `--state-pass`.

### Navigation

`frontend/src/app/TopBar.tsx` renders one `<header>` (the page banner) in two shapes, chosen by `AppLayout`:

- **Sidebar** (signed-in pages except the workspace), after the dashboard reference: 300px (`--sidebar-width`) on `--nav-bg` with a `--border-subtle` right border, full height and sticky. Logo on top with the role ("Instructor" / "Student") in `--accent-text` under it; 56px links with a line icon, the active link on `--bg-nav-active` with a `--border-reflect` outline and a 4px `--accent` rail at the left edge; the account card at the bottom (mascot avatar, user name, "{Role} mode", outlined **Log out**) on `--bg-reflect`. Below 900px it becomes a bar across the top.
- **Bar** (guests and the workspace): at least `--topbar-height` (64px), sticky, logo left, ghost links (32px, `--radius-control`), then the user name, an avatar and **Log out** at the right end. Guests see only the logo, on the `--bg-auth` canvas with no bottom border.

Signed-in pages draw `--line-progress` as a 3px line across the top edge of the window and `--glow-page` over `--bg-page`.

### Brand Logo

`frontend/src/components/BrandLogo.tsx`, used in the navigation (`md`) and above the Log in heading (`lg`).

- Emblem: the EpistemicTrace mascot (`frontend/src/components/Mascot.tsx`, drawn from the reference logo with the `--mascot-*` tokens). It is `aria-hidden`, so the accessible name of the logo is exactly "EpistemicTrace".
- Wordmark: "EpistemicTrace" in `--text-primary`, weight 800, `--font-ui`.
- Motion (pure CSS): the mascot floats 2px every 3s and its purple drop-shadow glow pulses; on hover the logo scales to 1.04 and the mascot tilts −8°. `prefers-reduced-motion: reduce` turns all of it off.

The mascot is also used, always decoratively, at the bottom-right corner of the Log in page, in the sign-up illustration, the sidebar account card, the breaker panel and each history reflection.

### Auth Pages

- **Log in** (`epistemictrace-login.png`): no card; a centred column up to 590px with the large logo, the heading in `--font-display` at `--text-5xl`, 14px labels above 64px `--bg-input` fields (placeholders "Your e-mail", "Your password"), a full-width 64px `--accent-fill` button, and the switch link in `--font-display`, underlined. The mascot peeks in from the bottom-right corner at 1100px and wider.
- **Create an account** (`epistemictrace-signup.png`): a two-column hero at 1024px and wider. Left: the tagline "Learn Python" (lavender, with a blinking caret) / "one struggle at a time" (`--font-display`), a lede, then the form under the `h1` "Create an account" (52px `--bg-surface-hover` fields with a `--border-strong` outline, full-width 52px submit). Right: the decorative `HeroIllustration` (mascot over a board of solved steps, a code screen, Python and badge tokens). Below both: "Code. Reflect. Grow." and three facts (Python 3, Real problems, Struggle tracking).
- Password fields have an eye toggle (`aria-label` "Show password" / "Hide password", `aria-pressed`) that only switches the input between `password` and `text`.
- The reference's Google/Apple/Facebook buttons, "Reset your password" link and marketing navigation are **not** built: those features do not exist.

## Typography

No web-font files are bundled (adding them needs a Stack decision). The stacks name the reference fonts first, so they render when installed locally, then fall back to system fonts. See `DESIGN.md` for the font stack and type scale tokens.

Base size 16px, line height 1.5. Headings (`h1`–`h4`) are weight 700 with `--tracking-tight` (`-0.02em`). Page headings use the `PageHeader` component: `--text-title` gradient text (solid `--accent-soft-text` without `background-clip: text`), `clamp(2rem, 3.4vw, 3rem)`, with an optional `--text-secondary` subtitle and actions on the right. Test input/output, sample blocks and runtime errors use `--font-mono`; the problem statement uses `--font-ui` with its line breaks kept (`pre-wrap`). Monaco uses the `epistemictrace-dark` theme (`editorTheme.ts`) and the `--font-mono` stack.

## Spacing, Radius and Elevation

See `DESIGN.md` for the spacing, radius, shadow and motion tokens.

Buttons:

- **Primary** (submit, Run tests, New activity, Continue, consent accept): `--accent-fill`, white weight-600/700 text, `--shadow-button`; hover `--accent-fill-hover`; pressed `--shadow-button-active`; disabled 60% opacity with no shadow.
- **Secondary** (Delete, Archive, consent decline, Back links, Edit): transparent or `--bg-surface-raised` with a 1px `--border-strong` / `--border-default` outline; hover `--bg-hover`; pressed `--bg-pressed`.
- **Ghost** (bar links): no fill or border until hover (`--bg-hover`).

Form fields: Log in uses `--bg-input` fields whose border matches the fill; app and sign-up fields use `--bg-surface-hover` with a `--border-strong` border. On hover the border becomes `--accent`; on focus a 2px `--accent` line (1px border plus a 1px ring); an invalid field has a `--danger` border. Code textareas and read-only fields use `--bg-subtle`. Buttons and links show a 2px `--focus-ring` outline. Callouts (the consent banner and the "not tracked" notice) are `--highlight` with `--highlight-text`. Lists sit in one panel with a title strip; clickable rows switch to `--bg-surface-raised` with a `--border-default` outline on hover and nudge their arrow; they do not lift.

## Coding Workspace

### Layout

After `epistemictrace-workspace.svg`. The app navigation is the slim bar; under it a header row holds **Back to Activities**, the activity title (`h1`), the struggle-level badge and (during cooldown) the cooldown notice.

- 1280px and wider: three cards side by side (about 470 : 920 : 468) — problem, editor, test results (CW-03).
- 1024–1279px: problem left (35%), editor top-right (60%), results bottom-right (40%).
- Narrower screens: the regions stack (problem, editor, results). Tablet and mobile polish is out of MVP scope.
- Problem card: a `--bg-surface-hover` header strip with **Problem** and a Python chip, the statement, then the examples as sample blocks.
- Editor card: a tab strip (`script.py` with an `--accent` underline, a "Python 3" chip), Monaco, then a `--bg-console` bar with the full-width 56px **Run tests** button (play icon when ready, lock icon when paused, a spinner while busy).
- Results card: **Test results** in `--accent-soft-text`, the summary in `--state-pass`, a pass bar (passed / total, `aria-hidden`; never anything about the struggle score), then one `--bg-surface-raised` card per test with a status icon, the name and the status chip.
- The reference's Hints/Notes tabs, timer, item pager, Check code button, console, keyboard-shortcut footer, "paused 42s here" marker and score footer are **not** built: those features do not exist.

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

- Appears above the results panel when the state is `LOCKED`. The reference's "Pause & reflect" card: `--bg-reflect` with a 1px `--state-pause-border` outline, `--shadow` and `--radius-button`, the mascot beside the heading; the heading uses `--state-pause`, the reflection fields use `--bg-subtle` with a `--border-reflect` outline and **Continue** is the full-width primary button. It is **not** a modal and has no backdrop: the editor and problem statement stay visible and editable.
- Contains the heading, a short explanation, the two reflection fields and the submit button (spec 25).
- During cooldown, a small notice in the top bar: "Tests are running again. Keep going step by step."

### Struggle Level Badge (spec 28)

| Level | Text | Colors |
| --- | --- | --- |
| LOW | Steady | `--state-steady` on `--state-steady-soft` (cyan pill) |
| MEDIUM | Take a moment | `--state-notice` on `--state-notice-soft` (yellow pill) |
| HIGH | Time to pause and plan | `--state-pause` on `--state-pause-soft`, `--state-pause-border` outline (purple pill) |

The badge is a 32px pill with a small dot in the level color and a `--border-default` outline (HIGH keeps the `--state-pause-border` outline). Never show a number, a percentage, a progress bar toward the threshold, or the word "SDI" to students.

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

None. Shared components live in `frontend/src/components/` and are built on plain HTML elements with CSS Modules: `Button`, `TextField`, `TextArea`, `Panel`, `Badge`, `PageHeader`, `EmptyState`, `ErrorMessage`. Build a shared component only when a second feature needs it. Built so far: `BrandLogo`, `Mascot`, `Icon`, `PythonMark` and `PageHeader`.

## Layout Patterns

- App shell: see **Navigation**. Signed-in pages put the content beside the sidebar (up to 1640px); guest pages are up to 1680px; the workspace uses the full width under the bar.
- Instructor **My activities** is the dashboard: page header with **New activity**, four stat cards counted from the loaded list (Total activities, Published, Drafts, Archived) with tinted icon tiles, then the **Your activities** panel (Python tile, title, status chip · updated date, test case count, **Edit**).
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

No icon library in the MVP (adding one needs a Stack decision). `frontend/src/components/Icon.tsx` holds a small set of inline line icons (24px grid, `currentColor`, `aria-hidden`), and `PythonMark.tsx` the Python mark. Icons always sit next to a text label; they never carry meaning on their own.
