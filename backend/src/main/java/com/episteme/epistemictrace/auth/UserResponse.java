package com.episteme.epistemictrace.auth;

import com.episteme.epistemictrace.user.Role;
import com.episteme.epistemictrace.user.User;

/** The {@code user} object of {@code POST /api/auth/login} and the body of {@code GET /api/auth/me}. */
public record UserResponse(Long id, String name, String email, Role role, boolean consentAccepted) {

	static UserResponse from(User user) {
		return new UserResponse(user.getId(), user.getName(), user.getEmail(), user.getRole(),
				user.getConsentAcceptedAt() != null);
	}

}
