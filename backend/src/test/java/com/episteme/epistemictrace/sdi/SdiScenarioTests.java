package com.episteme.epistemictrace.sdi;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.stream.Stream;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

import com.episteme.epistemictrace.sdi.SdiScenarios.Scenario;

/**
 * Spec 20 Part 3 (TEL-03 AC 2, PROJECT.md §9): with the configured defaults, wheel-spinning scores above 70 and steady
 * progress below 70. Each assertion message prints the scenario's signals as CLR-01 evidence.
 */
class SdiScenarioTests {

	/** The Q1 values in {@code application.properties}; {@code SdiPropertiesTests} checks they match. */
	static final SdiWeights WEIGHTS = new SdiWeights(0.20, 0.20, 0.25, 0.35);

	static final SignalTuning TUNING = new SignalTuning(10, Duration.ofSeconds(60), 5);

	static final int THRESHOLD = 70;

	private static int score(Scenario scenario) {
		return SdiEngine.compute(scenario.events(), scenario.run(), SdiScenarios.WINDOW, TUNING, WEIGHTS);
	}

	private static String describe(Scenario scenario) {
		Signals signals = SignalCalculator.calculate(scenario.events(), scenario.run(), SdiScenarios.WINDOW, TUNING);
		return scenario.name() + ": SDI " + score(scenario) + " from " + signals;
	}

	@Test
	void wheelSpinningScoresAboveTheThreshold() {
		Scenario scenario = SdiScenarios.wheelSpinning();
		assertThat(score(scenario)).as(describe(scenario)).isGreaterThan(THRESHOLD);
		assertThat(StruggleLevels.of(score(scenario), 40, THRESHOLD)).isEqualTo(StruggleLevel.HIGH);
	}

	@Test
	void steadyProgressScoresBelowTheThreshold() {
		Scenario scenario = SdiScenarios.steadyProgress();
		assertThat(score(scenario)).as(describe(scenario)).isLessThan(THRESHOLD);
		assertThat(StruggleLevels.of(score(scenario), 40, THRESHOLD)).isEqualTo(StruggleLevel.LOW);
	}

	@Test
	void theWheelSpinningSignalsAreTheOnesTheScenarioDescribes() {
		Scenario scenario = SdiScenarios.wheelSpinning();
		Signals signals = SignalCalculator.calculate(scenario.events(), scenario.run(), SdiScenarios.WINDOW, TUNING);
		assertThat(signals.runs()).as(describe(scenario)).isEqualTo(10);
		assertThat(signals.medianGap()).isEqualTo(Duration.ofSeconds(10));
		assertThat(signals.repeats()).isEqualTo(7);
		assertThat(signals.noProgressRuns()).isEqualTo(8);
		assertThat(score(scenario)).isEqualTo(90);
	}

	@Test
	void theSteadySignalsAreTheOnesTheScenarioDescribes() {
		Scenario scenario = SdiScenarios.steadyProgress();
		Signals signals = SignalCalculator.calculate(scenario.events(), scenario.run(), SdiScenarios.WINDOW, TUNING);
		assertThat(signals.runs()).as(describe(scenario)).isEqualTo(4);
		assertThat(signals.medianGap()).isGreaterThanOrEqualTo(Duration.ofSeconds(60));
		assertThat(signals.repeats()).isZero();
		assertThat(signals.noProgressRuns()).isZero();
		assertThat(score(scenario)).isEqualTo(8);
	}

	@ParameterizedTest
	@MethodSource("edgeCases")
	void edgeCasesStayInRange(Scenario scenario) {
		assertThat(score(scenario)).as(describe(scenario)).isBetween(SdiEngine.MIN_SDI, SdiEngine.MAX_SDI);
	}

	@Test
	void aSingleFirstRunScoresOnlyItsRunFrequency() {
		Scenario scenario = SdiScenarios.singleFirstRun();
		assertThat(score(scenario)).as(describe(scenario)).isEqualTo(2);
	}

	static Stream<Scenario> edgeCases() {
		return Stream.of(SdiScenarios.singleFirstRun(), SdiScenarios.thirtyRunsWithoutEdits(),
				SdiScenarios.alternatingPasses());
	}

}
