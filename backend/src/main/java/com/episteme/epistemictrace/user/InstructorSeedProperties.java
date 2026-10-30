package com.episteme.epistemictrace.user;

import java.nio.charset.StandardCharsets;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.StringUtils;
import org.springframework.validation.annotation.Validated;

/**
 * Instructor account created at start-up, bound from {@code INSTRUCTOR_SEED_EMAIL}, {@code INSTRUCTOR_SEED_PASSWORD}
 * and {@code INSTRUCTOR_SEED_NAME}. Every value is optional; seeding happens only when email and password are both
 * set. Set values follow the register rules (spec 05 R1). The password is checked with {@link AssertTrue} only, so a
 * start-up failure never prints its value.
 */
@Validated
@ConfigurationProperties("epistemictrace.seed.instructor")
public record InstructorSeedProperties(
		@Email @Size(max = 254) String email,
		String password,
		@Size(max = 100) String name) {

	/** Used when {@code INSTRUCTOR_SEED_NAME} is unset or blank. */
	public static final String DEFAULT_NAME = "Instructor";

	public InstructorSeedProperties {
		email = (email != null) ? email.strip() : null;
		name = StringUtils.hasText(name) ? name.strip() : DEFAULT_NAME;
	}

	/** True when email and password are both set. */
	public boolean isComplete() {
		return StringUtils.hasText(this.email) && StringUtils.hasText(this.password);
	}

	@AssertTrue(message = "epistemictrace.seed.instructor.password (INSTRUCTOR_SEED_PASSWORD) must be 8-72 characters "
			+ "and at most 72 bytes when UTF-8 encoded")
	public boolean isPasswordValid() {
		if (!StringUtils.hasText(this.password)) {
			return true;
		}
		int length = this.password.length();
		return length >= 8 && length <= 72 && this.password.getBytes(StandardCharsets.UTF_8).length <= 72;
	}

	@Override
	public String toString() {
		return "InstructorSeedProperties[email=" + this.email + ", password=" + (StringUtils.hasText(this.password) ? "[set]" : "[unset]")
				+ ", name=" + this.name + "]";
	}

}
