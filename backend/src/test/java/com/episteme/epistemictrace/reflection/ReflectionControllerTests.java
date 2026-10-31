package com.episteme.epistemictrace.reflection;

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
import java.util.Map;

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

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import com.episteme.epistemictrace.activity.Activity;
import com.episteme.epistemictrace.activity.ActivityRepository;
import com.episteme.epistemictrace.activity.ActivityStatus;
import com.episteme.epistemictrace.activity.SdiConfig;
import com.episteme.epistemictrace.activity.SdiConfigRepository;
import com.episteme.epistemictrace.breaker.BreakerState;
import com.episteme.epistemictrace.session.CodingSession;
import com.episteme.epistemictrace.session.CodingSessionRepository;
import com.episteme.epistemictrace.user.Role;
import com.episteme.epistemictrace.user.User;
import com.episteme.epistemictrace.user.UserRepository;

/** Spec 24 Part 2: {@code POST /api/sessions/{id}/reflections}. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ReflectionControllerTests {

	private static final Instant NOW = Instant.parse("2026-11-03T02:30:00Z");

	private static final String VALID = "The loop never stops at n.";

	private static final String DENIED_DETAIL = "You don't have access to this.";

	@MockitoBean
	private Clock clock;

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private JwtEncoder jwtEncoder;

	@Autowired
	private ObjectMapper objectMapper;

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private ActivityRepository activityRepository;

	@Autowired
	private SdiConfigRepository sdiConfigRepository;

	@Autowired
	private CodingSessionRepository codingSessionRepository;

	@Autowired
	private ReflectionRepository reflectionRepository;

	private User instructor;

	private User student;

	private User otherStudent;

	private Activity activity;

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
				Timestamp.from(NOW.minus(Duration.ofDays(1))));
		this.activity = this.activityRepository.save(new Activity(this.instructor.getId(), "Add two numbers",
				"Read two integers and print their sum.", "", ActivityStatus.PUBLISHED));
		this.sdiConfigRepository.save(new SdiConfig(this.activity.getId(), 70, 600, 5));
		CodingSession created = new CodingSession(this.student.getId(), this.activity.getId(), NOW.minusSeconds(900));
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
	void aValidReflectionIs201WithCooldownAndNoSdi() throws Exception {
		String body = perform(this.session.getId(), Map.of("hypothesis", VALID, "plannedFix", VALID), this.student)
			.andExpect(status().isCreated())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
			.andExpect(jsonPath("$.submittedAt").value("2026-11-03T02:30:00Z"))
			.andExpect(jsonPath("$.breaker.state").value("COOLDOWN"))
			.andExpect(jsonPath("$.breaker.cooldownEndsAt").value("2026-11-03T02:40:00Z"))
			.andExpect(jsonPath("$.breaker.reflectionMinLength").value(20))
			.andReturn()
			.getResponse()
			.getContentAsString();

		JsonNode json = this.objectMapper.readTree(body);
		assertThat(json.propertyNames()).containsOnly("reflectionId", "submittedAt", "breaker");
		assertThat(body).doesNotContainIgnoringCase("sdi").doesNotContain("84");
		Reflection saved = this.reflectionRepository.findById(json.get("reflectionId").asLong()).orElseThrow();
		assertThat(saved.getSdiAtTrigger()).isEqualTo(84);
	}

	@Test
	void theNextSessionStartShowsTheCooldown() throws Exception {
		perform(this.session.getId(), Map.of("hypothesis", VALID, "plannedFix", VALID), this.student)
			.andExpect(status().isCreated());

		this.mockMvc
			.perform(post("/api/sessions").contentType(MediaType.APPLICATION_JSON)
				.content(this.objectMapper.writeValueAsString(Map.of("activityId", this.activity.getId())))
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + token(this.student)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.sessionId").value(this.session.getId()))
			.andExpect(jsonPath("$.breaker.state").value("COOLDOWN"));
	}

	@Test
	void shortFieldsAre400WithFieldErrorsAndTheMinimumInTheDetail() throws Exception {
		perform(this.session.getId(), Map.of("hypothesis", "too short", "plannedFix", "   "), this.student)
			.andExpect(status().isBadRequest())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
			.andExpect(jsonPath("$.detail").value("Write at least 20 characters."))
			.andExpect(jsonPath("$.errors.hypothesis").value("Write at least 20 characters."))
			.andExpect(jsonPath("$.errors.plannedFix").value("Write at least 20 characters."));
		assertThat(this.reflectionRepository.count()).isZero();
	}

	@Test
	void anEmptyBodyIs400() throws Exception {
		perform(this.session.getId(), Map.of(), this.student).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors.hypothesis").exists())
			.andExpect(jsonPath("$.errors.plannedFix").exists());
	}

	@Test
	void reflectingWhileNotLockedIs409() throws Exception {
		perform(this.session.getId(), Map.of("hypothesis", VALID, "plannedFix", VALID), this.student)
			.andExpect(status().isCreated());

		perform(this.session.getId(), Map.of("hypothesis", VALID, "plannedFix", VALID), this.student)
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.detail").value("Tests aren't paused right now."));
		assertThat(this.reflectionRepository.count()).isEqualTo(1);
	}

	@Test
	void anotherStudentsSessionIs403() throws Exception {
		perform(this.session.getId(), Map.of("hypothesis", VALID, "plannedFix", VALID), this.otherStudent)
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.detail").value(DENIED_DETAIL));
		assertThat(this.reflectionRepository.count()).isZero();
	}

	@Test
	void aMissingSessionIs404() throws Exception {
		perform(Long.MAX_VALUE, Map.of("hypothesis", VALID, "plannedFix", VALID), this.student)
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.detail").value("Session not found."));
	}

	@Test
	void anInstructorIs403() throws Exception {
		perform(this.session.getId(), Map.of("hypothesis", VALID, "plannedFix", VALID), this.instructor)
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.detail").value(DENIED_DETAIL));
	}

	@Test
	void noTokenIs401() throws Exception {
		this.mockMvc
			.perform(post("/api/sessions/" + this.session.getId() + "/reflections").contentType(MediaType.APPLICATION_JSON)
				.content("{}"))
			.andExpect(status().isUnauthorized());
	}

	private ResultActions perform(long sessionId, Map<String, Object> body, User user) throws Exception {
		return this.mockMvc.perform(post("/api/sessions/" + sessionId + "/reflections")
			.contentType(MediaType.APPLICATION_JSON)
			.content(this.objectMapper.writeValueAsString(body))
			.header(HttpHeaders.ACCEPT, "application/json, application/problem+json")
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
