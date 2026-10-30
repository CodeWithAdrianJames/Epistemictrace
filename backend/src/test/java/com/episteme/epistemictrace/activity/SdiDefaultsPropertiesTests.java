package com.episteme.epistemictrace.activity;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.stream.Stream;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;

class SdiDefaultsPropertiesTests {

	private static final String THRESHOLD = "epistemictrace.sdi.defaults.threshold=";

	private static final String COOLDOWN = "epistemictrace.sdi.defaults.cooldown-seconds=";

	private static final String WINDOW = "epistemictrace.sdi.defaults.window-minutes=";

	private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
		.withUserConfiguration(PropertiesConfig.class);

	@Test
	void bindsAllThreeValues() {
		this.contextRunner.withPropertyValues(THRESHOLD + "70", COOLDOWN + "120", WINDOW + "5").run(context -> {
			SdiDefaultsProperties properties = context.getBean(SdiDefaultsProperties.class);
			assertThat(properties.threshold()).isEqualTo(70);
			assertThat(properties.cooldownSeconds()).isEqualTo(120);
			assertThat(properties.windowMinutes()).isEqualTo(5);
		});
	}

	@Test
	void acceptsTheBoundaryValuesOfTheSdiConfigsConstraints() {
		this.contextRunner.withPropertyValues(THRESHOLD + "0", COOLDOWN + "0", WINDOW + "1")
			.run(context -> assertThat(context).hasNotFailed());
		this.contextRunner.withPropertyValues(THRESHOLD + "100", COOLDOWN + "0", WINDOW + "1")
			.run(context -> assertThat(context).hasNotFailed());
	}

	@ParameterizedTest
	@ValueSource(strings = { "threshold", "cooldown-seconds", "window-minutes" })
	void startupFailsWhenAValueIsMissing(String missing) {
		String[] values = Stream.of(THRESHOLD + "70", COOLDOWN + "120", WINDOW + "5")
			.filter(value -> !value.contains("." + missing + "="))
			.toArray(String[]::new);

		this.contextRunner.withPropertyValues(values).run(context -> {
			assertThat(context).hasFailed();
			assertThat(context.getStartupFailure()).rootCause().hasMessageContaining("epistemictrace.sdi.defaults");
		});
	}

	@ParameterizedTest
	@ValueSource(strings = { THRESHOLD + "-1", THRESHOLD + "101", COOLDOWN + "-1", WINDOW + "0" })
	void startupFailsWhenAValueBreaksTheSdiConfigsConstraints(String override) {
		this.contextRunner.withPropertyValues(THRESHOLD + "70", COOLDOWN + "120", WINDOW + "5", override)
			.run(context -> assertThat(context).hasFailed());
	}

	@Configuration
	@EnableConfigurationProperties(SdiDefaultsProperties.class)
	static class PropertiesConfig {

	}

}
