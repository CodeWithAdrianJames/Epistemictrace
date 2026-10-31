package com.episteme.epistemictrace.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.sql.Timestamp;
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
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** Spec 15 Part A: {@code PUT /api/me/consent}. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ConsentControllerTests {

	private static final String URL = "/api/me/consent";

	private static final String DENIED_DETAIL = "You don't have access to this.";

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private JwtEncoder jwtEncoder;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@Autowired
	private ObjectMapper objectMapper;

	private User student;

	private User instructor;

	@BeforeEach
	void createUsers() {
		this.student = this.userRepository
			.save(new User("Student One", "student1@example.test", "not-a-real-hash", Role.STUDENT));
		this.instructor = this.userRepository
			.save(new User("Instructor One", "instructor1@example.test", "not-a-real-hash", Role.INSTRUCTOR));
	}

	@AfterEach
	void deleteData() {
		this.userRepository.deleteAll();
	}

	@Test
	void firstCallSetsTimestampAndReturnsItAsIsoUtc() throws Exception {
		Instant before = Instant.now().minus(1, ChronoUnit.SECONDS);

		MvcResult result = perform(put(URL), token(this.student)).andExpect(status().isOk())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
			.andExpect(jsonPath("$.consentAcceptedAt").isString())
			.andReturn();

		Instant after = Instant.now().plus(1, ChronoUnit.SECONDS);
		String body = result.getResponse().getContentAsString();
		JsonNode json = this.objectMapper.readTree(body);
		assertThat(json.size()).isEqualTo(1);
		String returned = json.get("consentAcceptedAt").asString();
		assertThat(returned).endsWith("Z");
		Instant returnedAt = Instant.parse(returned);
		assertThat(returnedAt).isBetween(before, after);
		assertThat(storedConsent(this.student)).isEqualTo(returnedAt);
	}

	@Test
	void firstCallIsVisibleOnAuthMe() throws Exception {
		perform(get("/api/auth/me"), token(this.student)).andExpect(status().isOk())
			.andExpect(jsonPath("$.consentAccepted").value(false));

		perform(put(URL), token(this.student)).andExpect(status().isOk());

		perform(get("/api/auth/me"), token(this.student)).andExpect(status().isOk())
			.andExpect(jsonPath("$.consentAccepted").value(true));
	}

	@Test
	void secondCallKeepsTheFirstTimestamp() throws Exception {
		String first = consentAcceptedAt(perform(put(URL), token(this.student)).andExpect(status().isOk()));
		Instant stored = storedConsent(this.student);

		String second = consentAcceptedAt(perform(put(URL), token(this.student)).andExpect(status().isOk()));

		assertThat(second).isEqualTo(first);
		assertThat(storedConsent(this.student)).isEqualTo(stored);
		assertThat(Instant.parse(second)).isEqualTo(stored);
	}

	@Test
	void existingTimestampIsReturnedUnchanged() throws Exception {
		Instant earlier = Instant.parse("2026-10-01T08:15:30Z");
		this.jdbcTemplate.update("update users set consent_accepted_at = ? where id = ?", Timestamp.from(earlier),
				this.student.getId());

		perform(put(URL), token(this.student)).andExpect(status().isOk())
			.andExpect(jsonPath("$.consentAcceptedAt").value("2026-10-01T08:15:30Z"));

		assertThat(storedConsent(this.student)).isEqualTo(earlier);
	}

	@Test
	void consentOfOneStudentDoesNotChangeAnother() throws Exception {
		User other = this.userRepository
			.save(new User("Student Two", "student2@example.test", "not-a-real-hash", Role.STUDENT));

		perform(put(URL), token(this.student)).andExpect(status().isOk());

		assertThat(storedConsent(this.student)).isNotNull();
		assertThat(storedConsent(other)).isNull();
	}

	@Test
	void instructorIs403AndNothingIsStored() throws Exception {
		perform(put(URL), token(this.instructor)).andExpect(status().isForbidden())
			.andExpect(jsonPath("$.detail").value(DENIED_DETAIL));

		assertThat(storedConsent(this.instructor)).isNull();
	}

	@Test
	void withoutTokenIs401() throws Exception {
		perform(put(URL), null).andExpect(status().isUnauthorized());

		assertThat(storedConsent(this.student)).isNull();
	}

	@Test
	void tokenOfDeletedStudentIs401() throws Exception {
		String token = token(this.student);
		this.userRepository.deleteById(this.student.getId());

		perform(put(URL), token).andExpect(status().isUnauthorized());
	}

	private String consentAcceptedAt(ResultActions actions) throws Exception {
		String body = actions.andReturn().getResponse().getContentAsString();
		return this.objectMapper.readTree(body).get("consentAcceptedAt").asString();
	}

	private Instant storedConsent(User user) {
		Timestamp stored = this.jdbcTemplate.queryForObject("select consent_accepted_at from users where id = ?",
				Timestamp.class, user.getId());
		return (stored != null) ? stored.toInstant() : null;
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
