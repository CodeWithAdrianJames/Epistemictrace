package com.episteme.epistemictrace.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.Set;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;

class JwtPropertiesTests {

	private static final ValidatorFactory validatorFactory = Validation.buildDefaultValidatorFactory();

	private static final Validator validator = validatorFactory.getValidator();

	private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
			.withUserConfiguration(PropertiesConfig.class);

	@AfterAll
	static void closeValidatorFactory() {
		validatorFactory.close();
	}

	@Test
	void tenByteSecretFailsValidation() {
		assertThat(validate("0123456789")).isNotEmpty();
	}

	@Test
	void thirtyTwoByteSecretPassesValidation() {
		assertThat(validate("0123456789abcdef0123456789abcdef")).isEmpty();
	}

	@Test
	void secretLengthIsCountedInUtf8Bytes() {
		// 11 characters, 33 bytes.
		assertThat(validate("€€€€€€€€€€€")).isEmpty();
	}

	@Test
	void startupFailsWithClearMessageWhenSecretIsTooShort() {
		contextRunner.withPropertyValues("epistemictrace.jwt.secret=too-short")
				.run(context -> {
					assertThat(context).hasFailed();
					assertThat(context.getStartupFailure())
							.rootCause()
							.hasMessageContaining("must be at least 32 bytes when UTF-8 encoded");
				});
	}

	@Test
	void ttlDefaultsToEightHours() {
		contextRunner.withPropertyValues("epistemictrace.jwt.secret=0123456789abcdef0123456789abcdef")
				.run(context -> assertThat(context.getBean(JwtProperties.class).ttl())
						.isEqualTo(Duration.ofHours(8)));
	}

	private static Set<ConstraintViolation<JwtProperties>> validate(String secret) {
		return validator.validate(new JwtProperties(secret, Duration.ofHours(8)));
	}

	@Configuration
	@EnableConfigurationProperties(JwtProperties.class)
	static class PropertiesConfig {

	}

}
