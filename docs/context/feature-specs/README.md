# Feature Specs

Each file here is one implementation unit. File numbers match the Trello cards in list **7 · Implement** (`01-…` = `IMP-01`). Specs 01–27 cover the MVP must-haves; 28 is the first should-have because it reuses the MVP's data.

## How to Use a Spec

1. Check **Depends on**: every listed spec is merged to `main`.
2. Check **Gates**: every listed `Qn` is **Accepted** in `../progress-tracker.md`. If not, stop.
3. Implement the **Parts** in order. Each part is one pull request and must pass its own checks before the next part starts.
4. Build only what **In scope** and **Requirements** say. **Out of scope** items are not built.
5. Verify every **Acceptance criterion**, attach the evidence to the Trello card, and update the files listed under **Docs to update**.

## Spec Template

```markdown
# NN — Title

- **Card:** IMP-NN (link) · **Feature:** PLT-01 / M1
- **Owner:** … · **Reviewer:** …
- **Depends on:** specs that must be merged first
- **Gates:** open questions that must be Accepted

## Goal
One or two sentences: what exists after this unit that did not before.

## In Scope
## Out of Scope
## Requirements
Numbered, testable statements (R1, R2, …). Exact paths, names, payloads and rules.
## Parts
Ordered, independently verifiable steps; one PR each.
## Acceptance Criteria
Checkboxes the reviewer ticks. Each maps to one or more requirements.
## Tests
Automated tests to write; manual checks where automation is not possible.
## Docs to Update
```

## Dependency Table

| Spec | Card | Feature | Owner → Reviewer | Depends on | Gates |
|---|---|---|---|---|---|
| [01](01-backend-database-and-security.md) | IMP-01 | PLT-01 | Noel → Adrian | — | Q9, Q12, Q13 |
| [02](02-database-tables.md) | IMP-02 | PLT-01 | Noel → Adrian | 01 | Q17 |
| [03](03-ci-checks.md) | IMP-03 | PLT | Noel → Adrian | 01, 04 | Q9 |
| [04](04-frontend-app-shell.md) | IMP-04 | PLT | Jacob → Noel | — | Q11, Q12 |
| [05](05-register-and-login-api.md) | IMP-05 | PLT-01 / M1 | Noel → Adrian | 02 | Q3, Q5, Q13 |
| [06](06-role-based-access-control.md) | IMP-06 | PLT-01 / M1 | Noel → Adrian | 05 | Q5 |
| [07](07-auth-pages.md) | IMP-07 | PLT-01 / M1 | Jacob → Noel | 04, 05 | Q11, Q13 |
| [08](08-activities-api.md) | IMP-08 | PLT-02 / M2 | Noel → Jacob | 06 | Q5, Q16 |
| [09](09-instructor-activity-editor.md) | IMP-09 | PLT-02 / M2 | Jacob → Noel | 07, 08 | Q16 |
| [10](10-student-activity-list.md) | IMP-10 | PLT-02 / M2 | Jacob → Noel | 07, 08 | — |
| [11](11-python-code-editor.md) | IMP-11 | CW-01 / M3 | Jacob → Adrian | 04 | — |
| [12](12-python-runner.md) | IMP-12 | CW-02 / M4 | Adrian → Noel | 04 | Q7, Q14 |
| [13](13-test-checker-and-error-grouping.md) | IMP-13 | CW-02 / M4 | Adrian → Noel | 08, 12 | Q4, Q8, Q14 |
| [14](14-coding-workspace-page.md) | IMP-14 | CW-03 / M3, M4 | Jacob → Adrian | 10, 11, 13 | Q8 |
| [15](15-consent-notice.md) | IMP-15 | Consent / M5 | Jacob → Noel | A: 06 · B: 14, 15A | Q6 |
| [16](16-coding-session-api.md) | IMP-16 | TEL-02 / M5 | Noel → Adrian | 08, 15A | Q5, Q15 |
| [17](17-browser-activity-tracking.md) | IMP-17 | TEL-01 / M5 | Adrian → Noel | 11, 13, 15B, 16, 18 | Q4 |
| [18](18-save-tracked-activity.md) | IMP-18 | TEL-02 / M5 | Noel → Adrian | 16 | Q4, Q5 |
| [19](19-sdi-signal-calculations.md) | IMP-19 | TEL-03 / M6 | Adrian → Noel | 02 | Q1, Q2 |
| [20](20-sdi-score-engine.md) | IMP-20 | TEL-03 / M6 | Adrian → Jacob | 19 | Q1 |
| [21](21-update-sdi-after-every-run.md) | IMP-21 | TEL-03 / M6 | Adrian → Noel | 18, 20 | Q1, Q2 |
| [22](22-circuit-breaker-logic.md) | IMP-22 | MCB-01 / M7 | Adrian → Jacob | 20, 21 | Q1, Q2, Q8 |
| [23](23-lock-the-run-button.md) | IMP-23 | MCB-01 / M7 | Adrian → Jacob | 14, 17, 22 | Q2, Q15 |
| [24](24-save-reflections-api.md) | IMP-24 | MCB-02 / M7 | Noel → Adrian | 22 | Q8 |
| [25](25-reflection-form.md) | IMP-25 | MCB-02 / M7 | Jacob → Adrian | 23, 24 | Q8 |
| [26](26-session-history-api.md) | IMP-26 | STU-01 / M8 | Noel → Jacob | 24 | — |
| [27](27-session-history-page.md) | IMP-27 | STU-01 / M8 | Jacob → Noel | 26 | — |
| [28](28-struggle-level-indicator.md) | IMP-28 | STU-02 (Should) | Jacob → Adrian | 14, 17, 21 | Q1 |

## Parallel Lanes

```
Backend:  01 → 02 → 05 → 06 → 08 → 15A → 16 → 18 → 21 → 22 → 24 → 26
                 └→ 19 → 20 ┘ (joins at 21)
Frontend: 04 → 11, 12 → (07 after 05) → 10, 09 (after 08) → 13 → 14 → 15B → 17 → 23 → 25 → 27, 28
DevOps:   03 (after 01 and 04)
```

## Dependency Notes

These differ from the "After" field on the Trello card. Update the cards to match:

- **16 needs 15A.** The server must refuse to start a session without consent (invariant 2), so the consent column and endpoint must exist first.
- **17 needs 18.** The browser sends batches to the events endpoint; without it, sending cannot be verified end to end.
- **22 needs 21.** Part B of spec 22 evaluates the breaker inside event ingestion, which spec 21 creates. Part A (pure logic) only needs 20.
- **28 needs 17.** The struggle level arrives in the events response that spec 17 handles.

## Rules Every Spec Inherits

- `../architecture-context.md` → Invariants apply to every spec even when not repeated.
- Student-facing responses and screens never contain raw SDI values.
- No new dependency beyond `../architecture-context.md` → Stack.
- Each part is one PR, reviewed by someone other than the author.
