# 15 — Consent Notice

- **Card:** IMP-15 (https://trello.com/c/m3meZiYc) · **Feature:** consent notice (in the CSIT321 doc, no feature card) / M5
- **Owner:** Jacob · **Reviewer:** Noel (Part A may be taken by Noel as backend owner)
- **Depends on:** Part A: 06 · Part B: 14 and Part A
- **Gates:** Q6 (behavior accepted **and** final notice text written)

## Goal

Before a student's first session, they see a consent notice. Accepting is recorded on their account; declining lets them keep coding without any tracking.

## In Scope

- **Part A (backend):** `PUT /api/me/consent`; `consentAccepted` already returned by `/api/auth/me` (spec 05).
- **Part B (frontend):** `features/consent/ConsentNotice.tsx`, `useConsent.ts`, and the workspace integration.

## Out of Scope

- Withdrawing consent and deleting collected data (needs a retention decision, Q6).
- Instructor view of consent status.

## Requirements

### Part A — API

- **R1** `PUT /api/me/consent` (role `STUDENT`), no body. Sets `users.consent_accepted_at = now()` if it is `null`; if already set, leaves it unchanged. Returns `200 { "consentAcceptedAt": ISO-8601 }`.

### Part B — UI

- **R2** The notice text lives in `features/consent/consentText.ts` and is copied verbatim from the text accepted for Q6. Do not write or edit the wording in code review; change it only through the Q6 decision.
- **R3** On the workspace page, after the activity loads: if `user.consentAccepted` is `false` and the student has not declined in this browser tab, show the notice as a centered dialog with **I agree** and **Not now**. The rest of the page is visible behind it but not interactive until a choice is made.
- **R4** **I agree** → `PUT /api/me/consent`; on success update the auth user (`consentAccepted = true`) and close the dialog. On failure show the error in the dialog and keep it open.
- **R5** **Not now** → remember the choice in `sessionStorage` key `epistemictrace:consent-declined` (this tab only), close the dialog, and show a banner above the editor: "Tracking is off for this visit, so tests won't pause and nothing is recorded. **Turn on tracking**". The link reopens the notice.
- **R6** `useConsent()` returns `{ status: 'accepted' | 'declined' | 'pending', accept(), decline() }`. Spec 17 starts tracking only when `status === 'accepted'`.
- **R7** The notice never appears on any page other than the workspace.

## Parts

1. Part A endpoint with tests.
2. Part B notice, banner and `useConsent` with tests.

## Acceptance Criteria

- [ ] A new student opening an activity sees the notice before anything is recorded.
- [ ] After **I agree**, the notice never shows again for that account, on any device.
- [ ] After **Not now**, the student can still edit and run tests, and the banner is shown; reopening the tab shows the notice again.
- [ ] Calling `PUT /api/me/consent` twice keeps the first timestamp.
- [ ] An instructor token gets `403` on `PUT /api/me/consent`.

## Tests

- `ConsentControllerTests`: sets once; idempotent; instructor `403`; no token `401`.
- `ConsentNotice.test.tsx`: shows when pending; accept calls API and closes; decline shows banner.
- `useConsent.test.ts`: status from user + `sessionStorage`.

## Docs to Update

- `PROJECT.md` §3: remove "consent notice" from "missing a card"; record decline behavior from Q6.
- `progress-tracker.md`: Completed entry.
