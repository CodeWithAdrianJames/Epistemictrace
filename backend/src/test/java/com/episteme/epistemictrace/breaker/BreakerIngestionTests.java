package com.episteme.epistemictrace.breaker;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
import org.springframework.test.web.servlet.ResultMatcher;

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
import com.episteme.epistemictrace.telemetry.EventType;
import com.episteme.epistemictrace.telemetry.TelemetryEventRepository;
import com.episteme.epistemictrace.user.Role;
import com.episteme.epistemictrace.user.User;
import com.episteme.epistemictrace.user.UserRepository;

/** Spec 22 Part B: breaker state through event ingestion and session start, end to end on H2. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class BreakerIngestionTests {

	private static final Instant NOW = SdiScenarios.T0.plus(Duration.ofMinutes(10));

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

	@Autowired
	private JdbcTemplate jdbcTemplate;

	private User student;

	private Activity activity;

	private CodingSession session;

	@BeforeEach
	void createData() {
		given(this.clock.instant()).willReturn(NOW);
		User instructor = this.userRepository
			.save(new User("Instructor One", "instructor1@example.test", "not-a-real-hash", Role.INSTRUCTOR));
		this.student = this.userRepository
			.save(new User("Student One", "student1@example.test", "not-a-real-hash", Role.STUDENT));
		this.jdbcTemplate.update("update users set consent_accepted_at = ? where id = ?",
				Timestamp.from(SdiScenarios.T0.minus(Duration.ofDays(1))), this.student.getId());
		this.activity = this.activityRepository.save(new Activity(instructor.getId(), "Add two numbers",
				"Read two integers and print their sum.", "", ActivityStatus.PUBLISHED));
		this.sdiConfigRepository.save(new SdiConfig(this.activity.getId(), 70, 600, 5));
		this.session = this.codingSessionRepository
			.save(new CodingSession(this.student.getId(), this.activity.getId(), SdiScenarios.T0));
	}

	@AfterEach
	void deleteData() {
		this.telemetryEventRepository.deleteAll();
		this.codingSessionRepository.deleteAll();
		this.activityRepository.deleteAll();
		this.userRepository.deleteAll();
	}

	@Test
	void wheelSpinningBatchesLockTheRunner() throws Exception {
		List<JsonNode> responses = postAsBatches(SdiScenarios.wheelSpinning());

		JsonNode breaker = responses.get(responses.size() - 1).get("breaker");
		assertThat(breaker.get("state").asString()).isEqualTo("LOCKED");
		assertThat(breaker.get("cooldownEndsAt").isNull()).isTrue();
		assertThat(breaker.get("reflectionMinLength").asInt()).isEqualTo(20);
		assertThat(breaker.propertyNames()).containsOnly("state", "cooldownEndsAt", "reflectionMinLength");
		assertThat(responses.get(0).get("breaker").get("state").asString()).isEqualTo("UNLOCKED");

		CodingSession stored = stored();
		assertThat(stored.isRunnerLocked()).isTrue();
		assertThat(stored.getSdiAtLock()).isBetween(70, 100);
	}

	@Test
	void steadyBatchesStayUnlocked() throws Exception {
		List<JsonNode> responses = postAsBatches(SdiScenarios.steadyProgress());

		assertThat(responses).allSatisfy(json -> assertThat(json.get("breaker").get("state").asString())
			.isEqualTo("UNLOCKED"));
		assertThat(stored().isRunnerLocked()).isFalse();
		assertThat(stored().getSdiAtLock()).isNull();
	}

	@Test
	void runsWhileLockedAreScoredButKeepTheFirstLock() throws Exception {
		postAsBatches(SdiScenarios.wheelSpinning());
		int sdiAtLock = stored().getSdiAtLock();

		JsonNode json = send(List.of(run(SdiScenarios.T0.plusSeconds(310), 0)), status().isOk());

		assertThat(json.get("breaker").get("state").asString()).isEqualTo("LOCKED");
		assertThat(json.get("struggleLevel").isNull()).isFalse();
		assertThat(stored().getSdiAtLock()).isEqualTo(sdiAtLock);
	}

	@Test
	void aBatchWithoutRunStillCarriesTheBreaker() throws Exception {
		JsonNode json = send(List.of(edit(SdiScenarios.T0)), status().isOk());
		assertThat(json.get("breaker").get("state").asString()).isEqualTo("UNLOCKED");
	}

	@Test
	void aCooldownPreventsAnImmediateRetrigger() throws Exception {
		Instant cooldownEnd = NOW.plus(Duration.ofMinutes(5));
		setBreakerColumns(false, null, cooldownEnd);

		List<JsonNode> responses = postAsBatches(SdiScenarios.wheelSpinning());

		JsonNode breaker = responses.get(responses.size() - 1).get("breaker");
		assertThat(breaker.get("state").asString()).isEqualTo("COOLDOWN");
		assertThat(Instant.parse(breaker.get("cooldownEndsAt").asString())).isEqualTo(cooldownEnd);
		assertThat(stored().isRunnerLocked()).isFalse();
	}

	@Test
	void afterTheCooldownEndsTheNextHighRunLocksAgain() throws Exception {
		setBreakerColumns(false, null, NOW);

		List<JsonNode> responses = postAsBatches(SdiScenarios.wheelSpinning());

		assertThat(responses.get(responses.size() - 1).get("breaker").get("state").asString()).isEqualTo("LOCKED");
	}

	@Test
	void resumingALockedSessionReturnsLocked() throws Exception {
		postAsBatches(SdiScenarios.wheelSpinning());

		JsonNode json = start(status().isOk());

		assertThat(json.get("sessionId").asLong()).isEqualTo(this.session.getId());
		assertThat(json.get("resumed").asBoolean()).isTrue();
		assertThat(json.get("breaker").get("state").asString()).isEqualTo("LOCKED");
		assertThat(json.toString()).doesNotContainIgnoringCase("sdi");
	}

	@Test
	void aNewSessionStartsUnlocked() throws Exception {
		this.telemetryEventRepository.deleteAll();
		this.codingSessionRepository.deleteAll();

		JsonNode json = start(status().isCreated());

		JsonNode breaker = json.get("breaker");
		assertThat(breaker.get("state").asString()).isEqualTo("UNLOCKED");
		assertThat(breaker.get("cooldownEndsAt").isNull()).isTrue();
		assertThat(breaker.get("reflectionMinLength").asInt()).isEqualTo(20);
	}

	@Test
	void resumingDuringACooldownReturnsCooldown() throws Exception {
		Instant cooldownEnd = NOW.plus(Duration.ofMinutes(3));
		setBreakerColumns(false, null, cooldownEnd);

		JsonNode breaker = start(status().isOk()).get("breaker");

		assertThat(breaker.get("state").asString()).isEqualTo("COOLDOWN");
		assertThat(Instant.parse(breaker.get("cooldownEndsAt").asString())).isEqualTo(cooldownEnd);
	}

	private CodingSession stored() {
		return this.codingSessionRepository.findById(this.session.getId()).orElseThrow();
	}

	private void setBreakerColumns(boolean locked, Integer sdiAtLock, Instant cooldownEndsAt) {
		this.jdbcTemplate.update(
				"update coding_sessions set runner_locked = ?, sdi_at_lock = ?, cooldown_ends_at = ? where id = ?", locked,
				sdiAtLock, (cooldownEndsAt != null) ? Timestamp.from(cooldownEndsAt) : null, this.session.getId());
	}

	private List<JsonNode> postAsBatches(Scenario scenario) throws Exception {
		List<JsonNode> responses = new ArrayList<>();
		List<Map<String, Object>> batch = new ArrayList<>();
		for (SdiEvent event : scenario.events()) {
			batch.add(payload(event));
			if (event.type() == EventType.RUN) {
				responses.add(send(batch, status().isOk()));
				batch = new ArrayList<>();
			}
		}
		return responses;
	}

	private static Map<String, Object> payload(SdiEvent event) {
		Map<String, Object> payload = switch (event.type()) {
			case EDIT -> edit(event.occurredAt());
			case ERROR -> base("ERROR", event.occurredAt());
			case RUN -> run(event.occurredAt(), event.passedCount());
		};
		if (event.type() == EventType.ERROR) {
			payload.put("errorSignature", event.errorSignature());
		}
		return payload;
	}

	private static Map<String, Object> base(String type, Instant occurredAt) {
		Map<String, Object> payload = new LinkedHashMap<>();
		payload.put("clientEventId", UUID.randomUUID().toString());
		payload.put("type", type);
		payload.put("occurredAt", occurredAt.toString());
		return payload;
	}

	private static Map<String, Object> edit(Instant occurredAt) {
		Map<String, Object> payload = base("EDIT", occurredAt);
		payload.put("charsAdded", 3);
		payload.put("charsRemoved", 1);
		return payload;
	}

	private static Map<String, Object> run(Instant occurredAt, int passed) {
		Map<String, Object> payload = base("RUN", occurredAt);
		payload.put("passedCount", passed);
		payload.put("totalCount", 4);
		return payload;
	}

	private JsonNode send(List<Map<String, Object>> events, ResultMatcher expected) throws Exception {
		return perform("/api/sessions/" + this.session.getId() + "/events", Map.of("events", events), expected);
	}

	private JsonNode start(ResultMatcher expected) throws Exception {
		return perform("/api/sessions", Map.of("activityId", this.activity.getId()), expected);
	}

	private JsonNode perform(String path, Object body, ResultMatcher expected) throws Exception {
		String response = this.mockMvc
			.perform(post(path).contentType(MediaType.APPLICATION_JSON)
				.content(this.objectMapper.writeValueAsString(body))
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + token(this.student)))
			.andExpect(expected)
			.andReturn()
			.getResponse()
			.getContentAsString();
		return this.objectMapper.readTree(response);
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
