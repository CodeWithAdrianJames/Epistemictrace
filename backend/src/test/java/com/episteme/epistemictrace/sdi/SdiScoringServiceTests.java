package com.episteme.epistemictrace.sdi;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import com.episteme.epistemictrace.activity.Activity;
import com.episteme.epistemictrace.activity.ActivityRepository;
import com.episteme.epistemictrace.activity.ActivityStatus;
import com.episteme.epistemictrace.activity.SdiConfig;
import com.episteme.epistemictrace.activity.SdiConfigRepository;
import com.episteme.epistemictrace.session.CodingSession;
import com.episteme.epistemictrace.session.CodingSessionRepository;
import com.episteme.epistemictrace.telemetry.EventType;
import com.episteme.epistemictrace.telemetry.StoredBatch;
import com.episteme.epistemictrace.telemetry.TelemetryEvent;
import com.episteme.epistemictrace.telemetry.TelemetryEventRepository;
import com.episteme.epistemictrace.telemetry.TelemetryEventRequest;
import com.episteme.epistemictrace.telemetry.TelemetryService;
import com.episteme.epistemictrace.user.Role;
import com.episteme.epistemictrace.user.User;
import com.episteme.epistemictrace.user.UserRepository;

/** Spec 21 Part 1: scoring through {@link TelemetryService#store} against H2, with fixed instants. */
@SpringBootTest
@ActiveProfiles("test")
class SdiScoringServiceTests {

	private static final Instant T0 = Instant.parse("2026-11-03T02:00:00Z");

	private static final SdiWeights WEIGHTS = new SdiWeights(0.20, 0.20, 0.25, 0.35);

	private static final SignalTuning TUNING = new SignalTuning(10, Duration.ofSeconds(60), 5);

	@MockitoBean
	private Clock clock;

	@Autowired
	private TelemetryService telemetryService;

	@Autowired
	private TelemetryEventRepository telemetryEventRepository;

	@Autowired
	private CodingSessionRepository codingSessionRepository;

	@Autowired
	private ActivityRepository activityRepository;

	@Autowired
	private SdiConfigRepository sdiConfigRepository;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private JdbcTemplate jdbcTemplate;

	private User student;

	private CodingSession session;

	@BeforeEach
	void createData() {
		given(this.clock.instant()).willReturn(T0.plus(Duration.ofMinutes(10)));
		User instructor = this.userRepository
			.save(new User("Instructor One", "instructor1@example.test", "not-a-real-hash", Role.INSTRUCTOR));
		this.student = this.userRepository
			.save(new User("Student One", "student1@example.test", "not-a-real-hash", Role.STUDENT));
		Activity activity = this.activityRepository.save(new Activity(instructor.getId(), "Add two numbers",
				"Read two integers and print their sum.", "", ActivityStatus.PUBLISHED));
		// A 3-minute window and threshold 50, so the tests show both come from this row.
		this.sdiConfigRepository.save(new SdiConfig(activity.getId(), 50, 600, 3));
		this.session = this.codingSessionRepository.save(new CodingSession(this.student.getId(), activity.getId(), T0));
	}

	@AfterEach
	void deleteData() {
		this.telemetryEventRepository.deleteAll();
		this.codingSessionRepository.deleteAll();
		this.activityRepository.deleteAll();
		this.userRepository.deleteAll();
	}

	@Test
	void eachNewRunIsScoredWithTheEventsBeforeIt() {
		StoredBatch batch = store(edit(0), run(10, 0), edit(15), error(20, "NameError@3"), run(20, 0));

		List<TelemetryEvent> runs = runs();
		assertThat(runs).extracting(TelemetryEvent::getSdiValue)
			.containsExactly(expected(runs.get(0)), expected(runs.get(1)));
		assertThat(runs).allSatisfy(run -> assertThat(run.getSdiValue()).isBetween(0, 100));
		assertThat(batch.struggleLevel()).isEqualTo(StruggleLevels.of(runs.get(1).getSdiValue(), 40, 50));
	}

	@Test
	void peakSdiIsTheHighestRunScore() {
		store(edit(0), run(50, 0));
		for (int i = 1; i <= 8; i++) {
			store(edit(50 + i * 10 - 2), error(50 + i * 10, "NameError@3"), run(50 + i * 10, 0));
		}

		int max = runs().stream().mapToInt(TelemetryEvent::getSdiValue).max().orElseThrow();
		assertThat(this.codingSessionRepository.findById(this.session.getId()).orElseThrow().getPeakSdi())
			.isEqualTo(max);
		assertThat(max).isGreaterThan(runs().get(0).getSdiValue());
	}

	@Test
	void theWindowAndThresholdComeFromTheActivitysSdiConfig() {
		// The first run is 4 minutes before the second: outside the 3-minute window of this activity.
		store(edit(0), run(10, 0), edit(245), run(250, 0));
		TelemetryEvent second = runs().get(1);
		int sdi = SdiEngine.compute(sdiEvents(), toSdi(second), Duration.ofMinutes(3), TUNING, WEIGHTS);
		assertThat(second.getSdiValue()).isEqualTo(sdi);
		assertThat(sdi).isNotEqualTo(
				SdiEngine.compute(sdiEvents(), toSdi(second), Duration.ofMinutes(5), TUNING, WEIGHTS));
	}

	@Test
	void anOutOfOrderRunIsScoredWithTheEventsBeforeItAndEarlierScoresStay() {
		store(edit(0), run(100, 0));
		TelemetryEvent later = runs().get(0);
		int laterScore = later.getSdiValue();

		store(edit(30), run(50, 0));

		List<TelemetryEvent> runs = runs();
		assertThat(runs.get(1).getId()).isEqualTo(later.getId());
		assertThat(runs.get(1).getSdiValue()).isEqualTo(laterScore);
		TelemetryEvent early = runs.get(0);
		assertThat(early.getSdiValue()).isEqualTo(expected(early));
	}

	@Test
	void duplicateRunsAreNotRescored() {
		TelemetryEventRequest edit = edit(0);
		TelemetryEventRequest run = run(10, 0);
		store(edit, run);
		this.jdbcTemplate.update("update telemetry_events set sdi_value = 99 where type = 'RUN'");

		StoredBatch again = store(edit, run);

		assertThat(again.duplicates()).isEqualTo(2);
		assertThat(again.struggleLevel()).isNull();
		assertThat(runs()).singleElement().extracting(TelemetryEvent::getSdiValue).isEqualTo(99);
	}

	@Test
	void aBatchWithoutRunsHasNoLevel() {
		assertThat(store(edit(0)).struggleLevel()).isNull();
		assertThat(this.codingSessionRepository.findById(this.session.getId()).orElseThrow().getPeakSdi()).isNull();
	}

	@Test
	void theLevelComesFromTheLatestRunOfTheBatch() {
		List<TelemetryEventRequest> events = new ArrayList<>();
		for (int i = 0; i < 9; i++) {
			events.add(edit(i * 10L + 5));
			events.add(error(i * 10L + 10, "NameError@3"));
			events.add(run(i * 10L + 10, 0));
		}
		// The earliest run comes last in the request; the level still follows the run with the latest occurredAt.
		events.add(run(2, 0));
		StoredBatch batch = store(events.toArray(TelemetryEventRequest[]::new));

		TelemetryEvent latest = runs().get(runs().size() - 1);
		assertThat(batch.struggleLevel()).isEqualTo(StruggleLevels.of(latest.getSdiValue(), 40, 50));
		assertThat(batch.struggleLevel()).isEqualTo(StruggleLevel.HIGH);
	}

	private StoredBatch store(TelemetryEventRequest... events) {
		return this.telemetryService.store(this.session.getId(), this.student.getId(), List.of(events));
	}

	private List<TelemetryEvent> runs() {
		return this.telemetryEventRepository.findBySessionIdOrderByOccurredAtAscIdAsc(this.session.getId())
			.stream()
			.filter(event -> event.getType() == EventType.RUN)
			.toList();
	}

	private List<SdiEvent> sdiEvents() {
		return this.telemetryEventRepository.findBySessionIdOrderByOccurredAtAscIdAsc(this.session.getId())
			.stream()
			.map(SdiScoringServiceTests::toSdi)
			.toList();
	}

	private int expected(TelemetryEvent run) {
		return SdiEngine.compute(sdiEvents(), toSdi(run), Duration.ofMinutes(3), TUNING, WEIGHTS);
	}

	private static SdiEvent toSdi(TelemetryEvent event) {
		return new SdiEvent(event.getId(), event.getType(), event.getOccurredAt(), event.getPassedCount(),
				event.getErrorSignature());
	}

	private static TelemetryEventRequest edit(long seconds) {
		return new TelemetryEventRequest(UUID.randomUUID(), EventType.EDIT, T0.plusSeconds(seconds), 2, 0, null, null,
				null, null);
	}

	private static TelemetryEventRequest error(long seconds, String signature) {
		return new TelemetryEventRequest(UUID.randomUUID(), EventType.ERROR, T0.plusSeconds(seconds), null, null, null,
				null, signature, null);
	}

	private static TelemetryEventRequest run(long seconds, int passed) {
		return new TelemetryEventRequest(UUID.randomUUID(), EventType.RUN, T0.plusSeconds(seconds), null, null, passed,
				4, null, null);
	}

}
