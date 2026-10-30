package com.episteme.epistemictrace.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Collection;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.InvalidBearerTokenException;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;

import com.episteme.epistemictrace.user.Role;

class JwtRoleConverterTests {

	private final JwtRoleConverter converter = new JwtRoleConverter();

	@Test
	void studentRoleMapsToRoleStudent() {
		assertThat(authorities(this.converter.convert(jwtWithRole("STUDENT")))).containsExactly("ROLE_STUDENT");
	}

	@Test
	void instructorRoleMapsToRoleInstructor() {
		assertThat(authorities(this.converter.convert(jwtWithRole("INSTRUCTOR")))).containsExactly("ROLE_INSTRUCTOR");
	}

	@Test
	void roleOfReturnsTheEnumValue() {
		assertThat(JwtRoleConverter.roleOf(jwtWithRole("STUDENT"))).isEqualTo(Role.STUDENT);
		assertThat(JwtRoleConverter.roleOf(jwtWithRole("INSTRUCTOR"))).isEqualTo(Role.INSTRUCTOR);
	}

	@Test
	void missingRoleIsRejected() {
		Jwt jwt = jwtBuilder().build();

		assertThatThrownBy(() -> this.converter.convert(jwt)).isInstanceOf(InvalidBearerTokenException.class);
	}

	@Test
	void unknownRoleIsRejected() {
		assertThatThrownBy(() -> this.converter.convert(jwtWithRole("ADMIN")))
				.isInstanceOf(InvalidBearerTokenException.class);
	}

	@Test
	void roleWithDifferentCaseIsRejected() {
		assertThatThrownBy(() -> this.converter.convert(jwtWithRole("student")))
				.isInstanceOf(InvalidBearerTokenException.class);
	}

	@Test
	void blankRoleIsRejected() {
		assertThatThrownBy(() -> this.converter.convert(jwtWithRole("")))
				.isInstanceOf(InvalidBearerTokenException.class);
	}

	@Test
	void nonStringRoleIsRejected() {
		Jwt jwt = jwtBuilder().claim(JwtRoleConverter.ROLE_CLAIM, List.of("STUDENT")).build();

		assertThatThrownBy(() -> this.converter.convert(jwt)).isInstanceOf(InvalidBearerTokenException.class);
	}

	@Test
	void authenticationConverterBeanAddsExactlyOneRoleAndKeepsJwtPrincipal() {
		JwtAuthenticationConverter authenticationConverter = new SecurityConfig().jwtAuthenticationConverter();
		Jwt jwt = jwtWithRole("INSTRUCTOR");

		AbstractAuthenticationToken authentication = authenticationConverter.convert(jwt);

		// Spring Security 7 also adds the FACTOR_BEARER authority; it is not a role.
		assertThat(authorities(authentication.getAuthorities()))
				.filteredOn(authority -> authority.startsWith("ROLE_"))
				.containsExactly("ROLE_INSTRUCTOR");
		// Spring Security 7 wraps the token in a Jwt subclass, so @AuthenticationPrincipal Jwt still resolves.
		assertThat(authentication.getPrincipal()).isInstanceOfSatisfying(Jwt.class,
				principal -> assertThat(principal.getTokenValue()).isEqualTo(jwt.getTokenValue()));
		assertThat(authentication.getName()).isEqualTo("42");
	}

	@Test
	void authenticationConverterBeanRejectsTokenWithoutRole() {
		JwtAuthenticationConverter authenticationConverter = new SecurityConfig().jwtAuthenticationConverter();
		Jwt jwt = jwtBuilder().build();

		assertThatThrownBy(() -> authenticationConverter.convert(jwt))
				.isInstanceOf(InvalidBearerTokenException.class);
	}

	private static Jwt jwtWithRole(String role) {
		return jwtBuilder().claim(JwtRoleConverter.ROLE_CLAIM, role).build();
	}

	private static Jwt.Builder jwtBuilder() {
		Instant now = Instant.now();
		return Jwt.withTokenValue("token")
				.header("alg", "HS256")
				.subject("42")
				.issuedAt(now)
				.expiresAt(now.plus(5, ChronoUnit.MINUTES));
	}

	private static List<String> authorities(Collection<? extends GrantedAuthority> authorities) {
		return authorities.stream().map(GrantedAuthority::getAuthority).toList();
	}

}
