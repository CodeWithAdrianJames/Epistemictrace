package com.episteme.epistemictrace;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.stream.Stream;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.episteme.epistemictrace.user.Role;
import com.episteme.epistemictrace.user.User;
import com.episteme.epistemictrace.user.UserRepository;

/**
 * Spec 06 R2: every path rule in {@code SecurityConfig} with no token, a student token and an instructor token.
 * "Allowed" means the request got past security (any status except {@code 401} and {@code 403}); most of these
 * paths have no controller yet and answer {@code 404}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class RoleAccessTests {

	private static final String DENIED_DETAIL = "You don't have access to this.";

	enum Caller {
		NONE, STUDENT, INSTRUCTOR
	}

	enum Outcome {
		UNAUTHORIZED, FORBIDDEN, ALLOWED
	}

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private JwtEncoder jwtEncoder;

	@Autowired
	private UserRepository userRepository;

	private String studentToken;

	private String instructorToken;

	/** Real users, so {@code /api/auth/me} answers {@code 200} instead of "account no longer exists". */
	@BeforeEach
	void createUsers() {
		User student = this.userRepository.save(
				new User("Student One", "student1@example.test", "not-a-real-hash", Role.STUDENT));
		User instructor = this.userRepository.save(
				new User("Instructor One", "instructor1@example.test", "not-a-real-hash", Role.INSTRUCTOR));
		this.studentToken = token(student);
		this.instructorToken = token(instructor);
	}

	@AfterEach
	void deleteUsers() {
		this.userRepository.deleteAll();
	}

	static Stream<Arguments> rules() {
		return Stream.of(
				// Permit all: health, register, login, OPTIONS.
				Arguments.of("permitAll", HttpMethod.GET, "/api/health", Caller.NONE, Outcome.ALLOWED),
				Arguments.of("permitAll", HttpMethod.GET, "/api/health", Caller.STUDENT, Outcome.ALLOWED),
				Arguments.of("permitAll", HttpMethod.GET, "/api/health", Caller.INSTRUCTOR, Outcome.ALLOWED),
				Arguments.of("permitAll", HttpMethod.POST, "/api/auth/register", Caller.NONE, Outcome.ALLOWED),
				Arguments.of("permitAll", HttpMethod.POST, "/api/auth/register", Caller.STUDENT, Outcome.ALLOWED),
				Arguments.of("permitAll", HttpMethod.POST, "/api/auth/register", Caller.INSTRUCTOR, Outcome.ALLOWED),
				Arguments.of("permitAll", HttpMethod.POST, "/api/auth/login", Caller.NONE, Outcome.ALLOWED),
				Arguments.of("permitAll", HttpMethod.POST, "/api/auth/login", Caller.STUDENT, Outcome.ALLOWED),
				Arguments.of("permitAll", HttpMethod.POST, "/api/auth/login", Caller.INSTRUCTOR, Outcome.ALLOWED),
				Arguments.of("permitAll", HttpMethod.OPTIONS, "/api/admin", Caller.NONE, Outcome.ALLOWED),
				Arguments.of("permitAll", HttpMethod.OPTIONS, "/api/admin", Caller.STUDENT, Outcome.ALLOWED),
				Arguments.of("permitAll", HttpMethod.OPTIONS, "/api/admin", Caller.INSTRUCTOR, Outcome.ALLOWED),
				Arguments.of("permitAll", HttpMethod.OPTIONS, "/api/instructor/activities", Caller.STUDENT,
						Outcome.ALLOWED),
				Arguments.of("permitAll", HttpMethod.OPTIONS, "/api/activities", Caller.INSTRUCTOR, Outcome.ALLOWED),
				// Register and login are public for POST only; other methods fall through to denyAll.
				Arguments.of("denyAll", HttpMethod.GET, "/api/auth/login", Caller.NONE, Outcome.UNAUTHORIZED),
				Arguments.of("denyAll", HttpMethod.GET, "/api/auth/login", Caller.STUDENT, Outcome.FORBIDDEN),
				Arguments.of("denyAll", HttpMethod.GET, "/api/auth/register", Caller.INSTRUCTOR, Outcome.FORBIDDEN),
				// /api/auth/me: any authenticated user.
				Arguments.of("authenticated", HttpMethod.GET, "/api/auth/me", Caller.NONE, Outcome.UNAUTHORIZED),
				Arguments.of("authenticated", HttpMethod.GET, "/api/auth/me", Caller.STUDENT, Outcome.ALLOWED),
				Arguments.of("authenticated", HttpMethod.GET, "/api/auth/me", Caller.INSTRUCTOR, Outcome.ALLOWED),
				// /api/instructor/**: INSTRUCTOR only.
				Arguments.of("instructor", HttpMethod.GET, "/api/instructor/activities", Caller.NONE,
						Outcome.UNAUTHORIZED),
				Arguments.of("instructor", HttpMethod.GET, "/api/instructor/activities", Caller.STUDENT,
						Outcome.FORBIDDEN),
				Arguments.of("instructor", HttpMethod.GET, "/api/instructor/activities", Caller.INSTRUCTOR,
						Outcome.ALLOWED),
				Arguments.of("instructor", HttpMethod.POST, "/api/instructor/activities/1/publish", Caller.STUDENT,
						Outcome.FORBIDDEN),
				Arguments.of("instructor", HttpMethod.POST, "/api/instructor/activities/1/publish",
						Caller.INSTRUCTOR, Outcome.ALLOWED),
				Arguments.of("instructor", HttpMethod.GET, "/api/instructor", Caller.STUDENT, Outcome.FORBIDDEN),
				Arguments.of("instructor", HttpMethod.GET, "/api/instructor", Caller.INSTRUCTOR, Outcome.ALLOWED),
				// /api/activities/**, /api/sessions/**, /api/me/**: STUDENT only.
				Arguments.of("student", HttpMethod.GET, "/api/activities", Caller.NONE, Outcome.UNAUTHORIZED),
				Arguments.of("student", HttpMethod.GET, "/api/activities", Caller.STUDENT, Outcome.ALLOWED),
				Arguments.of("student", HttpMethod.GET, "/api/activities", Caller.INSTRUCTOR, Outcome.FORBIDDEN),
				Arguments.of("student", HttpMethod.GET, "/api/activities/1", Caller.STUDENT, Outcome.ALLOWED),
				Arguments.of("student", HttpMethod.GET, "/api/activities/1", Caller.INSTRUCTOR, Outcome.FORBIDDEN),
				Arguments.of("student", HttpMethod.POST, "/api/sessions/1/events", Caller.NONE,
						Outcome.UNAUTHORIZED),
				Arguments.of("student", HttpMethod.POST, "/api/sessions/1/events", Caller.STUDENT, Outcome.ALLOWED),
				Arguments.of("student", HttpMethod.POST, "/api/sessions/1/events", Caller.INSTRUCTOR,
						Outcome.FORBIDDEN),
				Arguments.of("student", HttpMethod.GET, "/api/me/sessions", Caller.NONE, Outcome.UNAUTHORIZED),
				Arguments.of("student", HttpMethod.GET, "/api/me/sessions", Caller.STUDENT, Outcome.ALLOWED),
				Arguments.of("student", HttpMethod.GET, "/api/me/sessions", Caller.INSTRUCTOR, Outcome.FORBIDDEN),
				// Any other /api/**: denyAll, including near-miss prefixes.
				Arguments.of("denyAll", HttpMethod.GET, "/api/admin", Caller.NONE, Outcome.UNAUTHORIZED),
				Arguments.of("denyAll", HttpMethod.GET, "/api/admin", Caller.STUDENT, Outcome.FORBIDDEN),
				Arguments.of("denyAll", HttpMethod.GET, "/api/admin", Caller.INSTRUCTOR, Outcome.FORBIDDEN),
				Arguments.of("denyAll", HttpMethod.GET, "/api/activitiesx", Caller.STUDENT, Outcome.FORBIDDEN),
				Arguments.of("denyAll", HttpMethod.GET, "/api/instructors", Caller.INSTRUCTOR, Outcome.FORBIDDEN),
				Arguments.of("denyAll", HttpMethod.GET, "/api/auth/other", Caller.STUDENT, Outcome.FORBIDDEN));
	}

	@ParameterizedTest(name = "{0}: {1} {2} as {3} -> {4}")
	@MethodSource("rules")
	void pathRule(String rule, HttpMethod method, String path, Caller caller, Outcome outcome) throws Exception {
		MockHttpServletRequestBuilder request = request(method, path)
				.header(HttpHeaders.ACCEPT, "application/json, application/problem+json");
		if (method == HttpMethod.POST) {
			// An empty object fails validation on register and login, so no user or token is created.
			request.contentType(MediaType.APPLICATION_JSON).content("{}");
		}
		String token = switch (caller) {
			case NONE -> null;
			case STUDENT -> this.studentToken;
			case INSTRUCTOR -> this.instructorToken;
		};
		if (token != null) {
			request.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
		}

		switch (outcome) {
			case UNAUTHORIZED -> this.mockMvc.perform(request)
					.andExpect(status().isUnauthorized())
					.andExpect(content().string(""));
			case FORBIDDEN -> this.mockMvc.perform(request)
					.andExpect(status().isForbidden())
					.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
					.andExpect(jsonPath("$.status").value(403))
					.andExpect(jsonPath("$.detail").value(DENIED_DETAIL));
			case ALLOWED -> {
				MvcResult result = this.mockMvc.perform(request).andReturn();
				assertThat(result.getResponse().getStatus()).isNotIn(401, 403);
			}
		}
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
