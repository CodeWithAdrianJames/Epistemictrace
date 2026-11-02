# 29 — Instructor Analytics API

- **Card:** IMP-29 (N/A) · **Feature:** INS-01 (Should)
- **Owner:** Adrian Bona · **Reviewer:** Noel
- **Depends on:** 08, 21, 22, 24, 26
- **Gates:** — (Q1 is Accepted; the level bands and threshold come from it)

## Goal

An instructor can fetch process analytics for their own activities: per activity and per student, the runs, session time, peak SDI, breaker triggers and a struggle distribution, so the dashboard page (IMP-30) has data to show.

## In Scope

- `GET /api/instructor/analytics` (one summary row per owned activity).
- `GET /api/instructor/activities/{id}/analytics` (totals, struggle distribution and one row per student for one owned activity).
- New package `analytics/` (controller, service, repository projections, DTO records).

## Out of Scope

- The dashboard page and `/instructor/analytics` route (IMP-30, frontend). Today that URL only reaches the app's `*` "Page not found" route.
- Difficulty heatmap (INS-02), per-activity SDI settings (INS-03), repeated-trigger alerts (INS-04), JSON/CSV export and anonymization (INS-05), reflection review.
- Event-level timelines and code snapshots.
- A new table, column or migration. Everything is read from `coding_sessions`, `telemetry_events`, `reflections`, `sdi_configs`, `users` and `activities`.
- Any change to student-facing responses.

## Requirements

- **R1** `GET /api/instructor/activities/{id}/analytics` (role `INSTRUCTOR`). The activity must belong to the caller; ownership is checked first, with the same rule and error as spec 08 (`ActivityService.getForInstructor`). Response:
  ```json
  { "activityId": 5, "activityTitle": "…", "status": "PUBLISHED",
    "totals": { "studentCount": 12, "sessionCount": 15, "runCount": 140, "sessionSeconds": 5400,
                "breakerTriggerCount": 6, "reflectionCount": 5, "peakSdi": 93 },
    "distribution": { "LOW": 7, "MEDIUM": 3, "HIGH": 2 },
    "students": [ { "studentId": 4, "name": "…", "email": "…", "sessionCount": 1, "runCount": 9,
                    "sessionSeconds": 20, "peakSdi": 93, "level": "HIGH",
                    "breakerTriggerCount": 1, "reflectionCount": 1, "lastActiveAt": "…" } ] }
  ```
- **R2** Definitions, per student for the activity (totals sum or maximise the same values):
  - `sessionCount`: rows in `coding_sessions`. Only students with at least one session appear.
  - `runCount`: `telemetry_events` of type `RUN` in those sessions.
  - `sessionSeconds`: sum of `endedAt − startedAt` in whole seconds over sessions that have an `endedAt`. Open sessions add 0.
  - `peakSdi`: maximum of `coding_sessions.peak_sdi`; `null` if no run was scored.
  - `reflectionCount`: rows in `reflections` for those sessions.
  - `breakerTriggerCount`: `reflectionCount` plus the sessions whose `runner_locked` is `true` (a lock not yet answered by a reflection). `telemetry_events.type` allows only `EDIT`, `RUN` and `ERROR`, so no event records a trip, no trigger column exists, and none is added (no V4 migration).
  - `lastActiveAt`: latest `occurred_at` among the student's events in the activity, else the latest `started_at`.
  - `level`: `LOW`, `MEDIUM` or `HIGH` from `peakSdi` with `StruggleLevels.of(peakSdi, sdi.levels.medium-from, sdiConfig.threshold)`; `null` when `peakSdi` is `null`.
- **R3** `distribution` counts students by `level`; students with a `null` level are not counted. Keys `LOW`, `MEDIUM` and `HIGH` are always present.
- **R4** `students` are ordered by `peakSdi` descending (nulls last), then `name`, then `studentId`. No paging; the list is bounded by the number of students who opened the activity.
- **R5** `GET /api/instructor/analytics` (role `INSTRUCTOR`): only the caller's activities, newest `updated_at` first, archived ones included. Response:
  ```json
  { "activities": [ { "activityId", "activityTitle", "status", "studentCount", "sessionCount", "runCount",
                      "sessionSeconds", "breakerTriggerCount", "peakSdi",
                      "distribution": { "LOW", "MEDIUM", "HIGH" } } ] }
  ```
  An activity with no sessions appears with zeros, `peakSdi: null` and an all-zero distribution. Fields use the R2 definitions.
- **R6** Raw `peakSdi` is returned because INS-01 shows it to the instructor. Invariant 5 (no raw SDI for students) is untouched: both endpoints are `INSTRUCTOR`-only, and a `STUDENT` token gets `403`, no token gets `401`.
- **R7** `SecurityConfig` needs no new rule: `/api/instructor/**` is already `INSTRUCTOR`. Add the two paths to `architecture-context.md` → API Surface.
- **R8** The level bands, threshold and window are read from configuration and the activity's `sdi_configs` row (invariant 7). Query and mapping code contain no SDI constants.
- **R9** Controllers hold no business logic (invariant 10): `AnalyticsService` builds the response from repository aggregates; the level and the distribution come from a plain, unit-tested function.
- **R10** Performance: R1 uses a fixed number of aggregate queries (no N+1). With 100 students, 500 sessions and 25 000 events in one activity, R1 responds in under 500 ms on a developer laptop. R5 with 20 activities responds in under 1 s.

## Parts

1. Repository aggregate queries (per student and per activity) and the plain level/distribution function, with tests.
2. `GET /api/instructor/activities/{id}/analytics` with MockMvc tests.
3. `GET /api/instructor/analytics` with MockMvc tests, API Surface doc update and the R10 timing check.

## Acceptance Criteria

- [ ] R1 returns runs, session seconds, peak SDI and breaker triggers per student for the caller's own activity (INS-01, API).
- [ ] Another instructor's activity id is refused as spec 08 refuses it; a student token returns `403`; no token returns `401`.
- [ ] A session with 9 RUN events, `peak_sdi` 93 and one reflection gives `runCount` 9, `peakSdi` 93, `level` `HIGH`, `breakerTriggerCount` 1.
- [ ] A locked session without a reflection counts as one trigger; after its reflection it counts as one, not two.
- [ ] `distribution` always has all three keys and sums to the number of students with a `peakSdi`.
- [ ] R5 lists only the caller's activities, including an activity with no sessions.
- [ ] Changing `epistemictrace.sdi.levels.medium-from` or an activity's threshold changes `level` without a code change.
- [ ] The R10 timing output is attached to the card.

## Tests

- `AnalyticsLevelTests` (pure): level boundaries at `medium-from` and at the threshold, `null` peak, distribution with all keys.
- `AnalyticsRepositoryTests` (`@DataJpaTest`): sums and maximums, open vs ended sessions, trigger count with and without reflection, two students and two activities kept apart.
- `InstructorAnalyticsControllerTests`: ownership, role `403`, no token `401`, ordering, empty activity.
- `AnalyticsPerformanceTests` (tagged, may be run manually): seeded 100 students / 500 sessions / 25 000 events timing.

## Docs to Update

- `architecture-context.md` → API Surface: the two new rows (spec 29).
- `feature-specs/README.md`: dependency table row for 29.
- `progress-tracker.md`: Completed entry; list IMP-30 (dashboard page) as next.
