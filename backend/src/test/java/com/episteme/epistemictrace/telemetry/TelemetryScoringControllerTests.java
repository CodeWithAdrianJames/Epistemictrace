package com.episteme.epistemictrace.telemetry;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import com.episteme.epistemictrace.activity.Activity;
import com.episteme.epistemictrace.activity.ActivityRepository;
import com.episteme.epistemictrace.activity.ActivityStatus;
import com.episteme.epistemictrace.activity.SdiConfig;
import com.episteme.epistemictrace.activity.SdiConfigRepository;
import com.episteme.epistemictrace.sdi.SdiEvent;
import com.episteme.epistemictrace.sdi.SdiScenarios;
import com.episteme.epistemictrace.sdi.SdiScenarios.Scenario;
import com.episteme.epistemictrace.session.CodingSession;
import com.episteme.epistemictrace.session.CodingSessionRepository;
import com.episteme.epistemictrace.user.Role;
import com.episteme.epistemictrace.user.User;
import com.episteme.epistemictrace.user.UserRepository;

/**
 * Spec 21 Part 2: the spec 20 scenarios posted as the browser sends them (one batch per run) end with the expected
 * struggle level, every RUN is scored, and no response carries a raw score.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class TelemetryScoringControllerTests {

	@MockitoBean
	private Clock clock;

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
	private SdiConfigRepository sdiConfigRepository;

	@Autowired
	private CodingSessionRepository codingSessionRepository;

	@Autowired
	private TelemetryEventRepository telemetryEventRepository;

	private User student;

	private CodingSession session;

	@BeforeEach
	void createData() {
		given(this.clock.instant()).willReturn(SdiScenarios.T0.plus(Duration.ofMinutes(10)));
		User instructor = this.userRepository
			.save(new User("Instructor One", "instructor1@example.test", "not-a-real-hash", Role.INSTRUCTOR));
		this.student = this.userRepository
			.save(new User("Student One", "student1@example.test", "not-a-real-hash", Role.STUDENT));
		Activity activity = this.activityRepository.save(new Activity(instructor.getId(), "Add two numbers",
				"Read two integers and print their sum.", "", ActivityStatus.PUBLISHED));
		this.sdiConfigRepository.save(new SdiConfig(activity.getId(), 70, 600, 5));
		this.session = this.codingSessionRepository
			.save(new CodingSession(this.student.getId(), activity.getId(), SdiScenarios.T0));
	}

	@AfterEach
	void deleteData() {
		this.telemetryEventRepository.deleteAll();
		this.codingSessionRepository.deleteAll();
		this.activityRepository.deleteAll();
		this.userRepository.deleteAll();
	}

	@Test
	void theWheelSpinningScenarioEndsHigh() throws Exception {
		List<JsonNode> responses = postAsBatches(SdiScenarios.wheelSpinning());

		assertThat(responses.get(responses.size() - 1).get("struggleLevel").asString()).isEqualTo("HIGH");
		assertEveryRunScoredAndPeakIsTheMaximum(10);
	}

	@Test
	void theSteadyScenarioEndsLow() throws Exception {
		List<JsonNode> responses = postAsBatches(SdiScenarios.steadyProgress());

		assertThat(responses).allSatisfy(json -> assertThat(json.get("struggleLevel").asString()).isEqualTo("LOW"));
		assertEveryRunScoredAndPeakIsTheMaximum(4);
	}

	@Test
	void noResponseCarriesARawScore() throws Exception {
		for (JsonNode json : postAsBatches(SdiScenarios.wheelSpinning())) {
			assertThat(json.propertyNames()).containsOnly("accepted", "duplicates", "struggleLevel", "breaker");
			assertThat(json.toString()).doesNotContainIgnoringCase("sdi").doesNotContainIgnoringCase("peak");
		}
	}

	@Test
	void aBatchWithoutRunHasANullLevel() throws Exception {
		Map<String, Object> edit = new LinkedHashMap<>();
		edit.put("clientEventId", UUID.randomUUID().toString());
		edit.put("type", "EDIT");
		edit.put("occurredAt", SdiScenarios.T0.toString());
		edit.put("charsAdded", 1);
		edit.put("charsRemoved", 0);

		JsonNode json = send(List.of(edit));

		assertThat(json.has("struggleLevel")).isTrue();
		assertThat(json.get("struggleLevel").isNull()).isTrue();
	}

	@Test
	void resendingTheSameBatchDoesNotChangeStoredScores() throws Exception {
		Scenario scenario = SdiScenarios.wheelSpinning();
		List<List<Map<String, Object>>> batches = batches(scenario);
		for (List<Map<String, Object>> batch : batches) {
			send(batch);
		}
		List<Integer> before = runScores();

		for (List<Map<String, Object>> batch : batches) {
			JsonNode json = send(batch);
			assertThat(json.get("accepted").asInt()).isZero();
			assertThat(json.get("struggleLevel").isNull()).isTrue();
		}

		assertThat(runScores()).isEqualTo(before);
	}

	private void assertEveryRunScoredAndPeakIsTheMaximum(int runs) {
		List<Integer> scores = runScores();
		assertThat(scores).hasSize(runs).allSatisfy(sdi -> assertThat(sdi).isNotNull().isBetween(0, 100));
		CodingSession stored = this.codingSessionRepository.findById(this.session.getId()).orElseThrow();
		assertThat(stored.getPeakSdi()).isEqualTo(scores.stream().mapToInt(Integer::intValue).max().orElseThrow());
	}

	private List<Integer> runScores() {
		return this.telemetryEventRepository.findBySessionIdOrderByOccurredAtAscIdAsc(this.session.getId())
			.stream()
			.filter(event -> event.getType() == EventType.RUN)
			.map(TelemetryEvent::getSdiValue)
			.toList();
	}

	private List<JsonNode> postAsBatches(Scenario scenario) throws Exception {
		List<JsonNode> responses = new ArrayList<>();
		for (List<Map<String, Object>> batch : batches(scenario)) {
			responses.add(send(batch));
		}
		return responses;
	}

	/** One batch per run, holding the events since the previous run, as the browser sends them (spec 17 R4). */
	private static List<List<Map<String, Object>>> batches(Scenario scenario) {
		List<List<Map<String, Object>>> batches = new ArrayList<>();
		List<Map<String, Object>> current = new ArrayList<>();
		for (SdiEvent event : scenario.events()) {
			current.add(payload(event));
			if (event.type() == EventType.RUN) {
				batches.add(current);
				current = new ArrayList<>();
			}
		}
		return batches;
	}

	private static Map<String, Object> payload(SdiEvent event) {
		Map<String, Object> payload = new LinkedHashMap<>();
		payload.put("clientEventId", UUID.nameUUIDFromBytes(("event-" + event.id()).getBytes()).toString());
		payload.put("type", event.type().name());
		payload.put("occurredAt", event.occurredAt().toString());
		switch (event.type()) {
			case EDIT -> {
				payload.put("charsAdded", 3);
				payload.put("charsRemoved", 1);
			}
			case ERROR -> payload.put("errorSignature", event.errorSignature());
			case RUN -> {
				payload.put("passedCount", event.passedCount());
				payload.put("totalCount", 4);
			}
		}
		return payload;
	}

	private JsonNode send(List<Map<String, Object>> events) throws Exception {
		String body = this.mockMvc
			.perform(post("/api/sessions/" + this.session.getId() + "/events").contentType(MediaType.APPLICATION_JSON)
				.content(this.objectMapper.writeValueAsString(Map.of("events", events)))
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + token(this.student)))
			.andExpect(status().isOk())
			.andReturn()
			.getResponse()
			.getContentAsString();
		return this.objectMapper.readTree(body);
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
