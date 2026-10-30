package com.episteme.epistemictrace.user;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
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
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.support.ResourcePropertySource;
import org.springframework.mock.env.MockEnvironment;

class InstructorSeedPropertiesTests {

	private static final ValidatorFactory validatorFactory = Validation.buildDefaultValidatorFactory();

	private static final Validator validator = validatorFactory.getValidator();

	private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
			.withUserConfiguration(PropertiesConfig.class);

	@AfterAll
	static void closeValidatorFactory() {
		validatorFactory.close();
	}

	@Test
	void unsetValuesAreValidAndIncomplete() {
		InstructorSeedProperties unset = new InstructorSeedProperties(null, null, null);
		InstructorSeedProperties empty = new InstructorSeedProperties("", "", "");

		assertThat(validator.validate(unset)).isEmpty();
		assertThat(validator.validate(empty)).isEmpty();
		assertThat(unset.isComplete()).isFalse();
		assertThat(empty.isComplete()).isFalse();
	}

	@Test
	void completeOnlyWhenEmailAndPasswordAreBothSet() {
		assertThat(new InstructorSeedProperties("instructor1@example.test", "", null).isComplete()).isFalse();
		assertThat(new InstructorSeedProperties("  ", "instructor-password", null).isComplete()).isFalse();
		assertThat(new InstructorSeedProperties("instructor1@example.test", "instructor-password", null).isComplete())
				.isTrue();
	}

	@Test
	void emailAndNameAreTrimmedAndBlankNameUsesDefault() {
		InstructorSeedProperties named = new InstructorSeedProperties("  Instructor1@Example.test ", "instructor-password",
				"  Instructor One  ");
		InstructorSeedProperties unnamed = new InstructorSeedProperties("instructor1@example.test", "instructor-password",
				"   ");

		assertThat(named.email()).isEqualTo("Instructor1@Example.test");
		assertThat(named.name()).isEqualTo("Instructor One");
		assertThat(unnamed.name()).isEqualTo(InstructorSeedProperties.DEFAULT_NAME);
	}

	@Test
	void passwordFollowsRegisterLimits() {
		assertThat(validate("1234567")).isNotEmpty();
		assertThat(validate("12345678")).isEmpty();
		assertThat(validate("a".repeat(72))).isEmpty();
		assertThat(validate("a".repeat(73))).isNotEmpty();
		// 72 characters, 144 bytes.
		assertThat(validate("é".repeat(72))).isNotEmpty();
	}

	@Test
	void invalidEmailAndLongNameFailValidation() {
		assertThat(validator.validate(new InstructorSeedProperties("not-an-email", "instructor-password", null)))
				.isNotEmpty();
		assertThat(validator.validate(new InstructorSeedProperties("a".repeat(243) + "@example.test",
				"instructor-password", null))).isNotEmpty();
		assertThat(validator.validate(new InstructorSeedProperties("instructor1@example.test", "instructor-password",
				"a".repeat(101)))).isNotEmpty();
	}

	@Test
	void startupFailsWithoutPrintingTheInvalidPassword() {
		contextRunner.withPropertyValues("epistemictrace.seed.instructor.email=instructor1@example.test",
				"epistemictrace.seed.instructor.password=short-1")
				.run(context -> {
					assertThat(context).hasFailed();
					Throwable failure = context.getStartupFailure();
					assertThat(failure).rootCause().hasMessageContaining("INSTRUCTOR_SEED_PASSWORD");
					for (Throwable cause = failure; cause != null; cause = cause.getCause()) {
						assertThat(String.valueOf(cause.getMessage())).doesNotContain("short-1");
					}
				});
	}

	@Test
	void toStringNeverContainsThePassword() {
		InstructorSeedProperties properties = new InstructorSeedProperties("instructor1@example.test",
				"instructor-password", null);

		assertThat(properties.toString()).contains("instructor1@example.test").doesNotContain("instructor-password");
	}

	@Test
	void applicationPropertiesBindTheInstructorSeedVariables() throws IOException {
		MockEnvironment environment = environmentWithApplicationProperties();
		environment.setProperty("INSTRUCTOR_SEED_EMAIL", "instructor1@example.test");
		environment.setProperty("INSTRUCTOR_SEED_PASSWORD", "instructor-password");
		environment.setProperty("INSTRUCTOR_SEED_NAME", "Instructor One");

		assertThat(environment.getProperty("epistemictrace.seed.instructor.email")).isEqualTo("instructor1@example.test");
		assertThat(environment.getProperty("epistemictrace.seed.instructor.password")).isEqualTo("instructor-password");
		assertThat(environment.getProperty("epistemictrace.seed.instructor.name")).isEqualTo("Instructor One");
	}

	@Test
	void applicationPropertiesLeaveSeedValuesEmptyWhenVariablesAreUnset() throws IOException {
		MockEnvironment environment = environmentWithApplicationProperties();

		assertThat(environment.getProperty("epistemictrace.seed.instructor.email")).isEmpty();
		assertThat(environment.getProperty("epistemictrace.seed.instructor.password")).isEmpty();
		assertThat(environment.getProperty("epistemictrace.seed.instructor.name")).isEmpty();
	}

	private static MockEnvironment environmentWithApplicationProperties() throws IOException {
		// No system environment or system properties, so the developer's own variables cannot leak in.
		MockEnvironment environment = new MockEnvironment();
		environment.getPropertySources()
				.addLast(new ResourcePropertySource(new ClassPathResource("application.properties")));
		return environment;
	}

	private static Set<ConstraintViolation<InstructorSeedProperties>> validate(String password) {
		return validator.validate(new InstructorSeedProperties("instructor1@example.test", password, null));
	}

	@Configuration
	@EnableConfigurationProperties(InstructorSeedProperties.class)
	static class PropertiesConfig {

	}

}
