---
name: EpistemicTrace
description: A calm, dark study space for learning Python, where struggle becomes a pause to plan.
colors:
  lamplight-violet: "#7e4bde"
  lamplight-violet-bright: "#8d5ff0"
  violet-edge: "#a581e8"
  violet-text: "#b79def"
  lavender-soft-text: "#cebbf3"
  violet-link: "#c4a8ff"
  reflect-violet: "#3a2f7a"
  reflect-border: "#5b46b8"
  trace-cyan: "#67e8f9"
  butter-highlight: "#f8e08e"
  danger-rose: "#f05a6e"
  fail-rose-text: "#f6a0ac"
  pass-green: "#8fd47f"
  pass-green-strong: "#66bc5a"
  midnight-indigo: "#1b1d3a"
  dusk-panel: "#252746"
  twilight-card: "#2d305a"
  dusk-hover: "#333661"
  inset-indigo: "#1d1f3d"
  console-indigo: "#191b36"
  login-field: "#3f4273"
  border-subtle: "#2f3260"
  border-default: "#3b3e70"
  border-strong: "#4a4d85"
  border-highlight: "#626596"
  text-primary: "#fcfcfc"
  text-secondary: "#cfd0ea"
  text-muted: "#a9aac8"
  text-faint: "#6d70a5"
  text-code: "#e6e7f7"
  text-placeholder: "#a2a4c9"
  white: "#ffffff"
  tile-purple-bg: "#392d68"
  tile-purple: "#a581e8"
  tile-blue-bg: "#383f68"
  tile-blue: "#8ab4ff"
  tile-green-bg: "#31414a"
  tile-green: "#66bc5a"
  tile-orange-bg: "#4c3444"
  tile-orange: "#e76f38"
typography:
  display:
    fontFamily: "'Space Mono', 'JetBrains Mono', 'Cascadia Code', ui-monospace, Consolas, monospace"
    fontSize: "3rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "clamp(2rem, 3.4vw, 3rem)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.5
  mono:
    fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, 'Cascadia Code', Consolas, 'Liberation Mono', monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  chip: "7px"
  control: "10px"
  sm: "12px"
  button: "14px"
  md: "16px"
  lg: "24px"
  pill: "9999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "24px"
  "6": "32px"
  "7": "56px"
components:
  button-primary:
    backgroundColor: "{colors.lamplight-violet}"
    textColor: "{colors.white}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 16px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.lamplight-violet-bright}"
    textColor: "{colors.white}"
  button-action:
    backgroundColor: "{colors.lamplight-violet}"
    textColor: "{colors.white}"
    rounded: "{rounded.button}"
    padding: "0 24px"
    height: "56px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.text-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 16px"
    height: "40px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "32px"
  input-field:
    backgroundColor: "{colors.dusk-hover}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "12px 16px"
    height: "48px"
  input-login:
    backgroundColor: "{colors.login-field}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    padding: "0 24px"
    height: "64px"
  card-panel:
    backgroundColor: "{colors.dusk-panel}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "24px 32px"
  card-raised:
    backgroundColor: "{colors.twilight-card}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.button}"
    padding: "16px"
  card-reflect:
    backgroundColor: "{colors.reflect-violet}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.button}"
    padding: "24px"
  badge-steady:
    backgroundColor: "rgba(103, 232, 249, 0.12)"
    textColor: "{colors.trace-cyan}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "32px"
  badge-notice:
    backgroundColor: "rgba(248, 224, 142, 0.14)"
    textColor: "{colors.butter-highlight}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "32px"
  badge-pause:
    backgroundColor: "rgba(126, 75, 222, 0.22)"
    textColor: "{colors.lavender-soft-text}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "32px"
  nav-link:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.sm}"
    padding: "0 24px"
    height: "56px"
  nav-link-active:
    backgroundColor: "rgba(126, 75, 222, 0.42)"
    textColor: "{colors.text-primary}"
---

# Design System: EpistemicTrace

## Overview

**Creative North Star: "The Night Study"**

EpistemicTrace is a late-night study room for learning Python. The walls are deep midnight indigo, the furniture is a few shades lighter, and one warm violet lamp marks the thing to do next. A small companion (the mascot) sits at the edges of the room, never in the way. A student who opens an activity should feel they have a quiet desk, enough light to work by, and nobody judging them.

The mood is calm, encouraging and focused. Density is comfortable rather than compact: generous padding, large hit targets, and one confident primary action per region. Glow and gradient are rewards, not noise. They gather around the next step (Run tests, Continue, the active section) and around the mascot. Everything else sits back in flat indigo tone. When the circuit breaker pauses the runner, the room does not turn red. It dims into a violet reflect card that asks the student to plan, while the editor stays lit and usable.

Dark only. There is no light theme in the MVP, and native controls follow the dark color scheme.

**Key Characteristics:**
- Midnight indigo canvas with a single violet radial glow at the top right and a violet → lavender → cyan trace line along the top edge of signed-in pages.
- One accent family (Lamplight Violet) carries every primary action, the active nav item and focus.
- Depth comes from tonal indigo layers and thin outlines. A soft ambient shadow grounds panels, and the violet glow is reserved for the primary action.
- Struggle states use calm, non-alarming hues (cyan, butter, lavender). Rose is reserved for test failures and invalid fields.
- Soft corners everywhere (10–16px), pill badges, nothing sharp.
- A friendly mascot appears decoratively in the logo, auth pages, the account card, the breaker panel and reflections.

## Colors

A deep indigo night with one violet lamp, a cyan trace, and butter-yellow notes for gentle attention.

### Primary
- **Lamplight Violet** (#7e4bde): the system's only action color. It fills primary buttons as a top-lit gradient from Lamplight Violet Bright (#8d5ff0) down to Lamplight Violet, draws the active nav rail, the editor tab underline, text selection, and the 2px focus border on fields. Too dark for text on the canvas: use it only as a fill or line.
- **Violet Edge** (#a581e8): the inner outline of primary buttons, the reflect-card and High-badge outline, the end of the page-heading gradient, and the purple icon tile.
- **Violet Text** (#b79def): violet as readable text (role captions, small icons on dark) and the focus ring color.
- **Lavender Soft Text** (#cebbf3): text on violet-tinted fills, the paused state, panel titles such as "Test results", and the solid fallback for gradient headings.
- **Violet Link** (#c4a8ff): inline links.
- **Reflect Violet** (#3a2f7a) with **Reflect Border** (#5b46b8): the reflect card (breaker panel, reflections, sidebar account card). It runs as a 135° gradient from Reflect Violet into Twilight Card.

### Secondary
- **Trace Cyan** (#67e8f9): the end of the top trace line, the console icon, and the Steady struggle level. It is the cool counterweight to violet and the only "all is well" signal for struggle.

### Tertiary
- **Butter Highlight** (#f8e08e): callouts (consent banner, "not tracked" notice) as a solid fill with Dusk Panel (#252746) text, and the Take a moment struggle level as text on a 14% tint.

### Neutral
- **Midnight Indigo** (#1b1d3a): signed-in page canvas.
- **Dusk Panel** (#252746): panels, cards, sidebar and nav bar, and the guest (auth) canvas.
- **Twilight Card** (#2d305a): raised cards inside a panel (test case cards, chips, the Edit button).
- **Dusk Hover** (#333661): clickable-row hover, panel header strips, app and sign-up field fill.
- **Inset Indigo** (#1d1f3d): inset and code surfaces (Monaco, sample blocks, read-only fields).
- **Console Indigo** (#191b36): the run bar under the editor.
- **Login Field** (#3f4273): the log-in page's borderless field fill.
- **Borders**: Subtle (#2f3260) for panel outlines and dividers, Default (#3b3e70) for cards, pills and nav borders, Strong (#4a4d85) for fields and dashed empty states, Highlight (#626596) for emphasized outlines.
- **Text**: Primary (#fcfcfc), Secondary (#cfd0ea), Muted (#a9aac8) for metadata, Code (#e6e7f7), Placeholder (#a2a4c9). Faint (#6d70a5) is about 3:1 and is for icons, separators and arrow affordances only.

### Status
- **Pass Green** (#8fd47f text, #66bc5a bars and fills) and **Fail Rose** (#f6a0ac text on a 14% tint of #f05a6e): test results only.
- **Danger Rose** (#f05a6e): invalid-field borders only; it is 4.4:1 on the canvas, so it never carries text.
- **Icon tiles**: purple, blue, green and orange pairs (tile background + tile foreground) for dashboard stats and list icons. The Published chip uses the green tile pair, not Pass Green.

### Named Rules
**The One Lamp Rule.** Lamplight Violet is the only action color. If two buttons in one region glow violet, one of them is wrong.

**The No Red Struggle Rule.** Struggle levels and the paused runner use cyan, butter and lavender, never rose or red. Pass/fail tokens belong to test results and nothing else.

**The Fill-Not-Text Rule.** #7e4bde and #f05a6e are fills and lines. Their readable counterparts are Violet Text (#b79def) and Fail Rose (#f6a0ac).

## Typography

**Display Font:** Space Mono (with JetBrains Mono, Cascadia Code, ui-monospace, Consolas, monospace)
**Body Font:** Inter (with system-ui, -apple-system, Segoe UI, Roboto, sans-serif)
**Label/Mono Font:** JetBrains Mono (with Fira Code, ui-monospace, Cascadia Code, Consolas, Liberation Mono, monospace)

**Character:** a typewriter-voiced display face sits over a neutral, legible UI sans. The monospace display ties the brand to code without making the interface feel like a terminal. No web fonts are bundled, so the stacks fall back to system fonts unless the named fonts are installed.

### Hierarchy
- **Display** (Space Mono 700, 3rem, 1.15): the log-in heading, the sign-up tagline's second line, dashboard stat numbers, and the sign-up facts.
- **Headline** (Inter 700, clamp(2rem, 3.4vw, 3rem), 1.1, −0.03em): page headings through `PageHeader`, filled with the Lavender → Violet Edge gradient (#d9c9f8 → #a581e8) where `background-clip: text` is supported.
- **Title** (Inter 700, 1.5rem, 1.25, −0.02em): panel titles and dialog titles. List titles and the workspace title use 1.25rem.
- **Body** (Inter 400, 1rem, 1.5): all running text. The problem statement keeps its line breaks (`pre-wrap`).
- **Label** (Inter 600, 0.875rem): form labels, badges, bar links, metadata. Chips and the sidebar role caption drop to 0.75rem; the role caption adds 0.08em tracking.
- **Mono** (JetBrains Mono 400, 0.875rem): test input/output, sample blocks, runtime errors, starter-code textarea, and Monaco.

### Named Rules
**The Typewriter Accent Rule.** Space Mono speaks only in big moments: auth headings, stat numbers, the tagline, the facts. It never sets body copy, labels or buttons.

## Layout

Signed-in pages put a 300px sticky sidebar beside the content (content up to 1640px). Below 900px the sidebar collapses into a bar across the top. Guest pages run up to 1680px on the Dusk Panel canvas. The coding workspace drops the sidebar for a 64px slim bar and uses the full width beneath it.

The workspace has three fixed regions: problem, editor and test results. At 1280px and wider they sit side by side at roughly 470 : 920 : 468. From 1024 to 1279px the problem takes the left 35% and the editor sits over the results on the right. Below that the regions stack. The instructor dashboard is a page header, an auto-fit row of four stat cards (minimum 200px each), then one list panel with divided rows.

Spacing follows a 4px base: 4, 8, 12, 16, 24, 32, 56px. Page sections are separated by 32px, panel padding is 24px × 32px, and list rows breathe at 32px vertical padding. Forms are one column with labels above fields and errors under them.

## Elevation & Depth

Layered, with glow for action. Depth comes first from tone: Midnight Indigo canvas, Dusk Panel surfaces, Twilight Card raised cards, Inset Indigo wells. Each step is outlined by a thin indigo border. A single ambient shadow grounds panels, cards and dialogs. The violet glow belongs to primary buttons and the mascot. Clickable rows change tone on hover; they do not lift.

### Shadow Vocabulary
- **Ambient** (`box-shadow: 0 8px 20px rgba(11, 12, 31, 0.45)`): panels, stat cards, dialogs and the reflect card.
- **Lamp Button** (`box-shadow: 0 10px 18px -6px rgba(126, 75, 222, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.25), inset 0 0 0 1px rgba(165, 129, 232, 0.55)`): primary buttons at rest: a violet drop glow, a white top edge and a Violet Edge inner outline.
- **Lamp Button Pressed** (`box-shadow: 0 4px 10px -4px rgba(126, 75, 222, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.25), inset 0 0 0 1px rgba(165, 129, 232, 0.55)`): the same, with a tighter glow while pressed.
- **Mascot Glow** (`filter: drop-shadow(0 0 6px rgba(126, 75, 222, 0.45))`, pulsing to 12px at 0.75): the logo mascot only.

### Named Rules
**The Glow Is Earned Rule.** Only the primary action and the mascot glow. Panels get the ambient shadow; everything else stays flat in tone.

**The No-Lift Rule.** Hover changes tone and outline, never position. Rows switch to Twilight Card with a Default border and nudge their arrow.

## Shapes

Soft-cornered and reassuring. Radii climb with size: 7px for text-link focus outlines, 10px for 32px controls and sample blocks, 12px for fields, buttons, icon tiles and rows, 14px for the Run tests button and test-case and reflect cards, 16px for panels and cards, 24px for dialogs. Badges, status chips and the pager are full pills. Borders are 1px throughout; empty states use a 1px dashed Strong border. Signed-in pages carry a 3px gradient trace line across the very top of the window.

## Components

### Buttons
Soft-cornered and reassuring: big targets, one confident lit action.
- **Shape:** gently rounded (12px); the 56px action buttons (Run tests) use 14px.
- **Primary:** a top-lit violet gradient (#8d5ff0 → #7e4bde) with white 600–700 text and the Lamp Button shadow. App buttons are at least 40px tall; Run tests and New activity are 56px; auth submits are 64px (log in) or 52px (sign-up).
- **Hover / Pressed / Disabled:** hover brightens the gradient (#9a70f3 → #8655e7); pressed tightens the glow; disabled drops to 60% opacity with no shadow and a not-allowed cursor.
- **Focus:** a 2px Violet Text ring offset 2px on every button and link.
- **Secondary** (Delete, Archive, consent decline, Back): transparent or Twilight Card with a 1px Strong or Default outline; hover to a 7% white wash, pressed to a dark wash. Never the accent fill.
- **Ghost** (bar links, Log out): no fill or border until hover; 32px tall, 10px corners.

### Chips and Badges
- **Struggle badge:** a 32px pill with a small dot in the level color. Steady is Trace Cyan on a 12% cyan tint; Take a moment is Butter on a 14% butter tint; Time to pause and plan is Lavender Soft Text on a 22% violet tint with a Violet Edge outline. Steady and Take a moment use a Default outline. The badge never shows a number.
- **Status chips:** pill-shaped, using the icon-tile pairs (Published = green tile).

### Cards / Containers
- **Corner Style:** 16px for panels and stat cards, 14px for test-case and reflect cards.
- **Background:** Dusk Panel for panels; Twilight Card for cards nested in panels; Dusk Hover for header strips.
- **Shadow Strategy:** Ambient shadow (see Elevation & Depth).
- **Border:** 1px Subtle on panels, Default on raised cards.
- **Internal Padding:** 24px × 32px for panels; 24px for stat and reflect cards.

### Inputs / Fields
- **Style:** app and sign-up fields are Dusk Hover with a 1px Strong border and 12px corners (48px tall in the app, 52px on sign-up). Log-in fields are 64px Login Field fills whose border matches the fill. Code and read-only fields use Inset Indigo.
- **Focus:** a 2px Lamplight Violet line (1px border plus a 1px ring); the outline itself is removed. Hover turns the border violet.
- **Error / Disabled:** invalid fields get a Danger Rose border with Fail Rose text underneath. Read-only fields sit on Inset Indigo with a Subtle border and Secondary text.

### Navigation
- **Sidebar** (signed-in pages): 300px on Dusk Panel with a Subtle right border. Logo on top with the role in Violet Text caps. Links are 56px tall at 1.125rem, Secondary text with Muted icons. The active link gets the violet gradient wash (42% → 16%), a Reflect Border outline and a 4px violet rail at the left edge. The account card at the bottom is a reflect card with the mascot avatar, name, "{Role} mode" and an outlined Log out.
- **Slim bar** (guests, workspace): 64px, sticky, logo left, 32px ghost links, account and Log out at the right.
- **Mobile:** below 900px the sidebar becomes a top bar; the rail, role caption and avatar hide.

### Breaker Panel (signature)
The pause moment. A reflect card (Reflect Violet → Twilight Card gradient, 1px Violet Edge outline, Ambient shadow, 14px corners) appears inline above the results, never as a modal. The mascot sits beside a Lavender Soft Text heading ("Let's pause and plan"). Two reflection fields on Inset Indigo with Reflect Border outlines lead to a full-width primary Continue button. Focus moves to the first field when it appears; the editor and problem statement stay usable.

### Run Tests Button (signature)
A full-width 56px primary button in the Console Indigo run bar under the editor. It shows a play icon when ready, a spinning ring while busy, and a lock icon with "Paused — see below" when the breaker is active. The reason for any disabled state is shown as visible text next to it.

### Brand Logo and Mascot
The mascot (violet outline, dark body, pale face, cyan ring, gold spark) plus the "EpistemicTrace" wordmark in Inter 800. The mascot floats 2px every 3s and its glow pulses; on hover the logo scales to 1.04 with a bounce ease and the mascot tilts −8°. All motion stops under `prefers-reduced-motion`. The mascot is always decorative (`aria-hidden`).

## Do's and Don'ts

### Do:
- **Do** use tokens from `frontend/src/styles/tokens.css` through `var(--token)`. The only hard-coded palette is the Monaco theme in `editorTheme.ts`.
- **Do** keep one violet primary action per region, with the Lamp Button shadow.
- **Do** use Violet Text (#b79def) or Violet Link (#c4a8ff) for violet text, and Fail Rose (#f6a0ac) for error text.
- **Do** pair every status color with a text label; icons always sit next to text.
- **Do** keep the breaker panel inline and the editor usable while the runner is paused.
- **Do** re-check WCAG AA contrast (4.5:1 body, 3:1 large) whenever a color value changes.
- **Do** turn off logo float, glow pulse, caret blink and spinners under `prefers-reduced-motion`.

### Don't:
- **Don't** use rose, red, or pass/fail tokens for struggle levels or the paused runner.
- **Don't** show a number, percentage, progress bar toward the threshold, or the word "SDI" in student UI.
- **Don't** put #7e4bde or #f05a6e on text, or use Text Faint (#6d70a5) for body copy.
- **Don't** add a second accent fill or glow to secondary actions.
- **Don't** lift rows or cards on hover; change tone and outline instead.
- **Don't** use Space Mono for body text, labels or buttons.
- **Don't** add a light theme, an icon library or bundled web fonts without a Stack decision in `PROJECT.md`.
- **Don't** build the reference screens' non-existent features (social log-in buttons, password reset, hints/notes tabs, timer, score footer).
