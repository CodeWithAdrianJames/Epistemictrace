package com.episteme.epistemictrace.session;

import java.time.Duration;

import jakarta.validation.constraints.NotNull;

import org.hibernate.validator.constraints.time.DurationMin;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Session settings (spec 16, Q15). Set in {@code application.properties}, not in code. A session that ended at most
 * {@code resumeWindow} ago is resumed instead of replaced; zero resumes only sessions that were never ended.
 */
@Validated
@ConfigurationProperties("epistemictrace.session")
public record SessionProperties(@NotNull @DurationMin(nanos = 0) Duration resumeWindow) {

}
