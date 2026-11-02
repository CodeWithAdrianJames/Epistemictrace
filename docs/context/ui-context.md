# UI Context

> **Status:** draft for PLN-07 (Frontend design). The visual values below are a starting proposal so that specs can be implemented consistently. Change them through a PR that updates this file; the wording rules in **Student-Facing Wording** come from `PROJECT.md` and are not optional.

## Theme

Light only for the MVP. The visual language is a calm study tool modelled on the light product theme of mimo.org: cool off-white and white surfaces, navy ink, one purple accent for actions, a navy navigation bar, rounded cards and pill-shaped status chips, and no alarming colors for struggle. Students may already be frustrated when the runner locks; the interface should feel like a pause, not a punishment.

All colors are CSS custom properties defined in `frontend/src/styles/tokens.css` and used through `var(--token)` in CSS Modules (`*.module.css`). Components must use these tokens — no hard-coded hex values in component styles.

| Role               | CSS Variable          | Value      |
| ------------------ | --------------------- | ---------- |
| Page background    | `--bg-page`           | `#f6f7fb`  |
| Surface (panels)   | `--bg-surface`        | `#ffffff`  |
| Subtle surface     | `--bg-subtle`         | `#edeef6`  |
| Dialog backdrop    | `--bg-overlay`        | `rgba(25, 27, 51, 0.6)` |
| Default border     | `--border-default`    | `#e4e6f1`  |
| Strong border      | `--border-strong`     | `#b9bbd2`  |
| Primary text       | `--text-primary`      | `#252746`  |
| Secondary text     | `--text-secondary`    | `#4a4d85`  |
| Muted text         | `--text-muted`        | `#626596`  |
| Accent (actions)   | `--accent`            | `#7e4bde`  |
| Accent hover       | `--accent-hover`      | `#6a3bc6`  |
| Accent soft        | `--accent-soft`       | `#f3eefd`  |
| Pass               | `--state-pass`        | `#1e7a3c`  |
| Pass soft          | `--state-pass-soft`   | `#e8f7e5`  |
| Fail               | `--state-fail`        | `#b52f45`  |
| Fail soft          | `--state-fail-soft`   | `#fdecee`  |
| Notice             | `--state-notice`      | `#8a5a00`  |
| Notice soft        | `--state-notice-soft` | `#fdf5d7`  |
| Pause (breaker)    | `--state-pause`       | `#1d5fa8`  |
| Pause soft         | `--state-pause-soft`  | `#eaf5ff`  |

Pass/fail colors are for **test results only**. They are never used for the struggle level or the locked runner. The pause color is a calm blue so that the locked runner and the HIGH struggle badge never read as the purple accent (an action or the active link).

Every text/background pair above meets WCAG AA (4.5:1) for body text: for example `--accent` under white button text is 5.3:1, `--accent` on `--accent-soft` is 4.7:1 and `--text-muted` on `--bg-subtle` is 4.7:1. Re-check contrast when changing a value.

### Navigation Bar

The app top bar is a dark surface above the light page.

| Role               | CSS Variable        | Value     |
| ------------------ | ------------------- | --------- |
| Bar background     | `--nav-bg`          | `#252746` |
| Link hover         | `--nav-hover`       | `#333661` |
| Active link        | `--nav-active`      | `#3f4273` |
| Outlined button    | `--nav-border`      | `#4a4d85` |
| Text               | `--nav-text`        | `#ffffff` |
| Secondary text     | `--nav-text-muted`  | `#d3d4da` |
| Focus ring         | `--nav-focus`       | `#b89ced` |

The bar is at least `--topbar-height` (64px) tall; the workspace height on desktop is computed from it.

## Typography

No web-font dependency. System stacks defined as tokens:

| Role      | CSS Variable  | Value |
| --------- | ------------- | ----- |
| UI text   | `--font-ui`   | `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` |
| Code/mono | `--font-mono` | `ui-monospace, "Cascadia Code", Consolas, "Liberation Mono", monospace` |

Base size 16px, line height 1.5. Problem statements, test input/output and error messages that show code use `--font-mono`. Monaco uses its own font settings with the light `vs` theme on a white `--bg-surface` container.

The reference site's typeface (Aeonik) is a licensed commercial font and is not used; the system stack stands in for it. Headings (`h1`–`h4`) are weight 600 with `--tracking-tight` (`-0.02em`) and line height 1.25.

| Token          | Value      | Use |
| -------------- | ---------- | --- |
| `--text-sm`    | 0.875rem   | Badges, metadata, field errors, nav links |
| `--text-base`  | 1rem       | Body text, small headings |
| `--text-lg`    | 1.125rem   | Panel and card headings |
| `--text-xl`    | 1.25rem    | Dialog titles, product name |
| `--text-2xl`   | 1.5rem     | Workspace title, auth card heading |
| `--text-3xl`   | 2rem       | Page headings |

## Spacing, Radius and Elevation

| Token            | Value  | Use |
| ---------------- | ------ | --- |
| `--space-1`..`--space-6` | 4, 8, 12, 16, 24, 32 px | Padding and gaps |
| `--radius-sm`    | 10px   | Inputs, buttons, inline messages |
| `--radius-md`    | 16px   | Panels and cards |
| `--radius-lg`    | 24px   | Dialogs, the auth card and the breaker panel |
| `--radius-pill`  | 9999px | Status chips and the struggle badge |
| `--shadow-sm`    | `0 1px 4px rgba(47, 49, 82, 0.2)` | Auth card; clickable cards on hover |
| `--shadow-lg`    | `0 4px 48px rgba(0, 0, 0, 0.16)`  | Dialogs |
| `--transition-fast` | `0.15s cubic-bezier(0.4, 0, 0.2, 1)` | Hover and focus color changes |

Clickable cards (student activity rows, history rows) show an `--accent` border and `--shadow-sm` on hover.

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

- Appears above the results panel when the state is `LOCKED`. Uses `--state-pause` / `--state-pause-soft` and `--radius-lg`. It is **not** a modal: the editor and problem statement stay visible and editable.
- Contains the heading, a short explanation, the two reflection fields and the submit button (spec 25).
- During cooldown, a small notice in the top bar: "Tests are running again. Keep going step by step."

### Struggle Level Badge (spec 28)

| Level | Text | Colors |
| --- | --- | --- |
| LOW | Steady | `--text-secondary` on `--bg-subtle` |
| MEDIUM | Take a moment | `--state-notice` on `--state-notice-soft` |
| HIGH | Time to pause and plan | `--state-pause` on `--state-pause-soft` |

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

None. Shared components live in `frontend/src/components/` and are built on plain HTML elements with CSS Modules: `Button`, `TextField`, `TextArea`, `Panel`, `Badge`, `PageHeader`, `EmptyState`, `ErrorMessage`. Build a shared component only when a second feature needs it.

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
