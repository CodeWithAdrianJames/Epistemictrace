package com.episteme.epistemictrace.config;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;

import com.episteme.epistemictrace.user.Role;

/**
 * The authenticated user of the current request, read from the verified JWT. Controllers use it and pass
 * {@link #id()} to services as a method argument; services never read the security context themselves.
 */
@Component
public class CurrentUser {

	/**
	 * The {@code sub} claim as a user id. Throws {@link IllegalStateException} outside an authenticated request
	 * or when {@code sub} is not a number; {@code TokenService} only issues numeric subjects.
	 */
	public long id() {
		String subject = jwt().getSubject();
		try {
			return Long.parseLong(subject);
		}
		catch (NumberFormatException ex) {
			throw new IllegalStateException("The token subject is not a user id.", ex);
		}
	}

	/** The {@code role} claim, already checked by {@link JwtRoleConverter} during authentication. */
	public Role role() {
		return JwtRoleConverter.roleOf(jwt());
	}

	private static Jwt jwt() {
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		if (authentication instanceof JwtAuthenticationToken token) {
			return token.getToken();
		}
		throw new IllegalStateException("No authenticated JWT in the security context.");
	}

}
