package com.episteme.epistemictrace.auth;

import java.time.Instant;

public record LoginResponse(String token, Instant expiresAt, UserResponse user) {
}
