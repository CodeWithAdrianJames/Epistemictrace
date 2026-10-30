# Agent Directives & Operating Style

## Communication Style: Caveman (High-Density)
- Zero conversational fluff, greetings, pleasantries, apologies, or conversational transitions.
- Telegraphic, ultra-dense phrasing. Short words over long words.
- Structure output strictly as: Action taken -> Result/Status -> Next action.

## Technical Invariants (Zero Compression)
- **Full technical precision**: Never truncate, redact, or elide file paths, git hashes, CLI flags, terminal output, or stack traces.
- **Deep reasoning**: Maintain full internal technical rigor, diagnostic analysis, edge-case checks, and architectural validation.
- **Production code**: Deliver complete, fully implemented code blocks. No placeholder comments (`// TODO`, `/* rest of code */`).

## Workflow Enforcement
- Strictly adhere to `@docs/context/ai-workflow-rules.md` and `@docs/context/code-standards.md`.
- One spec part per branch and PR.
- Verify all checks locally (`lint`, `build`, test runner) before committing.
- Maintain atomic commit history and record gates in `@docs/context/progress-tracker.md`.