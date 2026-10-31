package com.episteme.epistemictrace.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.support.PropertiesLoaderUtils;

/** Spec 22 R7: {@code epistemictrace.reflection} binding and validation ({@code 1 ≤ min ≤ max}). */
class ReflectionPropertiesTests {

	private static final String MIN = "epistemictrace.reflection.min-length=";

	private static final String MAX = "epistemictrace.reflection.max-length=";

	private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
		.withUserConfiguration(PropertiesConfig.class);

	@Test
	void theMainConfigurationHoldsTheQ8Values() throws Exception {
		var properties = PropertiesLoaderUtils.loadProperties(new ClassPathResource("application.properties"));
		this.contextRunner
			.withPropertyValues(MIN + properties.getProperty("epistemictrace.reflection.min-length"),
					MAX + properties.getProperty("epistemictrace.reflection.max-length"))
			.run(context -> assertThat(context.getBean(ReflectionProperties.class))
				.isEqualTo(new ReflectionProperties(20, 2000)));
	}

	@Test
	void minEqualToMaxIsAllowed() {
		this.contextRunner.withPropertyValues(MIN + "5", MAX + "5").run(context -> assertThat(context).hasNotFailed());
	}

	@ParameterizedTest
	@CsvSource({ "0, 2000", "21, 20", "20, 0" })
	void invalidLimitsStopStartup(int min, int max) {
		this.contextRunner.withPropertyValues(MIN + min, MAX + max).run(context -> assertThat(context).hasFailed());
	}

	@Test
	void missingLimitsStopStartup() {
		this.contextRunner.withPropertyValues(MIN + "20").run(context -> assertThat(context).hasFailed());
		this.contextRunner.withPropertyValues(MAX + "2000").run(context -> assertThat(context).hasFailed());
	}

	@Configuration
	@EnableConfigurationProperties(ReflectionProperties.class)
	static class PropertiesConfig {

	}

}
