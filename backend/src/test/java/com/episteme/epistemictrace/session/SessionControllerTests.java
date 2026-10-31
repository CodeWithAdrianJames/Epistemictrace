package com.episteme.epistemictrace.session;

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
import com.episteme.epistemictrace.user.Role;
import com.episteme.epistemictrace.user.User;
import com.episteme.epistemictrace.user.UserRepository;

/** Spec 16 Part 2: {@code POST /api/sessions} and {@code POST /api/sessions/{id}/end}. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SessionControllerTests {

	private static final String BASE = "/api/sessions";

	private static final String DENIED_DETAIL = "You don't have access to this.";

	private static final Instant NOW = Instant.parse("2026-10-31T10:00:00Z");

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
	private JdbcTemplate jdbcTemplate;

	@Autowired
	private ObjectMapper objectMapper;

	private User instructor;

	private User student;

	private User otherStudent;

	private Activity activity;

	@BeforeEach
	void createData() {
		given(this.clock.instant()).willReturn(NOW);
		this.instructor = this.userRepository
			.save(new User("Instructor One", "instructor1@example.test", "not-a-real-hash", Role.INSTRUCTOR));
		this.student = this.userRepository
			.save(new User("Student One", "student1@example.test", "not-a-real-hash", Role.STUDENT));
		this.otherStudent = this.userRepository
			.save(new User("Student Two", "student2@example.test", "not-a-real-hash", Role.STUDENT));
		acceptConsent(this.student);
		acceptConsent(this.otherStudent);
		this.activity = saveActivity("Add two numbers", ActivityStatus.PUBLISHED);
	}

	@AfterEach
	void deleteData() {
		this.codingSessionRepository.deleteAll();
		this.activityRepository.deleteAll();
		this.userRepository.deleteAll();
	}

	// POST /api/sessions

	@Test
	void startCreatesASessionWith201() throws Exception {
		String body = perform(start(this.activity.getId()), token(this.student)).andExpect(status().isCreated())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
			.andExpect(jsonPath("$.activityId").value(this.activity.getId()))
			.andExpect(jsonPath("$.startedAt").value("2026-10-31T10:00:00Z"))
			.andExpect(jsonPath("$.resumed").value(false))
			.andReturn()
			.getResponse()
			.getContentAsString();

		JsonNode json = this.objectMapper.readTree(body);
		assertThat(json.size()).isEqualTo(5);
		long sessionId = json.get("sessionId").asLong();
		CodingSession stored = this.codingSessionRepository.findById(sessionId).orElseThrow();
		assertThat(stored.getStudentId()).isEqualTo(this.student.getId());
		assertThat(stored.getActivityId()).isEqualTo(this.activity.getId());
		assertThat(stored.getStartedAt()).isEqualTo(NOW);
		assertThat(stored.getEndedAt()).isNull();
	}

	@Test
	void startingAgainResumesTheSameSessionWith200() throws Exception {
		long sessionId = startedSessionId();
		given(this.clock.instant()).willReturn(NOW.plus(Duration.ofMinutes(5)));

		perform(start(this.activity.getId()), token(this.student)).andExpect(status().isOk())
			.andExpect(jsonPath("$.sessionId").value(sessionId))
			.andExpect(jsonPath("$.activityId").value(this.activity.getId()))
			.andExpect(jsonPath("$.startedAt").value("2026-10-31T10:00:00Z"))
			.andExpect(jsonPath("$.resumed").value(true));

		assertThat(this.codingSessionRepository.count()).isEqualTo(1);
	}

	@Test
	void startingWithin30MinutesOfTheEndResumesTheSession() throws Exception {
		long sessionId = startedSessionId();
		perform(post(BASE + "/" + sessionId + "/end"), token(this.student)).andExpect(status().isNoContent());
		given(this.clock.instant()).willReturn(NOW.plus(Duration.ofMinutes(30)));

		perform(start(this.activity.getId()), token(this.student)).andExpect(status().isOk())
			.andExpect(jsonPath("$.sessionId").value(sessionId))
			.andExpect(jsonPath("$.resumed").value(true));

		assertThat(this.codingSessionRepository.findById(sessionId).orElseThrow().getEndedAt()).isNull();
	}

	@Test
	void startingAfter31MinutesCreatesANewSession() throws Exception {
		long sessionId = startedSessionId();
		perform(post(BASE + "/" + sessionId + "/end"), token(this.student)).andExpect(status().isNoContent());
		given(this.clock.instant()).willReturn(NOW.plus(Duration.ofMinutes(31)));

		String body = perform(start(this.activity.getId()), token(this.student)).andExpect(status().isCreated())
			.andExpect(jsonPath("$.startedAt").value("2026-10-31T10:31:00Z"))
			.andExpect(jsonPath("$.resumed").value(false))
			.andReturn()
			.getResponse()
			.getContentAsString();

		assertThat(this.objectMapper.readTree(body).get("sessionId").asLong()).isNotEqualTo(sessionId);
		assertThat(this.codingSessionRepository.findById(sessionId).orElseThrow().getEndedAt()).isEqualTo(NOW);
		assertThat(this.codingSessionRepository.count()).isEqualTo(2);
	}

	@Test
	void startWithoutConsentIs403AndCreatesNothing() throws Exception {
		User noConsent = this.userRepository
			.save(new User("Student Three", "student3@example.test", "not-a-real-hash", Role.STUDENT));

		perform(start(this.activity.getId()), token(noConsent)).andExpect(status().isForbidden())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
			.andExpect(jsonPath("$.detail").value("Consent is required before tracking starts."));

		assertThat(this.codingSessionRepository.count()).isZero();
	}

	@Test
	void startOnADraftActivityIs404() throws Exception {
		Activity draft = saveActivity("A draft", ActivityStatus.DRAFT);

		perform(start(draft.getId()), token(this.student)).andExpect(status().isNotFound())
			.andExpect(jsonPath("$.detail").value("Activity not found."));

		assertThat(this.codingSessionRepository.count()).isZero();
	}

	@Test
	void startOnAnArchivedActivityIs404() throws Exception {
		Activity archived = saveActivity("An archived one", ActivityStatus.ARCHIVED);

		perform(start(archived.getId()), token(this.student)).andExpect(status().isNotFound())
			.andExpect(jsonPath("$.detail").value("Activity not found."));

		assertThat(this.codingSessionRepository.count()).isZero();
	}

	@Test
	void startOnAMissingActivityIs404() throws Exception {
		perform(start(this.activity.getId() + 1000), token(this.student)).andExpect(status().isNotFound());

		assertThat(this.codingSessionRepository.count()).isZero();
	}

	@Test
	void startWithoutActivityIdIs400WithFieldError() throws Exception {
		perform(post(BASE).contentType(MediaType.APPLICATION_JSON).content("{}"), token(this.student))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors.activityId").isString());

		assertThat(this.codingSessionRepository.count()).isZero();
	}

	@Test
	void startWithAMalformedBodyIs400() throws Exception {
		perform(post(BASE).contentType(MediaType.APPLICATION_JSON).content("{\"activityId\":"), token(this.student))
			.andExpect(status().isBadRequest());

		assertThat(this.codingSessionRepository.count()).isZero();
	}

	@Test
	void startAsInstructorIs403() throws Exception {
		perform(start(this.activity.getId()), token(this.instructor)).andExpect(status().isForbidden())
			.andExpect(jsonPath("$.detail").value(DENIED_DETAIL));

		assertThat(this.codingSessionRepository.count()).isZero();
	}

	@Test
	void startWithoutTokenIs401() throws Exception {
		perform(start(this.activity.getId()), null).andExpect(status().isUnauthorized());

		assertThat(this.codingSessionRepository.count()).isZero();
	}

	@Test
	void startWithTheTokenOfADeletedStudentIs401() throws Exception {
		String token = token(this.student);
		this.userRepository.deleteById(this.student.getId());

		perform(start(this.activity.getId()), token).andExpect(status().isUnauthorized());
	}

	// POST /api/sessions/{id}/end

	@Test
	void endIs204AndRecordsTheEnd() throws Exception {
		long sessionId = startedSessionId();
		Instant later = NOW.plus(Duration.ofMinutes(12));
		given(this.clock.instant()).willReturn(later);

		perform(post(BASE + "/" + sessionId + "/end"), token(this.student)).andExpect(status().isNoContent())
			.andExpect(content().string(""));

		assertThat(this.codingSessionRepository.findById(sessionId).orElseThrow().getEndedAt()).isEqualTo(later);
	}

	@Test
	void endingTwiceKeepsTheLatestEnd() throws Exception {
		long sessionId = startedSessionId();
		perform(post(BASE + "/" + sessionId + "/end"), token(this.student)).andExpect(status().isNoContent());
		Instant later = NOW.plus(Duration.ofMinutes(3));
		given(this.clock.instant()).willReturn(later);

		perform(post(BASE + "/" + sessionId + "/end"), token(this.student)).andExpect(status().isNoContent());

		assertThat(this.codingSessionRepository.findById(sessionId).orElseThrow().getEndedAt()).isEqualTo(later);
	}

	@Test
	void endOfAnotherStudentsSessionIs403AndChangesNothing() throws Exception {
		long sessionId = startedSessionId();

		perform(post(BASE + "/" + sessionId + "/end"), token(this.otherStudent)).andExpect(status().isForbidden())
			.andExpect(jsonPath("$.detail").value(DENIED_DETAIL));

		assertThat(this.codingSessionRepository.findById(sessionId).orElseThrow().getEndedAt()).isNull();
	}

	@Test
	void endOfAMissingSessionIs404() throws Exception {
		perform(post(BASE + "/" + Long.MAX_VALUE + "/end"), token(this.student)).andExpect(status().isNotFound())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
			.andExpect(jsonPath("$.detail").value("Session not found."));
	}

	@Test
	void endAsInstructorIs403() throws Exception {
		long sessionId = startedSessionId();

		perform(post(BASE + "/" + sessionId + "/end"), token(this.instructor)).andExpect(status().isForbidden())
			.andExpect(jsonPath("$.detail").value(DENIED_DETAIL));

		assertThat(this.codingSessionRepository.findById(sessionId).orElseThrow().getEndedAt()).isNull();
	}

	@Test
	void endWithoutTokenIs401() throws Exception {
		long sessionId = startedSessionId();

		perform(post(BASE + "/" + sessionId + "/end"), null).andExpect(status().isUnauthorized());

		assertThat(this.codingSessionRepository.findById(sessionId).orElseThrow().getEndedAt()).isNull();
	}

	private long startedSessionId() throws Exception {
		String body = perform(start(this.activity.getId()), token(this.student)).andExpect(status().isCreated())
			.andReturn()
			.getResponse()
			.getContentAsString();
		return this.objectMapper.readTree(body).get("sessionId").asLong();
	}

	private MockHttpServletRequestBuilder start(long activityId) {
		return post(BASE).contentType(MediaType.APPLICATION_JSON).content("{\"activityId\":" + activityId + "}");
	}

	private void acceptConsent(User user) {
		this.jdbcTemplate.update("update users set consent_accepted_at = ? where id = ?",
				Timestamp.from(NOW.minus(Duration.ofDays(1))), user.getId());
	}

	private Activity saveActivity(String title, ActivityStatus status) {
		return this.activityRepository.save(new Activity(this.instructor.getId(), title,
				"Read two integers and print their sum.", "", status));
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
