package com.episteme.epistemictrace.reflection;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import com.episteme.epistemictrace.activity.Activity;
import com.episteme.epistemictrace.activity.ActivityRepository;
import com.episteme.epistemictrace.activity.ActivityStatus;
import com.episteme.epistemictrace.activity.SdiConfig;
import com.episteme.epistemictrace.activity.SdiConfigRepository;
import com.episteme.epistemictrace.breaker.BreakerState;
import com.episteme.epistemictrace.breaker.BreakerView.Status;
import com.episteme.epistemictrace.session.CodingSession;
import com.episteme.epistemictrace.session.CodingSessionRepository;
import com.episteme.epistemictrace.session.SessionNotFoundException;
import com.episteme.epistemictrace.user.Role;
import com.episteme.epistemictrace.user.User;
import com.episteme.epistemictrace.user.UserRepository;

/** Spec 24 Part 1: {@link ReflectionService} against H2 with a fixed clock (min 20, max 2000, cooldown 600 s). */
@SpringBootTest
@ActiveProfiles("test")
class ReflectionServiceTests {

	private static final Instant NOW = Instant.parse("2026-11-03T02:30:00Z");

	private static final String VALID = "The loop never stops at n.";

	@MockitoBean
	private Clock clock;

	@Autowired
	private ReflectionService reflectionService;

	@Autowired
	private ReflectionRepository reflectionRepository;

	@Autowired
	private CodingSessionRepository codingSessionRepository;

	@Autowired
	private ActivityRepository activityRepository;

	@Autowired
	private SdiConfigRepository sdiConfigRepository;

	@Autowired
	private UserRepository userRepository;

	private User student;

	private User otherStudent;

	private CodingSession session;

	@BeforeEach
	void createData() {
		given(this.clock.instant()).willReturn(NOW);
		User instructor = this.userRepository
			.save(new User("Instructor One", "instructor1@example.test", "not-a-real-hash", Role.INSTRUCTOR));
		this.student = this.userRepository
			.save(new User("Student One", "student1@example.test", "not-a-real-hash", Role.STUDENT));
		this.otherStudent = this.userRepository
			.save(new User("Student Two", "student2@example.test", "not-a-real-hash", Role.STUDENT));
		Activity activity = this.activityRepository.save(new Activity(instructor.getId(), "Add two numbers",
				"Read two integers and print their sum.", "", ActivityStatus.PUBLISHED));
		this.sdiConfigRepository.save(new SdiConfig(activity.getId(), 70, 600, 5));
		CodingSession created = new CodingSession(this.student.getId(), activity.getId(), NOW.minusSeconds(900));
		created.applyBreakerState(new BreakerState(true, 84, null));
		this.session = this.codingSessionRepository.save(created);
	}

	@AfterEach
	void deleteData() {
		this.reflectionRepository.deleteAll();
		this.codingSessionRepository.deleteAll();
		this.activityRepository.deleteAll();
		this.userRepository.deleteAll();
	}

	@Test
	void aValidReflectionIsSavedWithTheSdiAtLockAndStartsTheCooldown() {
		ReflectionResponse response = submit("  " + VALID + "  ", "Print i before the check.");

		Reflection saved = this.reflectionRepository.findById(response.reflectionId()).orElseThrow();
		assertThat(saved.getSessionId()).isEqualTo(this.session.getId());
		assertThat(saved.getHypothesis()).isEqualTo(VALID);
		assertThat(saved.getPlannedFix()).isEqualTo("Print i before the check.");
		assertThat(saved.getSdiAtTrigger()).isEqualTo(84);
		assertThat(saved.getSubmittedAt()).isEqualTo(NOW);
		assertThat(response.submittedAt()).isEqualTo(NOW);

		assertThat(response.breaker().state()).isEqualTo(Status.COOLDOWN);
		assertThat(response.breaker().cooldownEndsAt()).isEqualTo(NOW.plus(Duration.ofSeconds(600)));
		assertThat(response.breaker().reflectionMinLength()).isEqualTo(20);
		CodingSession stored = this.codingSessionRepository.findById(this.session.getId()).orElseThrow();
		assertThat(stored.breakerState()).isEqualTo(new BreakerState(false, null, NOW.plusSeconds(600)));
	}

	@Test
	void aSessionThatIsNotLockedIs409AndStoresNothing() {
		submit(VALID, VALID);

		assertThatThrownBy(() -> submit(VALID, VALID)).isInstanceOf(RunnerNotLockedException.class);
		assertThat(this.reflectionRepository.count()).isEqualTo(1);
	}

	@Test
	void twoConcurrentSubmitsStoreOneReflection() throws Exception {
		ExecutorService executor = Executors.newFixedThreadPool(2);
		try {
			CountDownLatch start = new CountDownLatch(1);
			Callable<Object> attempt = () -> {
				start.await();
				try {
					return submit(VALID, VALID);
				}
				catch (RunnerNotLockedException ex) {
					return ex;
				}
			};
			Future<Object> first = executor.submit(attempt);
			Future<Object> second = executor.submit(attempt);
			start.countDown();

			List<Object> results = List.of(first.get(10, TimeUnit.SECONDS), second.get(10, TimeUnit.SECONDS));

			assertThat(results).filteredOn(ReflectionResponse.class::isInstance).hasSize(1);
			assertThat(results).filteredOn(RunnerNotLockedException.class::isInstance).hasSize(1);
			assertThat(this.reflectionRepository.count()).isEqualTo(1);
		}
		finally {
			executor.shutdownNow();
		}
	}

	@Test
	void lengthsAreCheckedAfterTrimmingAtTheMinimumAndMaximum() {
		String min = "x".repeat(20);
		String max = "y".repeat(2000);
		assertThat(submit("  " + min + "  ", max).reflectionId()).isPositive();
	}

	@Test
	void tooShortOrTooLongFieldsAre400WithFieldErrors() {
		assertThat(errors("x".repeat(19), VALID)).isEqualTo(Map.of("hypothesis", "Write at least 20 characters."));
		assertThat(errors(VALID, "y".repeat(2001))).isEqualTo(Map.of("plannedFix", "Write at most 2000 characters."));
		assertThat(errors(null, "   ")).isEqualTo(Map.of("hypothesis", "Write at least 20 characters.", "plannedFix",
				"Write at least 20 characters."));
		assertThat(this.reflectionRepository.count()).isZero();
		assertThat(this.codingSessionRepository.findById(this.session.getId()).orElseThrow().isRunnerLocked()).isTrue();
	}

	@Test
	void whitespaceOnlyTextIsRejected() {
		assertThat(errors(" ".repeat(40), "\t\n".repeat(20))).containsOnlyKeys("hypothesis", "plannedFix");
	}

	@Test
	void theDetailNamesTheMinimum() {
		InvalidReflectionException ex = catchInvalid("short", VALID);
		assertThat(ex.getBody().getDetail()).isEqualTo("Write at least 20 characters.");
	}

	@Test
	void anotherStudentsSessionIs403() {
		assertThatThrownBy(() -> this.reflectionService.submit(this.session.getId(), this.otherStudent.getId(),
				new ReflectionRequest(VALID, VALID)))
			.isInstanceOf(AccessDeniedException.class);
		assertThat(this.reflectionRepository.count()).isZero();
	}

	@Test
	void aMissingSessionIs404() {
		assertThatThrownBy(() -> this.reflectionService.submit(Long.MAX_VALUE, this.student.getId(),
				new ReflectionRequest(VALID, VALID)))
			.isInstanceOf(SessionNotFoundException.class);
	}

	private ReflectionResponse submit(String hypothesis, String plannedFix) {
		return this.reflectionService.submit(this.session.getId(), this.student.getId(),
				new ReflectionRequest(hypothesis, plannedFix));
	}

	@SuppressWarnings("unchecked")
	private Map<String, String> errors(String hypothesis, String plannedFix) {
		return (Map<String, String>) catchInvalid(hypothesis, plannedFix).getBody().getProperties().get("errors");
	}

	private InvalidReflectionException catchInvalid(String hypothesis, String plannedFix) {
		try {
			submit(hypothesis, plannedFix);
		}
		catch (InvalidReflectionException ex) {
			return ex;
		}
		throw new AssertionError("Expected InvalidReflectionException");
	}

}
