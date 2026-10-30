package com.episteme.epistemictrace.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;

import com.episteme.epistemictrace.user.Role;

class CurrentUserTests {

	private final CurrentUser currentUser = new CurrentUser();

	@AfterEach
	void clearSecurityContext() {
		SecurityContextHolder.clearContext();
	}

	@Test
	void studentIdAndRoleComeFromTheJwt() {
		authenticate("7", "STUDENT");

		assertThat(this.currentUser.id()).isEqualTo(7L);
		assertThat(this.currentUser.role()).isEqualTo(Role.STUDENT);
	}

	@Test
	void instructorIdAndRoleComeFromTheJwt() {
		authenticate("42", "INSTRUCTOR");

		assertThat(this.currentUser.id()).isEqualTo(42L);
		assertThat(this.currentUser.role()).isEqualTo(Role.INSTRUCTOR);
	}

	@Test
	void withoutAuthenticationThrows() {
		assertThatThrownBy(this.currentUser::id).isInstanceOf(IllegalStateException.class);
		assertThatThrownBy(this.currentUser::role).isInstanceOf(IllegalStateException.class);
	}

	@Test
	void nonJwtAuthenticationThrows() {
		SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken("user", "password"));

		assertThatThrownBy(this.currentUser::id).isInstanceOf(IllegalStateException.class);
	}

	@Test
	void nonNumericSubjectThrows() {
		authenticate("not-a-number", "STUDENT");

		assertThatThrownBy(this.currentUser::id).isInstanceOf(IllegalStateException.class);
	}

	private static void authenticate(String subject, String role) {
		Instant now = Instant.now();
		Jwt jwt = Jwt.withTokenValue("token")
				.header("alg", "HS256")
				.subject(subject)
				.claim(JwtRoleConverter.ROLE_CLAIM, role)
				.issuedAt(now)
				.expiresAt(now.plus(5, ChronoUnit.MINUTES))
				.build();
		SecurityContextHolder.getContext()
				.setAuthentication(new SecurityConfig().jwtAuthenticationConverter().convert(jwt));
	}

}
