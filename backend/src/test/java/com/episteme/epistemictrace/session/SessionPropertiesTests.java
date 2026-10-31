package com.episteme.epistemictrace.session;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;

import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;

class SessionPropertiesTests {

	private static final String RESUME_WINDOW = "epistemictrace.session.resume-window=";

	private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
		.withUserConfiguration(PropertiesConfig.class);

	@Test
	void bindsAnIsoDuration() {
		this.contextRunner.withPropertyValues(RESUME_WINDOW + "PT30M")
			.run(context -> assertThat(context.getBean(SessionProperties.class).resumeWindow())
				.isEqualTo(Duration.ofMinutes(30)));
	}

	@Test
	void bindsASimpleDuration() {
		this.contextRunner.withPropertyValues(RESUME_WINDOW + "45m")
			.run(context -> assertThat(context.getBean(SessionProperties.class).resumeWindow())
				.isEqualTo(Duration.ofMinutes(45)));
	}

	@Test
	void acceptsAZeroWindow() {
		this.contextRunner.withPropertyValues(RESUME_WINDOW + "PT0S")
			.run(context -> assertThat(context.getBean(SessionProperties.class).resumeWindow())
				.isEqualTo(Duration.ZERO));
	}

	@Test
	void startupFailsWhenTheWindowIsMissing() {
		this.contextRunner.run(context -> {
			assertThat(context).hasFailed();
			assertThat(context.getStartupFailure()).rootCause().hasMessageContaining("epistemictrace.session");
		});
	}

	@Test
	void startupFailsWhenTheWindowIsNegative() {
		this.contextRunner.withPropertyValues(RESUME_WINDOW + "-PT1M")
			.run(context -> assertThat(context).hasFailed());
	}

	@Configuration
	@EnableConfigurationProperties(SessionProperties.class)
	static class PropertiesConfig {

	}

}
