package com.episteme.epistemictrace.session;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import com.episteme.epistemictrace.activity.Activity;
import com.episteme.epistemictrace.activity.ActivityNotFoundException;
import com.episteme.epistemictrace.activity.ActivityRepository;
import com.episteme.epistemictrace.activity.ActivityStatus;
import com.episteme.epistemictrace.auth.UnknownTokenUserException;
import com.episteme.epistemictrace.user.Role;
import com.episteme.epistemictrace.user.User;
import com.episteme.epistemictrace.user.UserRepository;

/** Spec 16 Part 1: start/resume, end and ownership rules with a fixed {@link Clock}. */
@SpringBootTest
@ActiveProfiles("test")
class SessionServiceTests {

	private static final Instant NOW = Instant.parse("2026-10-31T10:00:00Z");

	private static final Instant CONSENTED_AT = Instant.parse("2026-10-30T09:00:00Z");

	@MockitoBean
	private Clock clock;

	@Autowired
	private SessionService sessionService;

	@Autowired
	private SessionProperties sessionProperties;

	@Autowired
	private CodingSessionRepository codingSessionRepository;

	@Autowired
	private ActivityRepository activityRepository;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private JdbcTemplate jdbcTemplate;

	private User student;

	private User otherStudent;

	private Activity activity;

	@BeforeEach
	void createData() {
		given(this.clock.instant()).willReturn(NOW);
		User instructor = this.userRepository
			.save(new User("Instructor One", "instructor1@example.test", "not-a-real-hash", Role.INSTRUCTOR));
		this.student = consentingStudent("Student One", "student1@example.test");
		this.otherStudent = consentingStudent("Student Two", "student2@example.test");
		this.activity = saveActivity(instructor, "Add two numbers", ActivityStatus.PUBLISHED);
	}

	@AfterEach
	void deleteData() {
		this.codingSessionRepository.deleteAll();
		this.activityRepository.deleteAll();
		this.userRepository.deleteAll();
	}

	@Test
	void defaultResumeWindowIsThirtyMinutes() {
		assertThat(this.sessionProperties.resumeWindow()).isEqualTo(Duration.ofMinutes(30));
	}

	// start

	@Test
	void startCreatesANewSessionWhenTheStudentHasNone() {
		SessionStart start = this.sessionService.start(this.student.getId(), this.activity.getId());

		assertThat(start.resumed()).isFalse();
		CodingSession stored = stored(start.session().getId());
		assertThat(stored.getStudentId()).isEqualTo(this.student.getId());
		assertThat(stored.getActivityId()).isEqualTo(this.activity.getId());
		assertThat(stored.getStartedAt()).isEqualTo(NOW);
		assertThat(stored.getEndedAt()).isNull();
		assertThat(this.codingSessionRepository.count()).isEqualTo(1);
	}

	@Test
	void startResumesAnOpenSession() {
		CodingSession open = saveSession(this.student, this.activity, NOW.minus(Duration.ofHours(3)), null);

		SessionStart start = this.sessionService.start(this.student.getId(), this.activity.getId());

		assertThat(start.resumed()).isTrue();
		assertThat(start.session().getId()).isEqualTo(open.getId());
		assertThat(start.session().getStartedAt()).isEqualTo(NOW.minus(Duration.ofHours(3)));
		assertThat(stored(open.getId()).getEndedAt()).isNull();
		assertThat(this.codingSessionRepository.count()).isEqualTo(1);
	}

	@Test
	void startResumesASessionThatEndedWithinTheWindowAndClearsItsEnd() {
		CodingSession recent = saveSession(this.student, this.activity, NOW.minus(Duration.ofHours(1)),
				NOW.minus(Duration.ofMinutes(10)));

		SessionStart start = this.sessionService.start(this.student.getId(), this.activity.getId());

		assertThat(start.resumed()).isTrue();
		assertThat(start.session().getId()).isEqualTo(recent.getId());
		assertThat(stored(recent.getId()).getEndedAt()).isNull();
		assertThat(this.codingSessionRepository.count()).isEqualTo(1);
	}

	@Test
	void startResumesASessionThatEndedExactlyOneWindowAgo() {
		CodingSession boundary = saveSession(this.student, this.activity, NOW.minus(Duration.ofHours(1)),
				NOW.minus(Duration.ofMinutes(30)));

		SessionStart start = this.sessionService.start(this.student.getId(), this.activity.getId());

		assertThat(start.resumed()).isTrue();
		assertThat(start.session().getId()).isEqualTo(boundary.getId());
		assertThat(stored(boundary.getId()).getEndedAt()).isNull();
	}

	@Test
	void startCreatesANewSessionWhenTheLatestEndedOutsideTheWindow() {
		Instant oldEnd = NOW.minus(Duration.ofMinutes(31));
		CodingSession old = saveSession(this.student, this.activity, NOW.minus(Duration.ofHours(1)), oldEnd);

		SessionStart start = this.sessionService.start(this.student.getId(), this.activity.getId());

		assertThat(start.resumed()).isFalse();
		assertThat(start.session().getId()).isNotEqualTo(old.getId());
		assertThat(stored(start.session().getId()).getStartedAt()).isEqualTo(NOW);
		assertThat(stored(old.getId()).getEndedAt()).isEqualTo(oldEnd);
		assertThat(this.codingSessionRepository.count()).isEqualTo(2);
	}

	@Test
	void startLooksOnlyAtTheLatestSessionByStartedAt() {
		CodingSession olderOpen = saveSession(this.student, this.activity, NOW.minus(Duration.ofHours(5)), null);
		saveSession(this.student, this.activity, NOW.minus(Duration.ofHours(2)), NOW.minus(Duration.ofHours(1)));

		SessionStart start = this.sessionService.start(this.student.getId(), this.activity.getId());

		assertThat(start.resumed()).isFalse();
		assertThat(start.session().getId()).isNotEqualTo(olderOpen.getId());
		assertThat(this.codingSessionRepository.count()).isEqualTo(3);
	}

	@Test
	void startIgnoresSessionsOfOtherStudents() {
		CodingSession others = saveSession(this.otherStudent, this.activity, NOW.minus(Duration.ofMinutes(5)), null);

		SessionStart start = this.sessionService.start(this.student.getId(), this.activity.getId());

		assertThat(start.resumed()).isFalse();
		assertThat(start.session().getId()).isNotEqualTo(others.getId());
		assertThat(start.session().getStudentId()).isEqualTo(this.student.getId());
	}

	@Test
	void startIgnoresSessionsOfOtherActivities() {
		Activity other = saveActivity(this.userRepository.findById(this.activity.getInstructorId()).orElseThrow(),
				"Reverse a string", ActivityStatus.PUBLISHED);
		CodingSession elsewhere = saveSession(this.student, other, NOW.minus(Duration.ofMinutes(5)), null);

		SessionStart start = this.sessionService.start(this.student.getId(), this.activity.getId());

		assertThat(start.resumed()).isFalse();
		assertThat(start.session().getId()).isNotEqualTo(elsewhere.getId());
		assertThat(start.session().getActivityId()).isEqualTo(this.activity.getId());
		assertThat(stored(elsewhere.getId()).getEndedAt()).isNull();
	}

	@Test
	void startWithoutConsentThrowsAndCreatesNothing() {
		User noConsent = this.userRepository
			.save(new User("Student Three", "student3@example.test", "not-a-real-hash", Role.STUDENT));

		assertThatThrownBy(() -> this.sessionService.start(noConsent.getId(), this.activity.getId()))
			.isInstanceOf(ConsentRequiredException.class)
			.hasMessageContaining(ConsentRequiredException.DETAIL);
		assertThat(this.codingSessionRepository.count()).isZero();
	}

	@Test
	void startOnADraftOrArchivedActivityThrowsNotFound() {
		User instructor = this.userRepository.findById(this.activity.getInstructorId()).orElseThrow();
		Activity draft = saveActivity(instructor, "A draft", ActivityStatus.DRAFT);
		Activity archived = saveActivity(instructor, "An archived one", ActivityStatus.ARCHIVED);

		assertThatThrownBy(() -> this.sessionService.start(this.student.getId(), draft.getId()))
			.isInstanceOf(ActivityNotFoundException.class);
		assertThatThrownBy(() -> this.sessionService.start(this.student.getId(), archived.getId()))
			.isInstanceOf(ActivityNotFoundException.class);
		assertThat(this.codingSessionRepository.count()).isZero();
	}

	@Test
	void startOnAMissingActivityThrowsNotFound() {
		long missingId = this.activity.getId() + 1000;

		assertThatThrownBy(() -> this.sessionService.start(this.student.getId(), missingId))
			.isInstanceOf(ActivityNotFoundException.class);
		assertThat(this.codingSessionRepository.count()).isZero();
	}

	@Test
	void startForAnUnknownStudentThrowsUnauthorized() {
		long missingId = this.otherStudent.getId() + 1000;

		assertThatThrownBy(() -> this.sessionService.start(missingId, this.activity.getId()))
			.isInstanceOf(UnknownTokenUserException.class);
		assertThat(this.codingSessionRepository.count()).isZero();
	}

	// end

	@Test
	void endSetsEndedAtToNow() {
		CodingSession open = saveSession(this.student, this.activity, NOW.minus(Duration.ofHours(1)), null);

		this.sessionService.end(open.getId(), this.student.getId());

		assertThat(stored(open.getId()).getEndedAt()).isEqualTo(NOW);
	}

	@Test
	void endOverwritesAnEarlierEnd() {
		CodingSession ended = saveSession(this.student, this.activity, NOW.minus(Duration.ofHours(2)),
				NOW.minus(Duration.ofHours(1)));

		this.sessionService.end(ended.getId(), this.student.getId());

		assertThat(stored(ended.getId()).getEndedAt()).isEqualTo(NOW);
	}

	@Test
	void endThenStartWithinTheWindowResumesTheSameSession() {
		CodingSession open = saveSession(this.student, this.activity, NOW.minus(Duration.ofHours(1)), null);
		this.sessionService.end(open.getId(), this.student.getId());
		given(this.clock.instant()).willReturn(NOW.plus(Duration.ofMinutes(30)));

		SessionStart start = this.sessionService.start(this.student.getId(), this.activity.getId());

		assertThat(start.resumed()).isTrue();
		assertThat(start.session().getId()).isEqualTo(open.getId());
	}

	@Test
	void endThenStartAfterTheWindowCreatesANewSession() {
		CodingSession open = saveSession(this.student, this.activity, NOW.minus(Duration.ofHours(1)), null);
		this.sessionService.end(open.getId(), this.student.getId());
		Instant later = NOW.plus(Duration.ofMinutes(31));
		given(this.clock.instant()).willReturn(later);

		SessionStart start = this.sessionService.start(this.student.getId(), this.activity.getId());

		assertThat(start.resumed()).isFalse();
		assertThat(start.session().getId()).isNotEqualTo(open.getId());
		assertThat(stored(start.session().getId()).getStartedAt()).isEqualTo(later);
		assertThat(stored(open.getId()).getEndedAt()).isEqualTo(NOW);
	}

	@Test
	void endOfAnotherStudentsSessionThrowsAccessDeniedAndChangesNothing() {
		CodingSession others = saveSession(this.otherStudent, this.activity, NOW.minus(Duration.ofHours(1)), null);

		assertThatThrownBy(() -> this.sessionService.end(others.getId(), this.student.getId()))
			.isInstanceOf(AccessDeniedException.class);
		assertThat(stored(others.getId()).getEndedAt()).isNull();
	}

	@Test
	void endOfAMissingSessionThrowsNotFound() {
		assertThatThrownBy(() -> this.sessionService.end(Long.MAX_VALUE, this.student.getId()))
			.isInstanceOf(SessionNotFoundException.class);
	}

	// requireOwnedSession

	@Test
	void requireOwnedSessionReturnsTheStudentsSession() {
		CodingSession own = saveSession(this.student, this.activity, NOW.minus(Duration.ofHours(1)), null);

		CodingSession found = this.sessionService.requireOwnedSession(own.getId(), this.student.getId());

		assertThat(found.getId()).isEqualTo(own.getId());
		assertThat(found.getStudentId()).isEqualTo(this.student.getId());
	}

	@Test
	void requireOwnedSessionThrowsNotFoundForAMissingSession() {
		assertThatThrownBy(() -> this.sessionService.requireOwnedSession(Long.MAX_VALUE, this.student.getId()))
			.isInstanceOf(SessionNotFoundException.class);
	}

	@Test
	void requireOwnedSessionThrowsAccessDeniedForAnotherStudentsSession() {
		CodingSession others = saveSession(this.otherStudent, this.activity, NOW.minus(Duration.ofHours(1)), null);

		assertThatThrownBy(() -> this.sessionService.requireOwnedSession(others.getId(), this.student.getId()))
			.isInstanceOf(AccessDeniedException.class);
	}

	private User consentingStudent(String name, String email) {
		User user = this.userRepository.save(new User(name, email, "not-a-real-hash", Role.STUDENT));
		this.jdbcTemplate.update("update users set consent_accepted_at = ? where id = ?", Timestamp.from(CONSENTED_AT),
				user.getId());
		return user;
	}

	private Activity saveActivity(User instructor, String title, ActivityStatus status) {
		return this.activityRepository.save(new Activity(instructor.getId(), title,
				"Read two integers and print their sum.", "", status));
	}

	private CodingSession saveSession(User student, Activity activity, Instant startedAt, Instant endedAt) {
		CodingSession session = new CodingSession(student.getId(), activity.getId(), startedAt);
		if (endedAt != null) {
			session.end(endedAt);
		}
		return this.codingSessionRepository.save(session);
	}

	private CodingSession stored(long sessionId) {
		return this.codingSessionRepository.findById(sessionId).orElseThrow();
	}

}
