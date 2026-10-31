package com.episteme.epistemictrace.telemetry;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import com.episteme.epistemictrace.activity.Activity;
import com.episteme.epistemictrace.activity.ActivityRepository;
import com.episteme.epistemictrace.activity.ActivityStatus;
import com.episteme.epistemictrace.activity.SdiConfig;
import com.episteme.epistemictrace.activity.SdiConfigRepository;
import com.episteme.epistemictrace.session.CodingSession;
import com.episteme.epistemictrace.session.CodingSessionRepository;
import com.episteme.epistemictrace.user.Role;
import com.episteme.epistemictrace.user.User;
import com.episteme.epistemictrace.user.UserRepository;

/** Spec 18 Part 2: {@code POST /api/sessions/{id}/events}. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class TelemetryControllerTests {

	private static final String DENIED_DETAIL = "You don't have access to this.";

	private static final Instant STARTED_AT = Instant.parse("2026-11-03T02:00:00Z");

	private static final Instant NOW = STARTED_AT.plus(Duration.ofMinutes(20));

	@MockitoBean
	private Clock clock;

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private JwtEncoder jwtEncoder;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private ActivityRepository activityRepository;

	@Autowired
	private CodingSessionRepository codingSessionRepository;

	@Autowired
	private SdiConfigRepository sdiConfigRepository;

	@Autowired
	private TelemetryEventRepository telemetryEventRepository;

	@Autowired
	private TelemetryService telemetryService;

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@Autowired
	private ObjectMapper objectMapper;

	private User instructor;

	private User student;

	private User otherStudent;

	private CodingSession session;

	@BeforeEach
	void createData() {
		given(this.clock.instant()).willReturn(NOW);
		this.instructor = this.userRepository
			.save(new User("Instructor One", "instructor1@example.test", "not-a-real-hash", Role.INSTRUCTOR));
		this.student = this.userRepository
			.save(new User("Student One", "student1@example.test", "not-a-real-hash", Role.STUDENT));
		this.otherStudent = this.userRepository
			.save(new User("Student Two", "student2@example.test", "not-a-real-hash", Role.STUDENT));
		this.jdbcTemplate.update("update users set consent_accepted_at = ? where role = 'STUDENT'",
				Timestamp.from(STARTED_AT.minus(Duration.ofDays(1))));
		Activity activity = this.activityRepository.save(new Activity(this.instructor.getId(), "Add two numbers",
				"Read two integers and print their sum.", "", ActivityStatus.PUBLISHED));
		this.sdiConfigRepository.save(new SdiConfig(activity.getId(), 70, 600, 5));
		this.session = this.codingSessionRepository
			.save(new CodingSession(this.student.getId(), activity.getId(), STARTED_AT));
	}

	@AfterEach
	void deleteData() {
		this.telemetryEventRepository.deleteAll();
		this.codingSessionRepository.deleteAll();
		this.activityRepository.deleteAll();
		this.userRepository.deleteAll();
	}

	@Test
	void aValidBatchIsStoredAndCounted() throws Exception {
		List<Map<String, Object>> events = List.of(edit(at(1), 3, 0), error(at(2), "NameError@3"), run(at(2), 1, 4));

		String body = perform(events(this.session.getId(), events), token(this.student)).andExpect(status().isOk())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
			.andExpect(jsonPath("$.accepted").value(3))
			.andExpect(jsonPath("$.duplicates").value(0))
			.andReturn()
			.getResponse()
			.getContentAsString();

		assertThat(this.objectMapper.readTree(body).size()).isEqualTo(3);
		List<TelemetryEvent> stored = this.telemetryEventRepository
			.findBySessionIdOrderByOccurredAtAscIdAsc(this.session.getId());
		assertThat(stored).extracting(TelemetryEvent::getType)
			.containsExactly(EventType.EDIT, EventType.ERROR, EventType.RUN);
		TelemetryEvent edit = stored.get(0);
		assertThat(edit.getClientEventId()).hasToString((String) events.get(0).get("clientEventId"));
		assertThat(edit.getOccurredAt()).isEqualTo(at(1));
		assertThat(edit.getCharsAdded()).isEqualTo(3);
		assertThat(edit.getCharsRemoved()).isZero();
		assertThat(stored.get(1).getErrorSignature()).isEqualTo("NameError@3");
		assertThat(stored.get(2).getPassedCount()).isEqualTo(1);
		assertThat(stored.get(2).getTotalCount()).isEqualTo(4);
		assertThat(stored.subList(0, 2)).allSatisfy(event -> assertThat(event.getSdiValue()).isNull());
		assertThat(stored.get(2).getSdiValue()).isBetween(0, 100);
	}

	@Test
	void sendingTheSameBatchTwiceStoresEachEventOnce() throws Exception {
		List<Map<String, Object>> events = List.of(edit(at(1), 3, 0), run(at(2), 1, 4));
		perform(events(this.session.getId(), events), token(this.student)).andExpect(status().isOk());

		List<Map<String, Object>> retry = new ArrayList<>(events);
		retry.add(run(at(3), 2, 4));
		perform(events(this.session.getId(), retry), token(this.student)).andExpect(status().isOk())
			.andExpect(jsonPath("$.accepted").value(1))
			.andExpect(jsonPath("$.duplicates").value(2));

		assertThat(this.telemetryEventRepository.count()).isEqualTo(3);
	}

	@Test
	void aClientIdRepeatedInsideOneBatchIsStoredOnce() throws Exception {
		Map<String, Object> edit = edit(at(1), 3, 0);
		perform(events(this.session.getId(), List.of(edit, edit)), token(this.student)).andExpect(status().isOk())
			.andExpect(jsonPath("$.accepted").value(1))
			.andExpect(jsonPath("$.duplicates").value(1));
		assertThat(this.telemetryEventRepository.count()).isEqualTo(1);
	}

	@Test
	void theSameClientIdInAnotherSessionIsNotADuplicate() throws Exception {
		CodingSession otherSession = this.codingSessionRepository
			.save(new CodingSession(this.student.getId(), this.session.getActivityId(), STARTED_AT));
		Map<String, Object> edit = edit(at(1), 3, 0);
		perform(events(this.session.getId(), List.of(edit)), token(this.student)).andExpect(status().isOk());

		perform(events(otherSession.getId(), List.of(edit)), token(this.student)).andExpect(status().isOk())
			.andExpect(jsonPath("$.accepted").value(1))
			.andExpect(jsonPath("$.duplicates").value(0));
	}

	@Test
	void oneInvalidEventRejectsTheWholeBatch() throws Exception {
		List<Map<String, Object>> events = List.of(edit(at(1), 3, 0), run(at(2), 5, 4));

		perform(events(this.session.getId(), events), token(this.student)).andExpect(status().isBadRequest())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
			.andExpect(jsonPath("$.errors['events[1].passedCount']").value("must be between 0 and totalCount"));

		assertThat(this.telemetryEventRepository.count()).isZero();
	}

	@Test
	void aBatchWithSdiValueIsRejected() throws Exception {
		Map<String, Object> run = run(at(2), 1, 4);
		run.put("sdiValue", 95);

		perform(events(this.session.getId(), List.of(run)), token(this.student)).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors['events[0].sdiValue']").exists());

		assertThat(this.telemetryEventRepository.count()).isZero();
	}

	@Test
	void anEmptyBatchIsRejected() throws Exception {
		perform(events(this.session.getId(), List.of()), token(this.student)).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors.events").exists());
	}

	@Test
	void anUnknownTypeIsRejected() throws Exception {
		Map<String, Object> event = edit(at(1), 3, 0);
		event.put("type", "PASTE");

		perform(events(this.session.getId(), List.of(event)), token(this.student)).andExpect(status().isBadRequest());

		assertThat(this.telemetryEventRepository.count()).isZero();
	}

	@Test
	void occurredAtMoreThanFiveMinutesInTheFutureIsRejected() throws Exception {
		List<Map<String, Object>> events = List.of(edit(NOW.plus(Duration.ofMinutes(5)), 1, 0),
				edit(NOW.plus(Duration.ofMinutes(5)).plusMillis(1), 1, 0));

		perform(events(this.session.getId(), events), token(this.student)).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors['events[1].occurredAt']").exists())
			.andExpect(jsonPath("$.errors['events[0].occurredAt']").doesNotExist());

		assertThat(this.telemetryEventRepository.count()).isZero();
	}

	@Test
	void occurredAtMoreThanFiveMinutesBeforeTheSessionStartIsRejected() throws Exception {
		Instant earliest = STARTED_AT.minus(Duration.ofMinutes(5));
		perform(events(this.session.getId(), List.of(edit(earliest, 1, 0))), token(this.student))
			.andExpect(status().isOk());

		perform(events(this.session.getId(), List.of(edit(earliest.minusMillis(1), 1, 0))), token(this.student))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors['events[0].occurredAt']").exists());

		assertThat(this.telemetryEventRepository.count()).isEqualTo(1);
	}

	@Test
	void anEndedSessionStillAcceptsEvents() throws Exception {
		this.session.end(NOW.minus(Duration.ofMinutes(1)));
		this.codingSessionRepository.save(this.session);

		perform(events(this.session.getId(), List.of(run(at(2), 1, 4))), token(this.student))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.accepted").value(1));
	}

	@Test
	void anotherStudentsSessionIs403AndStoresNothing() throws Exception {
		perform(events(this.session.getId(), List.of(edit(at(1), 3, 0))), token(this.otherStudent))
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.detail").value(DENIED_DETAIL));

		assertThat(this.telemetryEventRepository.count()).isZero();
	}

	@Test
	void aMissingSessionIs404() throws Exception {
		perform(events(Long.MAX_VALUE, List.of(edit(at(1), 3, 0))), token(this.student))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.detail").value("Session not found."));
	}

	@Test
	void anInstructorIs403() throws Exception {
		perform(events(this.session.getId(), List.of(edit(at(1), 3, 0))), token(this.instructor))
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.detail").value(DENIED_DETAIL));

		assertThat(this.telemetryEventRepository.count()).isZero();
	}

	@Test
	void noTokenIs401() throws Exception {
		perform(events(this.session.getId(), List.of(edit(at(1), 3, 0))), null).andExpect(status().isUnauthorized());
	}

	@Test
	void storeReturnsTheNewRunEventsInOccurredAtOrder() {
		List<TelemetryEventRequest> events = List.of(runRequest(at(30), 2), runRequest(at(10), 1),
				new TelemetryEventRequest(UUID.randomUUID(), EventType.EDIT, at(5), 1, 0, null, null, null, null),
				runRequest(at(20), 1));

		StoredBatch stored = this.telemetryService.store(this.session.getId(), this.student.getId(), events);

		assertThat(stored.accepted()).isEqualTo(4);
		assertThat(stored.runs()).extracting(TelemetryEvent::getOccurredAt).containsExactly(at(10), at(20), at(30));
		assertThat(stored.runs()).allSatisfy(run -> assertThat(run.getId()).isNotNull());

		StoredBatch again = this.telemetryService.store(this.session.getId(), this.student.getId(), events);
		assertThat(again.duplicates()).isEqualTo(4);
		assertThat(again.runs()).isEmpty();
	}

	private static TelemetryEventRequest runRequest(Instant occurredAt, int passed) {
		return new TelemetryEventRequest(UUID.randomUUID(), EventType.RUN, occurredAt, null, null, passed, 4, null,
				null);
	}

	private static Instant at(int seconds) {
		return STARTED_AT.plusSeconds(seconds);
	}

	private static Map<String, Object> event(String type, Instant occurredAt) {
		Map<String, Object> event = new LinkedHashMap<>();
		event.put("clientEventId", UUID.randomUUID().toString());
		event.put("type", type);
		event.put("occurredAt", occurredAt.toString());
		return event;
	}

	private static Map<String, Object> edit(Instant occurredAt, int added, int removed) {
		Map<String, Object> event = event("EDIT", occurredAt);
		event.put("charsAdded", added);
		event.put("charsRemoved", removed);
		return event;
	}

	private static Map<String, Object> run(Instant occurredAt, int passed, int total) {
		Map<String, Object> event = event("RUN", occurredAt);
		event.put("passedCount", passed);
		event.put("totalCount", total);
		return event;
	}

	private static Map<String, Object> error(Instant occurredAt, String signature) {
		Map<String, Object> event = event("ERROR", occurredAt);
		event.put("errorSignature", signature);
		return event;
	}

	private MockHttpServletRequestBuilder events(long sessionId, List<Map<String, Object>> events) {
		JsonNode body = this.objectMapper.valueToTree(Map.of("events", events));
		return post("/api/sessions/" + sessionId + "/events").contentType(MediaType.APPLICATION_JSON)
			.content(body.toString());
	}

	private ResultActions perform(MockHttpServletRequestBuilder request, String token) throws Exception {
		request.header(HttpHeaders.ACCEPT, "application/json, application/problem+json");
		if (token != null) {
			request.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
		}
		return this.mockMvc.perform(request);
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
