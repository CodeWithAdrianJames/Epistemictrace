package com.episteme.epistemictrace.config;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Reflection length limits in characters after trimming (Q8: at least 20, at most 2000), bound from
 * {@code epistemictrace.reflection}. Used by the breaker payload (spec 22 R7) and reflection validation (spec 24).
 */
@Validated
@ConfigurationProperties("epistemictrace.reflection")
public record ReflectionProperties(@NotNull @Min(1) Integer minLength, @NotNull @Min(1) Integer maxLength) {

	@AssertTrue(message = "min-length must not be greater than max-length")
	public boolean isMinNotAboveMax() {
		return this.minLength == null || this.maxLength == null || this.minLength <= this.maxLength;
	}

}
