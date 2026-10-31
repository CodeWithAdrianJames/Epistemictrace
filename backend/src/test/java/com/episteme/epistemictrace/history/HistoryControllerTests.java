package com.episteme.epistemictrace.history;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import com.episteme.epistemictrace.activity.Activity;
import com.episteme.epistemictrace.activity.ActivityRepository;
import com.episteme.epistemictrace.activity.ActivityStatus;
import com.episteme.epistemictrace.breaker.BreakerState;
import com.episteme.epistemictrace.reflection.Reflection;
import com.episteme.epistemictrace.reflection.ReflectionRepository;
import com.episteme.epistemictrace.session.CodingSession;
import com.episteme.epistemictrace.session.CodingSessionRepository;
import com.episteme.epistemictrace.telemetry.EventType;
import com.episteme.epistemictrace.telemetry.TelemetryEvent;
import com.episteme.epistemictrace.telemetry.TelemetryEventRepository;
import com.episteme.epistemictrace.user.Role;
import com.episteme.epistemictrace.user.User;
import com.episteme.epistemictrace.user.UserRepository;

/** Spec 26: {@code GET /api/me/sessions} and {@code GET /api/me/sessions/{id}}. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class HistoryControllerTests {

	private static final Instant T0 = Instant.parse("2026-11-03T02:00:00Z");

	private static final String DENIED_DETAIL = "You don't have access to this.";

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private JwtEncoder jwtEncoder;

	@Autowired
	private ObjectMapper objectMapper;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private ActivityRepository activityRepository;

	@Autowired
	private CodingSessionRepository codingSessionRepository;

	@Autowired
	private TelemetryEventRepository telemetryEventRepository;

	@Autowired
	private ReflectionRepository reflectionRepository;

	private User instructor;

	private User student;

	private User otherStudent;

	private Activity loops;

	private Activity archived;

	@BeforeEach
	void createData() {
		this.instructor = this.userRepository
			.save(new User("Instructor One", "instructor1@example.test", "not-a-real-hash", Role.INSTRUCTOR));
		this.student = this.userRepository
			.save(new User("Student One", "student1@example.test", "not-a-real-hash", Role.STUDENT));
		this.otherStudent = this.userRepository
			.save(new User("Student Two", "student2@example.test", "not-a-real-hash", Role.STUDENT));
		this.loops = this.activityRepository.save(new Activity(this.instructor.getId(), "Loops",
				"Print 1 to 5.", "", ActivityStatus.PUBLISHED));
		this.archived = this.activityRepository.save(new Activity(this.instructor.getId(), "Old exercise",
				"Retired.", "", ActivityStatus.ARCHIVED));
	}

	@AfterEach
	void deleteData() {
		this.reflectionRepository.deleteAll();
		this.telemetryEventRepository.deleteAll();
		this.codingSessionRepository.deleteAll();
		this.activityRepository.deleteAll();
		this.userRepository.deleteAll();
	}

	@Test
	void theListHoldsOnlyTheCallersSessionsNewestFirstWithDurationsAndCounts() throws Exception {
		CodingSession older = session(this.student, this.loops, T0, T0.plusSeconds(754));
		CodingSession newer = session(this.student, this.archived, T0.plusSeconds(3600), null);
		session(this.otherStudent, this.loops, T0.plusSeconds(7200), T0.plusSeconds(7300));
		runs(older, 3);
		event(older, EventType.EDIT);
		event(older, EventType.ERROR);
		reflection(older, T0.plusSeconds(300));
		reflection(older, T0.plusSeconds(600));
		runs(newer, 1);

		JsonNode json = getJson("/api/me/sessions", this.student);

		assertThat(json.get("page").asInt()).isZero();
		assertThat(json.get("size").asInt()).isEqualTo(20);
		assertThat(json.get("totalItems").asLong()).isEqualTo(2);
		JsonNode first = json.get("items").get(0);
		assertThat(first.get("sessionId").asLong()).isEqualTo(newer.getId());
		assertThat(first.get("activityTitle").asString()).isEqualTo("Old exercise");
		assertThat(first.get("endedAt").isNull()).isTrue();
		assertThat(first.get("durationSeconds").isNull()).isTrue();
		assertThat(first.get("runCount").asLong()).isEqualTo(1);
		assertThat(first.get("reflectionCount").asLong()).isZero();
		JsonNode second = json.get("items").get(1);
		assertThat(second.get("sessionId").asLong()).isEqualTo(older.getId());
		assertThat(second.get("activityId").asLong()).isEqualTo(this.loops.getId());
		assertThat(second.get("activityTitle").asString()).isEqualTo("Loops");
		assertThat(second.get("startedAt").asString()).isEqualTo("2026-11-03T02:00:00Z");
		assertThat(second.get("endedAt").asString()).isEqualTo("2026-11-03T02:12:34Z");
		assertThat(second.get("durationSeconds").asLong()).isEqualTo(754);
		assertThat(second.get("runCount").asLong()).isEqualTo(3);
		assertThat(second.get("reflectionCount").asLong()).isEqualTo(2);
		assertThat(second.propertyNames()).containsOnly("sessionId", "activityId", "activityTitle", "startedAt",
				"endedAt", "durationSeconds", "runCount", "reflectionCount");
	}

	@Test
	void durationsAreWholeSeconds() throws Exception {
		session(this.student, this.loops, T0, T0.plusMillis(61_999));
		JsonNode item = getJson("/api/me/sessions", this.student).get("items").get(0);
		assertThat(item.get("durationSeconds").asLong()).isEqualTo(61);
	}

	@Test
	void pagesFollowPageAndSize() throws Exception {
		for (int i = 0; i < 5; i++) {
			session(this.student, this.loops, T0.plusSeconds(i * 100L), null);
		}

		JsonNode json = getJson("/api/me/sessions?page=1&size=2", this.student);

		assertThat(json.get("page").asInt()).isEqualTo(1);
		assertThat(json.get("size").asInt()).isEqualTo(2);
		assertThat(json.get("totalItems").asLong()).isEqualTo(5);
		assertThat(json.get("items")).hasSize(2);
		assertThat(json.get("items").get(0).get("startedAt").asString()).isEqualTo("2026-11-03T02:03:20Z");
		assertThat(getJson("/api/me/sessions?page=3&size=2", this.student).get("items")).isEmpty();
	}

	@Test
	void anEmptyHistoryIsAnEmptyPage() throws Exception {
		JsonNode json = getJson("/api/me/sessions", this.student);
		assertThat(json.get("items")).isEmpty();
		assertThat(json.get("totalItems").asLong()).isZero();
	}

	@Test
	void outOfRangePageOrSizeIs400() throws Exception {
		perform("/api/me/sessions?size=0", this.student).andExpect(status().isBadRequest());
		perform("/api/me/sessions?size=51", this.student).andExpect(status().isBadRequest());
		perform("/api/me/sessions?page=-1", this.student).andExpect(status().isBadRequest());
		perform("/api/me/sessions?size=50", this.student).andExpect(status().isOk());
	}

	@Test
	void theDetailAddsReflectionsInSubmissionOrder() throws Exception {
		CodingSession session = session(this.student, this.loops, T0, T0.plusSeconds(900));
		runs(session, 2);
		reflection(session, T0.plusSeconds(600));
		reflection(session, T0.plusSeconds(300));

		JsonNode json = getJson("/api/me/sessions/" + session.getId(), this.student);

		assertThat(json.get("sessionId").asLong()).isEqualTo(session.getId());
		assertThat(json.get("durationSeconds").asLong()).isEqualTo(900);
		assertThat(json.get("runCount").asLong()).isEqualTo(2);
		assertThat(json.get("reflectionCount").asLong()).isEqualTo(2);
		JsonNode reflections = json.get("reflections");
		assertThat(reflections).hasSize(2);
		assertThat(reflections.get(0).get("submittedAt").asString()).isEqualTo("2026-11-03T02:05:00Z");
		assertThat(reflections.get(0).get("hypothesis").asString()).isEqualTo("Hypothesis at 300 s, long enough.");
		assertThat(reflections.get(0).get("plannedFix").asString()).isEqualTo("Planned fix at 300 s, long enough.");
		assertThat(reflections.get(0).propertyNames()).containsOnly("hypothesis", "plannedFix", "submittedAt");
	}

	@Test
	void noResponseContainsAnSdiField() throws Exception {
		CodingSession session = session(this.student, this.loops, T0, T0.plusSeconds(900));
		session.recordSdi(91);
		session.applyBreakerState(new BreakerState(true, 91, null));
		this.codingSessionRepository.save(session);
		runs(session, 1);
		reflection(session, T0.plusSeconds(60));

		String list = perform("/api/me/sessions", this.student).andReturn().getResponse().getContentAsString();
		String detail = perform("/api/me/sessions/" + session.getId(), this.student).andReturn()
			.getResponse()
			.getContentAsString();

		assertThat(list).doesNotContainIgnoringCase("sdi").doesNotContainIgnoringCase("peak").doesNotContain("91");
		assertThat(detail).doesNotContainIgnoringCase("sdi").doesNotContainIgnoringCase("peak").doesNotContain("91");
	}

	@Test
	void anotherStudentsSessionIs403() throws Exception {
		CodingSession session = session(this.otherStudent, this.loops, T0, null);
		perform("/api/me/sessions/" + session.getId(), this.student).andExpect(status().isForbidden())
			.andExpect(jsonPath("$.detail").value(DENIED_DETAIL));
	}

	@Test
	void aMissingSessionIs404() throws Exception {
		perform("/api/me/sessions/" + Long.MAX_VALUE, this.student).andExpect(status().isNotFound())
			.andExpect(jsonPath("$.detail").value("Session not found."));
	}

	@Test
	void anInstructorIs403OnBothEndpoints() throws Exception {
		CodingSession session = session(this.student, this.loops, T0, null);
		perform("/api/me/sessions", this.instructor).andExpect(status().isForbidden());
		perform("/api/me/sessions/" + session.getId(), this.instructor).andExpect(status().isForbidden());
	}

	@Test
	void noTokenIs401() throws Exception {
		this.mockMvc.perform(get("/api/me/sessions")).andExpect(status().isUnauthorized());
	}

	private CodingSession session(User student, Activity activity, Instant startedAt, Instant endedAt) {
		CodingSession session = new CodingSession(student.getId(), activity.getId(), startedAt);
		if (endedAt != null) {
			session.end(endedAt);
		}
		return this.codingSessionRepository.save(session);
	}

	private void runs(CodingSession session, int count) {
		for (int i = 0; i < count; i++) {
			event(session, EventType.RUN);
		}
	}

	private void event(CodingSession session, EventType type) {
		TelemetryEvent event = new TelemetryEvent(session.getId(), UUID.randomUUID(), type, session.getStartedAt());
		switch (type) {
			case EDIT -> event.setCharsAdded(1);
			case ERROR -> event.setErrorSignature("NameError@1");
			case RUN -> {
				event.setPassedCount(0);
				event.setTotalCount(1);
			}
		}
		this.telemetryEventRepository.save(event);
	}

	private void reflection(CodingSession session, Instant submittedAt) {
		long seconds = submittedAt.getEpochSecond() - T0.getEpochSecond();
		this.reflectionRepository.save(new Reflection(session.getId(), "Hypothesis at " + seconds + " s, long enough.",
				"Planned fix at " + seconds + " s, long enough.", 91, submittedAt));
	}

	private JsonNode getJson(String path, User user) throws Exception {
		String body = perform(path, user).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
		return this.objectMapper.readTree(body);
	}

	private ResultActions perform(String path, User user) throws Exception {
		return this.mockMvc.perform(get(path).header(HttpHeaders.ACCEPT, "application/json, application/problem+json")
			.header(HttpHeaders.AUTHORIZATION, "Bearer " + token(user)));
	}

	private String token(User user) {
		Instant now = Instant.now();
		JwtClaimsSet claims = JwtClaimsSet.builder()
			.subject(String.valueOf(user.getId()))
			.claim("role", user.getRole().name())
			.claim("email", user.getEmail())
			.issuedAt(now)
			.expiresAt(now.plus(5, ChronoUnit.MINUTES))
			.build();
		return this.jwtEncoder.encode(JwtEncoderParameters.from(claims)).getTokenValue();
	}

}
