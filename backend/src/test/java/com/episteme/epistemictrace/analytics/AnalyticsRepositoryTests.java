package com.episteme.epistemictrace.analytics;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;
import org.springframework.test.context.ActiveProfiles;

import com.episteme.epistemictrace.activity.Activity;
import com.episteme.epistemictrace.activity.ActivityStatus;
import com.episteme.epistemictrace.activity.SdiConfig;
import com.episteme.epistemictrace.breaker.BreakerState;
import com.episteme.epistemictrace.reflection.Reflection;
import com.episteme.epistemictrace.session.CodingSession;
import com.episteme.epistemictrace.telemetry.EventType;
import com.episteme.epistemictrace.telemetry.TelemetryEvent;
import com.episteme.epistemictrace.user.Role;
import com.episteme.epistemictrace.user.User;

// Keep the H2 PostgreSQL-mode datasource from application-test.properties so Flyway's migrations run
// and Hibernate validates against them, instead of letting @DataJpaTest swap in a plain embedded database.
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
class AnalyticsRepositoryTests {

	private static final Instant START = Instant.parse("2026-10-29T10:00:00Z");

	@Autowired
	private AnalyticsRepository analyticsRepository;

	@Autowired
	private TestEntityManager entityManager;

	private Long studentOneId;

	private Long studentTwoId;

	private Long activityId;

	private Long otherActivityId;

	private Long sessionOneId;

	private Long sessionTwoId;

	private Long otherSessionId;

	@BeforeEach
	void seed() {
		Long instructorId = persistUser("Instructor One", "instructor1@example.test", Role.INSTRUCTOR);
		this.studentOneId = persistUser("Student One", "student1@example.test", Role.STUDENT);
		this.studentTwoId = persistUser("Student Two", "student2@example.test", Role.STUDENT);
		this.activityId = persistActivity(instructorId, "Add two numbers", 70);
		this.otherActivityId = persistActivity(instructorId, "Reverse a string", 55);

		CodingSession one = new CodingSession(this.studentOneId, this.activityId, START);
		one.end(START.plusSeconds(20));
		one.recordSdi(93);
		this.sessionOneId = this.entityManager.persistAndGetId(one, Long.class);

		CodingSession two = new CodingSession(this.studentTwoId, this.activityId, START.plusSeconds(100));
		two.recordSdi(77);
		two.applyBreakerState(new BreakerState(true, 77, null));
		this.sessionTwoId = this.entityManager.persistAndGetId(two, Long.class);

		CodingSession other = new CodingSession(this.studentOneId, this.otherActivityId, START);
		other.recordSdi(10);
		this.otherSessionId = this.entityManager.persistAndGetId(other, Long.class);

		persistEvent(this.sessionOneId, EventType.EDIT, START.plusSeconds(1));
		persistEvent(this.sessionOneId, EventType.RUN, START.plusSeconds(5));
		persistEvent(this.sessionOneId, EventType.ERROR, START.plusSeconds(5));
		persistEvent(this.sessionOneId, EventType.RUN, START.plusSeconds(18));
		persistEvent(this.sessionTwoId, EventType.EDIT, START.plusSeconds(110));
		persistEvent(this.otherSessionId, EventType.RUN, START.plusSeconds(3));
		persistEvent(this.otherSessionId, EventType.RUN, START.plusSeconds(4));

		this.entityManager.persist(new Reflection(this.sessionOneId, "I repeated the same syntax mistake.",
				"I will trace the code by hand first.", 77, START.plusSeconds(19)));
		this.entityManager.persist(new Reflection(this.sessionOneId, "I misread the error message twice.",
				"I will read the error before editing.", 85, START.plusSeconds(19)));
		this.entityManager.persist(new Reflection(this.otherSessionId, "Another activity reflection text.",
				"Another activity planned fix text.", 60, START.plusSeconds(10)));
		this.entityManager.flush();
		this.entityManager.clear();
	}

	@Test
	void findSessionRowsReturnsOnlyTheGivenActivitiesWithTheirFields() {
		List<AnalyticsSessionRow> rows = this.analyticsRepository.findSessionRows(List.of(this.activityId));

		assertThat(rows).containsExactly(
				new AnalyticsSessionRow(this.sessionOneId, this.activityId, this.studentOneId, START,
						START.plusSeconds(20), 93, false),
				new AnalyticsSessionRow(this.sessionTwoId, this.activityId, this.studentTwoId, START.plusSeconds(100),
						null, 77, true));
	}

	@Test
	void findSessionRowsCoversSeveralActivitiesAtOnce() {
		assertThat(this.analyticsRepository.findSessionRows(List.of(this.activityId, this.otherActivityId)))
			.extracting(AnalyticsSessionRow::sessionId)
			.containsExactly(this.sessionOneId, this.sessionTwoId, this.otherSessionId);
	}

	@Test
	void countEventsCountsOnlyRunsAndKeepsTheLatestEventOfAnyType() {
		List<SessionEventTotals> totals = this.analyticsRepository.countEvents(List.of(this.activityId),
				EventType.RUN);

		assertThat(totals).containsExactlyInAnyOrder(
				new SessionEventTotals(this.sessionOneId, 2L, START.plusSeconds(18)),
				new SessionEventTotals(this.sessionTwoId, 0L, START.plusSeconds(110)));
	}

	@Test
	void countEventsOmitsSessionsWithoutEventsAndOtherActivities() {
		CodingSession silent = new CodingSession(this.studentTwoId, this.activityId, START.plusSeconds(500));
		Long silentId = this.entityManager.persistAndGetId(silent, Long.class);
		this.entityManager.flush();
		this.entityManager.clear();

		List<SessionEventTotals> totals = this.analyticsRepository.countEvents(List.of(this.activityId),
				EventType.RUN);

		assertThat(totals).extracting(SessionEventTotals::sessionId)
			.containsExactlyInAnyOrder(this.sessionOneId, this.sessionTwoId)
			.doesNotContain(silentId, this.otherSessionId);
	}

	@Test
	void countReflectionsGroupsPerSessionOfTheGivenActivities() {
		assertThat(this.analyticsRepository.countReflections(List.of(this.activityId)))
			.containsExactly(new SessionReflectionCount(this.sessionOneId, 2L));
		assertThat(this.analyticsRepository.countReflections(List.of(this.activityId, this.otherActivityId)))
			.containsExactlyInAnyOrder(new SessionReflectionCount(this.sessionOneId, 2L),
					new SessionReflectionCount(this.otherSessionId, 1L));
	}

	@Test
	void findStudentIdentitiesReturnsNameAndEmailOfTheGivenUsers() {
		assertThat(this.analyticsRepository.findStudentIdentities(List.of(this.studentOneId, this.studentTwoId)))
			.containsExactlyInAnyOrder(new StudentIdentity(this.studentOneId, "Student One", "student1@example.test"),
					new StudentIdentity(this.studentTwoId, "Student Two", "student2@example.test"));
		assertThat(this.analyticsRepository.findStudentIdentities(List.of(this.studentTwoId)))
			.extracting(StudentIdentity::studentId)
			.containsExactly(this.studentTwoId);
	}

	@Test
	void findThresholdsReturnsEachActivitysOwnThreshold() {
		assertThat(this.analyticsRepository.findThresholds(List.of(this.activityId, this.otherActivityId)))
			.containsExactlyInAnyOrder(new ActivityThreshold(this.activityId, 70),
					new ActivityThreshold(this.otherActivityId, 55));
	}

	@Test
	void queriesWithNoActivitiesReturnNothing() {
		assertThat(this.analyticsRepository.findSessionRows(List.of())).isEmpty();
		assertThat(this.analyticsRepository.countEvents(List.of(), EventType.RUN)).isEmpty();
		assertThat(this.analyticsRepository.countReflections(List.of())).isEmpty();
		assertThat(this.analyticsRepository.findStudentIdentities(List.of())).isEmpty();
		assertThat(this.analyticsRepository.findThresholds(List.of())).isEmpty();
	}

	@Test
	void queriesFeedTheCalculatorEndToEnd() {
		List<Long> activityIds = List.of(this.activityId);
		List<AnalyticsSessionRow> sessions = this.analyticsRepository.findSessionRows(activityIds);
		List<StudentIdentity> identities = this.analyticsRepository
			.findStudentIdentities(sessions.stream().map(AnalyticsSessionRow::studentId).distinct().toList());
		int threshold = this.analyticsRepository.findThresholds(activityIds).get(0).threshold();

		List<StudentAnalytics> students = AnalyticsCalculator.students(sessions,
				this.analyticsRepository.countEvents(activityIds, EventType.RUN),
				this.analyticsRepository.countReflections(activityIds), identities, 40, threshold);

		assertThat(students).extracting(StudentAnalytics::studentId)
			.containsExactly(this.studentOneId, this.studentTwoId);
		assertThat(students.get(0)).satisfies(row -> {
			assertThat(row.runCount()).isEqualTo(2);
			assertThat(row.sessionSeconds()).isEqualTo(20);
			assertThat(row.peakSdi()).isEqualTo(93);
			assertThat(row.breakerTriggerCount()).isEqualTo(2);
		});
		assertThat(students.get(1)).satisfies(row -> {
			assertThat(row.runCount()).isZero();
			assertThat(row.breakerTriggerCount()).isEqualTo(1);
			assertThat(row.lastActiveAt()).isEqualTo(START.plusSeconds(110));
		});
	}

	private Long persistUser(String name, String email, Role role) {
		return this.entityManager.persistAndGetId(new User(name, email, "fake-hash", role), Long.class);
	}

	private Long persistActivity(Long instructorId, String title, int threshold) {
		Long id = this.entityManager.persistAndGetId(
				new Activity(instructorId, title, "Fake problem statement.", "", ActivityStatus.PUBLISHED), Long.class);
		this.entityManager.persist(new SdiConfig(id, threshold, 600, 5));
		return id;
	}

	private void persistEvent(Long sessionId, EventType type, Instant occurredAt) {
		TelemetryEvent event = new TelemetryEvent(sessionId, UUID.randomUUID(), type, occurredAt);
		switch (type) {
			case EDIT -> {
				event.setCharsAdded(3);
				event.setCharsRemoved(0);
			}
			case RUN -> {
				event.setPassedCount(0);
				event.setTotalCount(2);
			}
			case ERROR -> event.setErrorSignature("SyntaxError@3");
		}
		this.entityManager.persist(event);
	}

}
