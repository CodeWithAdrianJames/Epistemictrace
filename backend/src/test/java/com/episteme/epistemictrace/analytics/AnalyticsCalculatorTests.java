package com.episteme.epistemictrace.analytics;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.episteme.epistemictrace.sdi.StruggleLevel;

class AnalyticsCalculatorTests {

	private static final Instant START = Instant.parse("2026-10-29T10:00:00Z");

	private static final int MEDIUM_FROM = 40;

	private static final int THRESHOLD = 70;

	private static final List<StudentIdentity> IDENTITIES = List.of(
			new StudentIdentity(1L, "Student One", "student1@example.test"),
			new StudentIdentity(2L, "Student Two", "student2@example.test"),
			new StudentIdentity(3L, "Student Three", "student3@example.test"));

	@Test
	void levelOfFollowsTheBoundaries() {
		assertThat(AnalyticsCalculator.levelOf(null, MEDIUM_FROM, THRESHOLD)).isNull();
		assertThat(AnalyticsCalculator.levelOf(0, MEDIUM_FROM, THRESHOLD)).isEqualTo(StruggleLevel.LOW);
		assertThat(AnalyticsCalculator.levelOf(39, MEDIUM_FROM, THRESHOLD)).isEqualTo(StruggleLevel.LOW);
		assertThat(AnalyticsCalculator.levelOf(40, MEDIUM_FROM, THRESHOLD)).isEqualTo(StruggleLevel.MEDIUM);
		assertThat(AnalyticsCalculator.levelOf(69, MEDIUM_FROM, THRESHOLD)).isEqualTo(StruggleLevel.MEDIUM);
		assertThat(AnalyticsCalculator.levelOf(70, MEDIUM_FROM, THRESHOLD)).isEqualTo(StruggleLevel.HIGH);
		assertThat(AnalyticsCalculator.levelOf(100, MEDIUM_FROM, THRESHOLD)).isEqualTo(StruggleLevel.HIGH);
	}

	@Test
	void levelOfUsesTheGivenBoundariesAndNoConstants() {
		assertThat(AnalyticsCalculator.levelOf(50, 20, 50)).isEqualTo(StruggleLevel.HIGH);
		assertThat(AnalyticsCalculator.levelOf(49, 20, 50)).isEqualTo(StruggleLevel.MEDIUM);
		assertThat(AnalyticsCalculator.levelOf(19, 20, 50)).isEqualTo(StruggleLevel.LOW);
	}

	@Test
	void studentWithNineRunsPeak93AndOneReflectionIsHighWithOneTrigger() {
		AnalyticsSessionRow session = session(10L, 1L, START, START.plusSeconds(20), 93, false);

		List<StudentAnalytics> rows = AnalyticsCalculator.students(List.of(session),
				List.of(new SessionEventTotals(10L, 9L, START.plusSeconds(18))),
				List.of(new SessionReflectionCount(10L, 1L)), IDENTITIES, MEDIUM_FROM, THRESHOLD);

		assertThat(rows).singleElement().satisfies(row -> {
			assertThat(row.studentId()).isEqualTo(1L);
			assertThat(row.name()).isEqualTo("Student One");
			assertThat(row.email()).isEqualTo("student1@example.test");
			assertThat(row.sessionCount()).isEqualTo(1);
			assertThat(row.runCount()).isEqualTo(9);
			assertThat(row.sessionSeconds()).isEqualTo(20);
			assertThat(row.peakSdi()).isEqualTo(93);
			assertThat(row.level()).isEqualTo(StruggleLevel.HIGH);
			assertThat(row.reflectionCount()).isEqualTo(1);
			assertThat(row.breakerTriggerCount()).isEqualTo(1);
			assertThat(row.lastActiveAt()).isEqualTo(START.plusSeconds(18));
		});
	}

	@Test
	void lockedSessionWithoutReflectionCountsAsOneTrigger() {
		AnalyticsSessionRow locked = session(10L, 1L, START, null, 77, true);

		List<StudentAnalytics> rows = AnalyticsCalculator.students(List.of(locked), List.of(), List.of(), IDENTITIES,
				MEDIUM_FROM, THRESHOLD);

		assertThat(rows).singleElement().satisfies(row -> {
			assertThat(row.breakerTriggerCount()).isEqualTo(1);
			assertThat(row.reflectionCount()).isZero();
		});
	}

	@Test
	void sessionThatWasReflectedAndLockedAgainCountsTwoTriggers() {
		AnalyticsSessionRow lockedAgain = session(10L, 1L, START, null, 90, true);

		List<StudentAnalytics> rows = AnalyticsCalculator.students(List.of(lockedAgain), List.of(),
				List.of(new SessionReflectionCount(10L, 1L)), IDENTITIES, MEDIUM_FROM, THRESHOLD);

		assertThat(rows).singleElement().satisfies(row -> assertThat(row.breakerTriggerCount()).isEqualTo(2));
	}

	@Test
	void openSessionAddsNoSessionSecondsAndEndedSessionsAreSummed() {
		AnalyticsSessionRow ended = session(10L, 1L, START, START.plusSeconds(90), 10, false);
		AnalyticsSessionRow endedWithFraction = session(11L, 1L, START.plusSeconds(200),
				START.plusSeconds(230).plusMillis(900), 10, false);
		AnalyticsSessionRow open = session(12L, 1L, START.plusSeconds(500), null, 10, false);

		List<StudentAnalytics> rows = AnalyticsCalculator.students(List.of(ended, endedWithFraction, open),
				List.of(), List.of(), IDENTITIES, MEDIUM_FROM, THRESHOLD);

		assertThat(rows).singleElement().satisfies(row -> {
			assertThat(row.sessionCount()).isEqualTo(3);
			assertThat(row.sessionSeconds()).isEqualTo(120);
		});
	}

	@Test
	void studentWithoutScoredRunHasNoPeakAndNoLevelAndLastActiveIsLatestStart() {
		AnalyticsSessionRow first = session(10L, 1L, START, null, null, false);
		AnalyticsSessionRow second = session(11L, 1L, START.plusSeconds(60), null, null, false);

		List<StudentAnalytics> rows = AnalyticsCalculator.students(List.of(first, second), List.of(), List.of(),
				IDENTITIES, MEDIUM_FROM, THRESHOLD);

		assertThat(rows).singleElement().satisfies(row -> {
			assertThat(row.peakSdi()).isNull();
			assertThat(row.level()).isNull();
			assertThat(row.runCount()).isZero();
			assertThat(row.lastActiveAt()).isEqualTo(START.plusSeconds(60));
		});
	}

	@Test
	void peakIsTheHighestAcrossSessionsAndLastActiveIsTheLatestEvent() {
		AnalyticsSessionRow first = session(10L, 1L, START, START.plusSeconds(10), 45, false);
		AnalyticsSessionRow second = session(11L, 1L, START.plusSeconds(60), START.plusSeconds(70), 30, false);

		List<StudentAnalytics> rows = AnalyticsCalculator.students(List.of(first, second),
				List.of(new SessionEventTotals(10L, 2L, START.plusSeconds(8)),
						new SessionEventTotals(11L, 1L, START.plusSeconds(65))),
				List.of(), IDENTITIES, MEDIUM_FROM, THRESHOLD);

		assertThat(rows).singleElement().satisfies(row -> {
			assertThat(row.peakSdi()).isEqualTo(45);
			assertThat(row.level()).isEqualTo(StruggleLevel.MEDIUM);
			assertThat(row.runCount()).isEqualTo(3);
			assertThat(row.lastActiveAt()).isEqualTo(START.plusSeconds(65));
		});
	}

	@Test
	void studentsAreOrderedByPeakDescendingNullsLastThenNameThenId() {
		List<StudentIdentity> identities = List.of(new StudentIdentity(1L, "Bea", "bea@example.test"),
				new StudentIdentity(2L, "Ana", "ana@example.test"), new StudentIdentity(3L, "Cy", "cy@example.test"),
				new StudentIdentity(4L, "Ana", "ana2@example.test"), new StudentIdentity(5L, "Dee", "dee@example.test"));
		List<AnalyticsSessionRow> sessions = List.of(session(10L, 1L, START, null, 50, false),
				session(11L, 2L, START, null, 50, false), session(12L, 3L, START, null, 80, false),
				session(13L, 4L, START, null, 50, false), session(14L, 5L, START, null, null, false));

		List<StudentAnalytics> rows = AnalyticsCalculator.students(sessions, List.of(), List.of(), identities,
				MEDIUM_FROM, THRESHOLD);

		assertThat(rows).extracting(StudentAnalytics::studentId).containsExactly(3L, 2L, 4L, 1L, 5L);
	}

	@Test
	void studentsWithoutSessionsAreNotListed() {
		List<StudentAnalytics> rows = AnalyticsCalculator.students(List.of(session(10L, 2L, START, null, 10, false)),
				List.of(), List.of(), IDENTITIES, MEDIUM_FROM, THRESHOLD);

		assertThat(rows).extracting(StudentAnalytics::studentId).containsExactly(2L);
	}

	@Test
	void noSessionsGiveNoRows() {
		assertThat(AnalyticsCalculator.students(List.of(), List.of(), List.of(), List.of(), MEDIUM_FROM, THRESHOLD))
			.isEmpty();
	}

	@Test
	void missingIdentityIsRefused() {
		List<AnalyticsSessionRow> sessions = List.of(session(10L, 99L, START, null, 10, false));

		assertThatThrownBy(() -> AnalyticsCalculator.students(sessions, List.of(), List.of(), IDENTITIES, MEDIUM_FROM,
				THRESHOLD))
			.isInstanceOf(IllegalStateException.class)
			.hasMessageContaining("99");
	}

	@Test
	void distributionAlwaysHasAllThreeLevelsAndSkipsStudentsWithoutLevel() {
		List<StudentAnalytics> students = AnalyticsCalculator.students(
				List.of(session(10L, 1L, START, null, 10, false), session(11L, 2L, START, null, 55, false),
						session(12L, 3L, START, null, null, false)),
				List.of(), List.of(), IDENTITIES, MEDIUM_FROM, THRESHOLD);

		assertThat(AnalyticsCalculator.distribution(students)).containsOnlyKeys(StruggleLevel.values())
			.containsEntry(StruggleLevel.LOW, 1)
			.containsEntry(StruggleLevel.MEDIUM, 1)
			.containsEntry(StruggleLevel.HIGH, 0);
		assertThat(AnalyticsCalculator.distribution(List.of())).containsOnlyKeys(StruggleLevel.values())
			.containsValues(0, 0, 0);
	}

	@Test
	void totalsSumTheStudentsAndTakeTheHighestPeak() {
		List<StudentAnalytics> students = AnalyticsCalculator.students(
				List.of(session(10L, 1L, START, START.plusSeconds(20), 93, false),
						session(11L, 2L, START, START.plusSeconds(40), 30, true),
						session(12L, 3L, START, null, null, false)),
				List.of(new SessionEventTotals(10L, 9L, START.plusSeconds(18)),
						new SessionEventTotals(11L, 4L, START.plusSeconds(30))),
				List.of(new SessionReflectionCount(10L, 1L)), IDENTITIES, MEDIUM_FROM, THRESHOLD);

		AnalyticsTotals totals = AnalyticsCalculator.totals(students);

		assertThat(totals).isEqualTo(new AnalyticsTotals(3, 3, 13, 60, 2, 1, 93));
		assertThat(AnalyticsCalculator.totals(List.of())).isEqualTo(new AnalyticsTotals(0, 0, 0, 0, 0, 0, null));
	}

	private static AnalyticsSessionRow session(long sessionId, long studentId, Instant startedAt, Instant endedAt,
			Integer peakSdi, boolean runnerLocked) {
		return new AnalyticsSessionRow(sessionId, 5L, studentId, startedAt, endedAt, peakSdi, runnerLocked);
	}

}
