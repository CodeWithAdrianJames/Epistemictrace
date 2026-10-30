package com.episteme.epistemictrace.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

import javax.crypto.spec.SecretKeySpec;

import jakarta.servlet.Filter;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.ExceptionTranslationFilter;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;

import com.jayway.jsonpath.JsonPath;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SecurityConfigTests {

	private static final String ALLOWED_ORIGIN = "http://localhost:5173";

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private JwtEncoder jwtEncoder;

	@Autowired
	private SecurityFilterChain securityFilterChain;

	@Autowired
	private ProblemDetailAccessDeniedHandler accessDeniedHandler;

	@Test
	void healthIsPublic() throws Exception {
		mockMvc.perform(get("/api/health"))
				.andExpect(status().isOk());
	}

	@Test
	void protectedPathWithoutTokenReturns401WithoutHtmlBody() throws Exception {
		mockMvc.perform(get("/api/anything-else"))
				.andExpect(status().isUnauthorized())
				.andExpect(content().string(""));
	}

	@Test
	void studentTokenSignedByTestEncoderPassesAuthentication() throws Exception {
		mockMvc.perform(get("/api/anything-else")
						.header(HttpHeaders.AUTHORIZATION, "Bearer " + token(jwtEncoder, "STUDENT")))
				.andExpect(status().isNotFound());
	}

	@Test
	void instructorTokenSignedByTestEncoderPassesAuthentication() throws Exception {
		mockMvc.perform(get("/api/anything-else")
						.header(HttpHeaders.AUTHORIZATION, "Bearer " + token(jwtEncoder, "INSTRUCTOR")))
				.andExpect(status().isNotFound());
	}

	@Test
	void tokenWithoutRoleClaimReturns401() throws Exception {
		mockMvc.perform(get("/api/anything-else")
						.header(HttpHeaders.AUTHORIZATION, "Bearer " + token(jwtEncoder, null)))
				.andExpect(status().isUnauthorized());
	}

	@Test
	void tokenWithUnknownRoleReturns401() throws Exception {
		mockMvc.perform(get("/api/anything-else")
						.header(HttpHeaders.AUTHORIZATION, "Bearer " + token(jwtEncoder, "ADMIN")))
				.andExpect(status().isUnauthorized());
	}

	@Test
	void securityFilterChainUsesProblemDetailAccessDeniedHandler() {
		ExceptionTranslationFilter exceptionTranslationFilter = null;
		for (Filter filter : securityFilterChain.getFilters()) {
			if (filter instanceof ExceptionTranslationFilter candidate) {
				exceptionTranslationFilter = candidate;
			}
		}

		assertThat(exceptionTranslationFilter).isNotNull();
		assertThat(ReflectionTestUtils.getField(exceptionTranslationFilter, "accessDeniedHandler"))
				.isSameAs(accessDeniedHandler);
	}

	@Test
	void accessDeniedReturns403ProblemDetail() throws Exception {
		MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/instructor/activities");
		request.addHeader(HttpHeaders.ACCEPT, "application/json, application/problem+json");
		MockHttpServletResponse response = new MockHttpServletResponse();

		accessDeniedHandler.handle(request, response, new AccessDeniedException("internal detail"));

		assertThat(response.getStatus()).isEqualTo(403);
		assertThat(MediaType.parseMediaType(response.getContentType()))
				.isEqualTo(MediaType.APPLICATION_PROBLEM_JSON);
		String body = response.getContentAsString();
		assertThat((Integer) JsonPath.read(body, "$.status")).isEqualTo(403);
		assertThat((String) JsonPath.read(body, "$.detail")).isEqualTo("You don't have access to this.");
		assertThat(body).doesNotContain("internal detail");
	}

	@Test
	void tokenSignedWithAnotherSecretReturns401() throws Exception {
		JwtEncoder otherEncoder = NimbusJwtEncoder
				.withSecretKey(new SecretKeySpec(
						"another-secret-that-is-32-bytes-long!!".getBytes(StandardCharsets.UTF_8), "HmacSHA256"))
				.algorithm(MacAlgorithm.HS256)
				.build();

		mockMvc.perform(get("/api/anything-else")
						.header(HttpHeaders.AUTHORIZATION, "Bearer " + token(otherEncoder, "STUDENT")))
				.andExpect(status().isUnauthorized());
	}

	@Test
	void preflightFromAllowedOriginSucceeds() throws Exception {
		mockMvc.perform(options("/api/auth/login")
						.header(HttpHeaders.ORIGIN, ALLOWED_ORIGIN)
						.header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST")
						.header(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "authorization,content-type"))
				.andExpect(status().isOk())
				.andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, ALLOWED_ORIGIN));
	}

	@Test
	void preflightFromOtherOriginGetsNoCorsHeaders() throws Exception {
		mockMvc.perform(options("/api/auth/login")
						.header(HttpHeaders.ORIGIN, "http://evil.example")
						.header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST"))
				.andExpect(header().doesNotExist(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN));
	}

	@Test
	void corsHeadersAreAddedBeforeAuthentication() throws Exception {
		mockMvc.perform(get("/api/anything-else")
						.header(HttpHeaders.ORIGIN, ALLOWED_ORIGIN))
				.andExpect(status().isUnauthorized())
				.andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, ALLOWED_ORIGIN));
	}

	/** A {@code null} role leaves the role claim out. */
	private static String token(JwtEncoder encoder, String role) {
		Instant now = Instant.now();
		JwtClaimsSet.Builder claims = JwtClaimsSet.builder()
				.subject("1")
				.issuedAt(now)
				.expiresAt(now.plus(5, ChronoUnit.MINUTES));
		if (role != null) {
			claims.claim("role", role);
		}
		return encoder.encode(JwtEncoderParameters.from(claims.build())).getTokenValue();
	}

}
