package com.episteme.epistemictrace.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Duration;
import java.time.Instant;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import com.episteme.epistemictrace.user.Role;
import com.episteme.epistemictrace.user.UserRepository;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthControllerTests {

	private static final String PASSWORD = "correct-horse-battery";

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private PasswordEncoder passwordEncoder;

	@Autowired
	private JwtDecoder jwtDecoder;

	@AfterEach
	void deleteUsers() {
		this.userRepository.deleteAll();
	}

	@Test
	void registerCreatesStudentWithBcryptHash() throws Exception {
		register("""
				{"name": "  Student One  ", "email": "  Student1@Example.TEST ", "password": "%s"}
				""".formatted(PASSWORD))
				.andExpect(status().isCreated())
				.andExpect(content().contentType(MediaType.APPLICATION_JSON))
				.andExpect(jsonPath("$.id").isNumber())
				.andExpect(jsonPath("$.name").value("Student One"))
				.andExpect(jsonPath("$.email").value("student1@example.test"))
				.andExpect(jsonPath("$.role").value("STUDENT"))
				.andExpect(jsonPath("$.password").doesNotExist())
				.andExpect(jsonPath("$.passwordHash").doesNotExist());

		assertThat(this.userRepository.findByEmail("student1@example.test")).hasValueSatisfying(user -> {
			assertThat(user.getName()).isEqualTo("Student One");
			assertThat(user.getRole()).isEqualTo(Role.STUDENT);
			assertThat(user.getConsentAcceptedAt()).isNull();
			assertThat(user.getPasswordHash()).isNotEqualTo(PASSWORD).startsWith("$2a$10$");
			assertThat(this.passwordEncoder.matches(PASSWORD, user.getPasswordHash())).isTrue();
		});
	}

	@Test
	void registerWithSameEmailInAnyCaseReturns409() throws Exception {
		register(body("Student One", "student1@example.test", PASSWORD))
				.andExpect(status().isCreated());

		register(body("Student Two", "STUDENT1@Example.Test", PASSWORD))
				.andExpect(status().isConflict())
				.andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
				.andExpect(jsonPath("$.status").value(409))
				.andExpect(jsonPath("$.detail").value("An account with this email already exists."));
		register(body("Student Three", "  student1@example.test  ", PASSWORD))
				.andExpect(status().isConflict());

		assertThat(this.userRepository.count()).isEqualTo(1);
	}

	@Test
	void registerIgnoresRoleField() throws Exception {
		register("""
				{"name": "Student One", "email": "student1@example.test", "password": "%s", "role": "INSTRUCTOR"}
				""".formatted(PASSWORD))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.role").value("STUDENT"));

		assertThat(this.userRepository.findByEmail("student1@example.test"))
				.hasValueSatisfying(user -> assertThat(user.getRole()).isEqualTo(Role.STUDENT));
	}

	@Test
	void registerWithInvalidEmailReturns400() throws Exception {
		register(body("Student One", "not-an-email", PASSWORD))
				.andExpect(status().isBadRequest())
				.andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
				.andExpect(jsonPath("$.status").value(400))
				.andExpect(jsonPath("$.errors.email").isNotEmpty());

		assertThat(this.userRepository.count()).isZero();
	}

	@Test
	void registerWithEmailOver254CharactersReturns400() throws Exception {
		String label = "b".repeat(63);
		String email = "a".repeat(64) + "@" + label + "." + label + "." + label + ".test";
		assertThat(email).hasSizeGreaterThan(254);

		register(body("Student One", email, PASSWORD))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errors.email").isNotEmpty());
	}

	@Test
	void registerWithShortPasswordReturns400() throws Exception {
		register(body("Student One", "student1@example.test", "1234567"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errors.password").isNotEmpty());

		assertThat(this.userRepository.count()).isZero();
	}

	@Test
	void registerAcceptsPasswordOf8And72AsciiCharacters() throws Exception {
		register(body("Student One", "student1@example.test", "12345678"))
				.andExpect(status().isCreated());
		register(body("Student Two", "student2@example.test", "p".repeat(72)))
				.andExpect(status().isCreated());
	}

	@Test
	void registerWithPasswordOver72CharactersReturns400() throws Exception {
		register(body("Student One", "student1@example.test", "p".repeat(73)))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errors.password").isNotEmpty());
	}

	@Test
	void registerWithPasswordOver72BytesReturns400() throws Exception {
		// 72 characters but 144 bytes in UTF-8; BCrypt would reject it with an exception.
		register(body("Student One", "student1@example.test", "é".repeat(72)))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errors.password").value("must be at most 72 bytes when UTF-8 encoded"));

		assertThat(this.userRepository.count()).isZero();
	}

	@Test
	void registerWithBlankNameReturns400() throws Exception {
		register(body("   ", "student1@example.test", PASSWORD))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errors.name").isNotEmpty());
	}

	@Test
	void registerChecksNameLengthAfterTrimming() throws Exception {
		register(body("  " + "n".repeat(100) + "  ", "student1@example.test", PASSWORD))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.name").value("n".repeat(100)));
		register(body("n".repeat(101), "student2@example.test", PASSWORD))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errors.name").isNotEmpty());
	}

	@Test
	void registerWithMissingFieldsReturns400() throws Exception {
		register("{}")
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errors.name").isNotEmpty())
				.andExpect(jsonPath("$.errors.email").isNotEmpty())
				.andExpect(jsonPath("$.errors.password").isNotEmpty());
	}

	@Test
	void loginWithCorrectCredentialsReturnsTokenAndUser() throws Exception {
		Long id = registerStudent("Student One", "student1@example.test");
		Instant before = Instant.now();

		String json = login("""
				{"email": "  STUDENT1@Example.Test ", "password": "%s"}
				""".formatted(PASSWORD))
				.andExpect(status().isOk())
				.andExpect(content().contentType(MediaType.APPLICATION_JSON))
				.andExpect(jsonPath("$.token").isString())
				.andExpect(jsonPath("$.expiresAt").isString())
				.andExpect(jsonPath("$.user.id").value(id))
				.andExpect(jsonPath("$.user.name").value("Student One"))
				.andExpect(jsonPath("$.user.email").value("student1@example.test"))
				.andExpect(jsonPath("$.user.role").value("STUDENT"))
				.andExpect(jsonPath("$.user.consentAccepted").value(false))
				.andExpect(jsonPath("$.user.password").doesNotExist())
				.andExpect(jsonPath("$.user.passwordHash").doesNotExist())
				.andReturn().getResponse().getContentAsString();

		Instant expiresAt = Instant.parse(JsonPath.read(json, "$.expiresAt"));
		assertThat(expiresAt).isBetween(before.plus(Duration.ofHours(8)).minusSeconds(1),
				Instant.now().plus(Duration.ofHours(8)));
		Jwt decoded = this.jwtDecoder.decode(JsonPath.read(json, "$.token"));
		assertThat(decoded.getSubject()).isEqualTo(String.valueOf(id));
		assertThat(decoded.getClaimAsString("role")).isEqualTo("STUDENT");
		assertThat(decoded.getClaimAsString("email")).isEqualTo("student1@example.test");
		assertThat(decoded.getExpiresAt()).isEqualTo(expiresAt);
	}

	@Test
	void loginWithWrongPasswordReturns401() throws Exception {
		registerStudent("Student One", "student1@example.test");

		login("""
				{"email": "student1@example.test", "password": "wrong-password"}
				""")
				.andExpect(status().isUnauthorized())
				.andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
				.andExpect(jsonPath("$.status").value(401))
				.andExpect(jsonPath("$.detail").value("Email or password is incorrect."))
				.andExpect(jsonPath("$.token").doesNotExist());
	}

	@Test
	void loginWithUnknownEmailReturns401WithSameDetail() throws Exception {
		registerStudent("Student One", "student1@example.test");

		login("""
				{"email": "nobody@example.test", "password": "%s"}
				""".formatted(PASSWORD))
				.andExpect(status().isUnauthorized())
				.andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
				.andExpect(jsonPath("$.status").value(401))
				.andExpect(jsonPath("$.detail").value("Email or password is incorrect."))
				.andExpect(jsonPath("$.token").doesNotExist());
	}

	@Test
	void loginWithPasswordOver72BytesReturns401() throws Exception {
		registerStudent("Student One", "student1@example.test");

		login("""
				{"email": "student1@example.test", "password": "%s"}
				""".formatted("é".repeat(72)))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.detail").value("Email or password is incorrect."));
	}

	@Test
	void loginWithMissingFieldsReturns400() throws Exception {
		login("{}")
				.andExpect(status().isBadRequest())
				.andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
				.andExpect(jsonPath("$.errors.email").isNotEmpty())
				.andExpect(jsonPath("$.errors.password").isNotEmpty());
	}

	@Test
	void meWithLoginTokenReturnsUserFromDatabase() throws Exception {
		Long id = registerStudent("Student One", "student1@example.test");
		String token = loginToken("student1@example.test");

		this.mockMvc.perform(get("/api/auth/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
				.andExpect(status().isOk())
				.andExpect(content().contentType(MediaType.APPLICATION_JSON))
				.andExpect(jsonPath("$.id").value(id))
				.andExpect(jsonPath("$.name").value("Student One"))
				.andExpect(jsonPath("$.email").value("student1@example.test"))
				.andExpect(jsonPath("$.role").value("STUDENT"))
				.andExpect(jsonPath("$.consentAccepted").value(false))
				.andExpect(jsonPath("$.passwordHash").doesNotExist());
	}

	@Test
	void meWithoutTokenReturns401() throws Exception {
		this.mockMvc.perform(get("/api/auth/me"))
				.andExpect(status().isUnauthorized());
	}

	@Test
	void meWithMalformedTokenReturns401() throws Exception {
		this.mockMvc.perform(get("/api/auth/me").header(HttpHeaders.AUTHORIZATION, "Bearer not-a-jwt"))
				.andExpect(status().isUnauthorized());
	}

	@Test
	void meWithTokenOfDeletedUserReturns401() throws Exception {
		registerStudent("Student One", "student1@example.test");
		String token = loginToken("student1@example.test");
		this.userRepository.deleteAll();

		this.mockMvc.perform(get("/api/auth/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
				.andExpect(status().isUnauthorized())
				.andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
				.andExpect(jsonPath("$.status").value(401))
				.andExpect(jsonPath("$.detail").value("The account for this token no longer exists. Please log in again."));
	}

	private Long registerStudent(String name, String email) throws Exception {
		String json = register(body(name, email, PASSWORD))
				.andExpect(status().isCreated())
				.andReturn().getResponse().getContentAsString();
		return ((Number) JsonPath.read(json, "$.id")).longValue();
	}

	private String loginToken(String email) throws Exception {
		String json = login("""
				{"email": "%s", "password": "%s"}
				""".formatted(email, PASSWORD))
				.andExpect(status().isOk())
				.andReturn().getResponse().getContentAsString();
		return JsonPath.read(json, "$.token");
	}

	private ResultActions login(String json) throws Exception {
		return this.mockMvc.perform(post("/api/auth/login")
				.contentType(MediaType.APPLICATION_JSON)
				.content(json));
	}

	private ResultActions register(String json) throws Exception {
		return this.mockMvc.perform(post("/api/auth/register")
				.contentType(MediaType.APPLICATION_JSON)
				.content(json));
	}

	private static String body(String name, String email, String password) {
		return """
				{"name": "%s", "email": "%s", "password": "%s"}
				""".formatted(name, email, password);
	}

}
