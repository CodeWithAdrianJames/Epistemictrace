package com.episteme.epistemictrace.auth;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;

import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.util.ReflectionTestUtils;

import com.episteme.epistemictrace.config.JwtConfig;
import com.episteme.epistemictrace.config.JwtProperties;
import com.episteme.epistemictrace.user.Role;
import com.episteme.epistemictrace.user.User;

class TokenServiceTests {

	// Not the PT8H default, so the test proves the configured TTL is used.
	private static final Duration TTL = Duration.ofMinutes(90);

	private final JwtProperties properties = new JwtProperties("test-only-fake-jwt-secret-0123456789abcdef", TTL);

	private final JwtConfig jwtConfig = new JwtConfig();

	private final TokenService tokenService = new TokenService(this.jwtConfig.jwtEncoder(this.properties),
			this.properties);

	private final JwtDecoder jwtDecoder = this.jwtConfig.jwtDecoder(this.properties);

	@Test
	void decodedClaimsMatchTheUser() {
		Jwt issued = this.tokenService.issue(user(42L, "instructor1@example.test", Role.INSTRUCTOR));

		Jwt decoded = this.jwtDecoder.decode(issued.getTokenValue());

		assertThat(decoded.getHeaders()).containsEntry("alg", "HS256");
		assertThat(decoded.getSubject()).isEqualTo("42");
		assertThat(decoded.getClaimAsString("role")).isEqualTo("INSTRUCTOR");
		assertThat(decoded.getClaimAsString("email")).isEqualTo("instructor1@example.test");
		assertThat(decoded.getClaims()).containsOnlyKeys("sub", "role", "email", "iat", "exp");
	}

	@Test
	void studentRoleClaimIsStudent() {
		Jwt decoded = this.jwtDecoder.decode(
				this.tokenService.issue(user(7L, "student1@example.test", Role.STUDENT)).getTokenValue());

		assertThat(decoded.getClaimAsString("role")).isEqualTo("STUDENT");
	}

	@Test
	void expiryIsIssuedAtPlusConfiguredTtl() {
		Instant before = Instant.now();

		Jwt issued = this.tokenService.issue(user(42L, "student1@example.test", Role.STUDENT));
		Jwt decoded = this.jwtDecoder.decode(issued.getTokenValue());

		assertThat(Duration.between(decoded.getIssuedAt(), decoded.getExpiresAt())).isEqualTo(TTL);
		assertThat(decoded.getIssuedAt()).isBetween(before.minusSeconds(1), Instant.now());
		// The expiry handed to the caller is the one inside the token.
		assertThat(issued.getExpiresAt()).isEqualTo(decoded.getExpiresAt());
	}

	private static User user(long id, String email, Role role) {
		User user = new User("Test User", email, "unused-hash", role);
		ReflectionTestUtils.setField(user, "id", id);
		return user;
	}

}
