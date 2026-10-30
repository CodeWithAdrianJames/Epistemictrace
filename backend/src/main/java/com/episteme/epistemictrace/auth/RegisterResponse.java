package com.episteme.epistemictrace.auth;

import com.episteme.epistemictrace.user.Role;
import com.episteme.epistemictrace.user.User;

public record RegisterResponse(Long id, String name, String email, Role role) {

	static RegisterResponse from(User user) {
		return new RegisterResponse(user.getId(), user.getName(), user.getEmail(), user.getRole());
	}

}
