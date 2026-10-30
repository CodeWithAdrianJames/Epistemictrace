package com.episteme.epistemictrace.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import com.episteme.epistemictrace.common.MaxUtf8Bytes;

/**
 * Body of {@code POST /api/auth/register}. Name and email are trimmed before validation so the
 * length limits apply to the stored values. Any other field in the body (such as {@code role}) is ignored.
 */
public record RegisterRequest(
		@NotBlank @Size(max = 100) String name,
		@NotBlank @Email @Size(max = 254) String email,
		@NotNull @Size(min = 8, max = 72) @MaxUtf8Bytes(72) String password) {

	public RegisterRequest {
		name = (name != null) ? name.strip() : null;
		email = (email != null) ? email.strip() : null;
	}

}
