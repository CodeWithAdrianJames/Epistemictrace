package com.episteme.epistemictrace.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Properties;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.support.PropertiesLoaderUtils;

import com.episteme.epistemictrace.sdi.SdiEngine;
import com.episteme.epistemictrace.sdi.SdiScenarios;
import com.episteme.epistemictrace.sdi.SdiScenarios.Scenario;
import com.episteme.epistemictrace.sdi.SdiWeights;
import com.episteme.epistemictrace.sdi.SignalTuning;

/** Spec 20 Part 2: binding, validation and the Q1 values in {@code application.properties}. */
class SdiPropertiesTests {

	private static final String PREFIX = "epistemictrace.sdi.";

	private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
		.withUserConfiguration(PropertiesConfig.class);

	/** The {@code epistemictrace.sdi.*} lines of the main {@code application.properties}. */
	private static String[] mainValues() throws IOException {
		Properties properties = PropertiesLoaderUtils.loadProperties(new ClassPathResource("application.properties"));
		List<String> values = new ArrayList<>();
		for (String name : properties.stringPropertyNames()) {
			if (name.startsWith(PREFIX)) {
				values.add(name + "=" + properties.getProperty(name));
			}
		}
		return values.toArray(String[]::new);
	}

	private static String[] with(String... overrides) throws IOException {
		List<String> values = new ArrayList<>(List.of(mainValues()));
		values.addAll(List.of(overrides));
		return values.toArray(String[]::new);
	}

	@Test
	void theMainConfigurationHoldsTheAcceptedQ1Values() throws IOException {
		this.contextRunner.withPropertyValues(mainValues()).run(context -> {
			assertThat(context).hasNotFailed();
			SdiProperties properties = context.getBean(SdiProperties.class);
			assertThat(properties.toWeights()).isEqualTo(new SdiWeights(0.20, 0.20, 0.25, 0.35));
			assertThat(properties.toTuning()).isEqualTo(new SignalTuning(10, Duration.ofSeconds(60), 5));
			assertThat(properties.levels().mediumFrom()).isEqualTo(40);
			assertThat(properties.defaults()).isEqualTo(new SdiProperties.Defaults(70, 600, 5));
		});
	}

	@Test
	void changingAWeightInConfigurationChangesTheScore() throws IOException {
		Scenario scenario = SdiScenarios.wheelSpinning();
		List<Integer> scores = new ArrayList<>();
		for (String[] values : List.of(mainValues(),
				with(PREFIX + "weights.run-frequency=0.50", PREFIX + "weights.no-progress=0.05"))) {
			this.contextRunner.withPropertyValues(values).run(context -> {
				SdiProperties properties = context.getBean(SdiProperties.class);
				scores.add(SdiEngine.compute(scenario.events(), scenario.run(), SdiScenarios.WINDOW,
						properties.toTuning(), properties.toWeights()));
			});
		}
		assertThat(scores).hasSize(2);
		assertThat(scores.get(1)).isNotEqualTo(scores.get(0));
	}

	@Test
	void weightsThatSumToOnePointTwoStopStartup() throws IOException {
		this.contextRunner.withPropertyValues(with(PREFIX + "weights.no-progress=0.55")).run(context -> {
			assertThat(context).hasFailed();
			assertThat(context.getStartupFailure()).rootCause().hasMessageContaining("must sum to 1");
		});
	}

	@ParameterizedTest
	@ValueSource(strings = { "caps.run-count=0", "caps.repeats=0", "caps.gap=0s", "caps.gap=-5s",
			"weights.run-frequency=-0.1", "weights.edit-to-run=1.5", "levels.medium-from=101",
			"defaults.threshold=101", "defaults.threshold=-1", "defaults.cooldown-seconds=-1",
			"defaults.window-minutes=0" })
	void anOutOfRangeValueStopsStartup(String override) throws IOException {
		this.contextRunner.withPropertyValues(with(PREFIX + override))
			.run(context -> assertThat(context).hasFailed());
	}

	@ParameterizedTest
	@ValueSource(strings = { "weights.run-frequency", "weights.edit-to-run", "weights.repeated-errors",
			"weights.no-progress", "caps.run-count", "caps.gap", "caps.repeats", "levels.medium-from",
			"defaults.threshold", "defaults.cooldown-seconds", "defaults.window-minutes" })
	void aMissingValueStopsStartup(String missing) throws IOException {
		String[] values = List.of(mainValues())
			.stream()
			.filter(value -> !value.startsWith(PREFIX + missing + "="))
			.toArray(String[]::new);
		this.contextRunner.withPropertyValues(values).run(context -> {
			assertThat(context).hasFailed();
			assertThat(context.getStartupFailure()).rootCause().hasMessageContaining("epistemictrace.sdi");
		});
	}

	@Test
	void theDefaultsAcceptTheBoundaryValuesOfTheSdiConfigsConstraints() throws IOException {
		this.contextRunner
			.withPropertyValues(with(PREFIX + "defaults.threshold=0", PREFIX + "defaults.cooldown-seconds=0",
					PREFIX + "defaults.window-minutes=1"))
			.run(context -> assertThat(context).hasNotFailed());
		this.contextRunner.withPropertyValues(with(PREFIX + "defaults.threshold=100"))
			.run(context -> assertThat(context).hasNotFailed());
	}

	@Configuration
	@EnableConfigurationProperties(SdiProperties.class)
	static class PropertiesConfig {

	}

}
