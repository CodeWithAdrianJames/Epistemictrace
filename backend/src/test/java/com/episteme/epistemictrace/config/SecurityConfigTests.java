package com.episteme.epistemictrace.config;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

import javax.crypto.spec.SecretKeySpec;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SecurityConfigTests {

	private static final String ALLOWED_ORIGIN = "http://localhost:5173";

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private JwtEncoder jwtEncoder;

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
	void tokenSignedByTestEncoderPassesAuthentication() throws Exception {
		mockMvc.perform(get("/api/anything-else")
						.header(HttpHeaders.AUTHORIZATION, "Bearer " + token(jwtEncoder)))
				.andExpect(status().isNotFound());
	}

	@Test
	void tokenSignedWithAnotherSecretReturns401() throws Exception {
		JwtEncoder otherEncoder = NimbusJwtEncoder
				.withSecretKey(new SecretKeySpec(
						"another-secret-that-is-32-bytes-long!!".getBytes(StandardCharsets.UTF_8), "HmacSHA256"))
				.algorithm(MacAlgorithm.HS256)
				.build();

		mockMvc.perform(get("/api/anything-else")
						.header(HttpHeaders.AUTHORIZATION, "Bearer " + token(otherEncoder)))
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

	private static String token(JwtEncoder encoder) {
		Instant now = Instant.now();
		JwtClaimsSet claims = JwtClaimsSet.builder()
				.subject("1")
				.issuedAt(now)
				.expiresAt(now.plus(5, ChronoUnit.MINUTES))
				.build();
		return encoder.encode(JwtEncoderParameters.from(claims)).getTokenValue();
	}

}
