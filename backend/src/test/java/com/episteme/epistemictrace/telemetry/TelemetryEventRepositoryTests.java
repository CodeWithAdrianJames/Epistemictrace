package com.episteme.epistemictrace.telemetry;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.ActiveProfiles;

import com.episteme.epistemictrace.activity.Activity;
import com.episteme.epistemictrace.activity.ActivityStatus;
import com.episteme.epistemictrace.session.CodingSession;
import com.episteme.epistemictrace.user.Role;
import com.episteme.epistemictrace.user.User;

// Keep the H2 PostgreSQL-mode datasource from application-test.properties so Flyway's migrations run
// and Hibernate validates against them, instead of letting @DataJpaTest swap in a plain embedded database.
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
class TelemetryEventRepositoryTests {

	private static final Instant OCCURRED_AT = Instant.parse("2026-10-29T10:15:30Z");

	@Autowired
	private TelemetryEventRepository telemetryEventRepository;

	@Autowired
	private TestEntityManager entityManager;

	private Long sessionId;

	@BeforeEach
	void createSession() {
		Long instructorId = this.entityManager
			.persistAndGetId(new User("Instructor One", "instructor1@example.test", "fake-hash", Role.INSTRUCTOR),
					Long.class);
		Long studentId = this.entityManager
			.persistAndGetId(new User("Student One", "student1@example.test", "fake-hash", Role.STUDENT), Long.class);
		Long activityId = this.entityManager.persistAndGetId(new Activity(instructorId, "Add two numbers",
				"Read two integers and print their sum.", "", ActivityStatus.PUBLISHED), Long.class);
		this.sessionId = this.entityManager.persistAndGetId(new CodingSession(studentId, activityId, OCCURRED_AT),
				Long.class);
	}

	@Test
	void savedEventReloadsWithClientEventId() {
		UUID clientEventId = UUID.randomUUID();
		TelemetryEvent event = new TelemetryEvent(this.sessionId, clientEventId, EventType.RUN, OCCURRED_AT);
		event.setPassedCount(1);
		event.setTotalCount(2);
		event.setSdiValue(42);
		Long eventId = this.telemetryEventRepository.saveAndFlush(event).getId();
		this.entityManager.clear();

		TelemetryEvent reloaded = this.telemetryEventRepository.findById(eventId).orElseThrow();
		assertThat(reloaded.getSessionId()).isEqualTo(this.sessionId);
		assertThat(reloaded.getClientEventId()).isEqualTo(clientEventId);
		assertThat(reloaded.getType()).isEqualTo(EventType.RUN);
		assertThat(reloaded.getOccurredAt()).isEqualTo(OCCURRED_AT);
		assertThat(reloaded.getPassedCount()).isEqualTo(1);
		assertThat(reloaded.getTotalCount()).isEqualTo(2);
		assertThat(reloaded.getSdiValue()).isEqualTo(42);
	}

	@Test
	void duplicateClientEventIdInSameSessionThrows() {
		UUID clientEventId = UUID.randomUUID();
		this.telemetryEventRepository
			.saveAndFlush(new TelemetryEvent(this.sessionId, clientEventId, EventType.EDIT, OCCURRED_AT));

		assertThatThrownBy(() -> this.telemetryEventRepository
			.saveAndFlush(new TelemetryEvent(this.sessionId, clientEventId, EventType.EDIT, OCCURRED_AT)))
			.isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	void sdiValueAbove100Throws() {
		TelemetryEvent event = new TelemetryEvent(this.sessionId, UUID.randomUUID(), EventType.RUN, OCCURRED_AT);
		event.setSdiValue(150);

		assertThatThrownBy(() -> this.telemetryEventRepository.saveAndFlush(event))
			.isInstanceOf(DataIntegrityViolationException.class);
	}

}
