package com.episteme.epistemictrace.activity;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Values copied into a new activity's {@code sdi_configs} row (spec 08 R3). Set in {@code application.properties},
 * not in code; every value is required and follows the {@code sdi_configs} check constraints, so a missing or
 * out-of-range value fails start-up.
 */
@Validated
@ConfigurationProperties("epistemictrace.sdi.defaults")
public record SdiDefaultsProperties(
		@NotNull @Min(0) @Max(100) Integer threshold,
		@NotNull @Min(0) Integer cooldownSeconds,
		@NotNull @Min(1) Integer windowMinutes) {

}
