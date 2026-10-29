package com.episteme.epistemictrace.config;

import java.nio.charset.StandardCharsets;
import java.time.Duration;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties("epistemictrace.jwt")
public record JwtProperties(@NotBlank String secret, @NotNull @DefaultValue("PT8H") Duration ttl) {

	/** HS256 needs a key of at least 256 bits. */
	public static final int MIN_SECRET_BYTES = 32;

	@AssertTrue(message = "epistemictrace.jwt.secret (JWT_SECRET) must be at least 32 bytes when UTF-8 encoded")
	public boolean isSecretLongEnough() {
		return secret != null && secret.getBytes(StandardCharsets.UTF_8).length >= MIN_SECRET_BYTES;
	}

}
