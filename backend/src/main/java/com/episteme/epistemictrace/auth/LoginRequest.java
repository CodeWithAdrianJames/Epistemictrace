package com.episteme.epistemictrace.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * Body of {@code POST /api/auth/login}. No format or length rules beyond presence: a value that could never
 * have been registered simply fails to match and gets the same {@code 401} as any wrong password.
 */
public record LoginRequest(@NotBlank String email, @NotNull String password) {
}
