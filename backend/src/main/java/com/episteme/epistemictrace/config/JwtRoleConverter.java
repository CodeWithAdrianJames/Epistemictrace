package com.episteme.epistemictrace.config;

import java.util.Collection;
import java.util.List;

import org.springframework.core.convert.converter.Converter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.InvalidBearerTokenException;

import com.episteme.epistemictrace.user.Role;

/**
 * Maps the {@code role} claim to exactly one authority, {@code ROLE_STUDENT} or {@code ROLE_INSTRUCTOR}.
 * A missing, non-string or unknown role (names are case-sensitive) throws {@link InvalidBearerTokenException},
 * which the resource server filter turns into a {@code 401}.
 */
public class JwtRoleConverter implements Converter<Jwt, Collection<GrantedAuthority>> {

	static final String ROLE_CLAIM = "role";

	private static final String AUTHORITY_PREFIX = "ROLE_";

	@Override
	public Collection<GrantedAuthority> convert(Jwt jwt) {
		return List.of(new SimpleGrantedAuthority(AUTHORITY_PREFIX + roleOf(jwt).name()));
	}

	static Role roleOf(Jwt jwt) {
		if (jwt.getClaims().get(ROLE_CLAIM) instanceof String value) {
			for (Role role : Role.values()) {
				if (role.name().equals(value)) {
					return role;
				}
			}
		}
		throw new InvalidBearerTokenException("The token has no valid role claim.");
	}

}
