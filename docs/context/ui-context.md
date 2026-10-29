# UI Context

> **Status:** draft for PLN-07 (Frontend design). The visual values below are a starting proposal so that specs can be implemented consistently. Change them through a PR that updates this file; the wording rules in **Student-Facing Wording** come from `PROJECT.md` and are not optional.

## Theme

Light only for the MVP. The visual language is a calm study tool: white and soft-grey surfaces, one blue accent for actions, and no alarming colors for struggle. Students may already be frustrated when the runner locks; the interface should feel like a pause, not a punishment.

All colors are CSS custom properties defined in `frontend/src/styles/tokens.css` and used through `var(--token)` in CSS Modules (`*.module.css`). Components must use these tokens — no hard-coded hex values in component styles.

| Role               | CSS Variable          | Value      |
| ------------------ | --------------------- | ---------- |
| Page background    | `--bg-page`           | `#f6f7f9`  |
| Surface (panels)   | `--bg-surface`        | `#ffffff`  |
| Subtle surface     | `--bg-subtle`         | `#eef0f3`  |
| Default border     | `--border-default`    | `#d9dde3`  |
| Strong border      | `--border-strong`     | `#b8bec7`  |
| Primary text       | `--text-primary`      | `#1b1f24`  |
| Secondary text     | `--text-secondary`    | `#4a525c`  |
| Muted text         | `--text-muted`        | `#6b7480`  |
| Accent (actions)   | `--accent`            | `#2f5bd3`  |
| Accent hover       | `--accent-hover`      | `#2449ad`  |
| Accent soft        | `--accent-soft`       | `#e6ecfb`  |
| Pass               | `--state-pass`        | `#1f7a4d`  |
| Pass soft          | `--state-pass-soft`   | `#e3f3ea`  |
| Fail               | `--state-fail`        | `#b3412f`  |
| Fail soft          | `--state-fail-soft`   | `#fbe9e5`  |
| Notice             | `--state-notice`      | `#8a5a00`  |
| Notice soft        | `--state-notice-soft` | `#fdf3dc`  |
| Pause (breaker)    | `--state-pause`       | `#5b4bb7`  |
| Pause soft         | `--state-pause-soft`  | `#eeebfb`  |

Pass/fail colors are for **test results only**. They are never used for the struggle level or the locked runner.

## Typography

No web-font dependency. System stacks defined as tokens:

| Role      | CSS Variable  | Value |
| --------- | ------------- | ----- |
| UI text   | `--font-ui`   | `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` |
| Code/mono | `--font-mono` | `ui-monospace, "Cascadia Code", Consolas, "Liberation Mono", monospace` |

Base size 16px, line height 1.5. Problem statements, test input/output and error messages that show code use `--font-mono`. Monaco uses its own font settings with the light `vs` theme.

## Spacing and Radius

| Token            | Value  | Use |
| ---------------- | ------ | --- |
| `--space-1`..`--space-6` | 4, 8, 12, 16, 24, 32 px | Padding and gaps |
| `--radius-sm`    | 6px    | Inputs, buttons, badges |
| `--radius-md`    | 10px   | Panels and cards |
| `--radius-lg`    | 14px   | Dialogs and the breaker panel |

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
