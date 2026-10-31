package com.episteme.epistemictrace.sdi;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import com.episteme.epistemictrace.telemetry.EventType;

/** Spec 20 Part 1: {@link SdiWeights}, {@link SdiEngine#score} and {@link StruggleLevels}. */
class SdiEngineTests {

	private static final SdiWeights WEIGHTS = new SdiWeights(0.20, 0.20, 0.25, 0.35);

	private static Signals signals(double n1, double n2, double n3, double n4) {
		return new Signals(0, Duration.ZERO, 0, 0, n1, n2, n3, n4);
	}

	@Test
	void allZeroSignalsScoreZero() {
		assertThat(SdiEngine.score(signals(0, 0, 0, 0), WEIGHTS)).isZero();
	}

	@Test
	void allOneSignalsScoreOneHundred() {
		assertThat(SdiEngine.score(signals(1, 1, 1, 1), WEIGHTS)).isEqualTo(100);
	}

	@Test
	void theScoreIsTheRoundedWeightedSumTimesOneHundred() {
		// 100 × (0.20·0.5 + 0.20·0.25 + 0.25·0.4 + 0.35·0.2) = 32
		assertThat(SdiEngine.score(signals(0.5, 0.25, 0.4, 0.2), WEIGHTS)).isEqualTo(32);
		// 100 × (0.20·0.9 + 0.35·0.3) = 28.5 in decimal, just below in binary floating point → 28
		assertThat(SdiEngine.score(signals(0.9, 0, 0, 0.3), WEIGHTS)).isBetween(28, 29);
	}

	@Test
	void halfPointsRoundUp() {
		SdiWeights weights = new SdiWeights(0.125, 0.875, 0, 0);
		assertThat(SdiEngine.score(signals(1, 0, 0, 0), weights)).isEqualTo(13);
		assertThat(SdiEngine.score(signals(0.5, 0, 0, 0), new SdiWeights(0.25, 0.75, 0, 0))).isEqualTo(13);
	}

	@Test
	void theScoreIsClampedToZeroAndOneHundred() {
		// Weights may sum to 1.001, and signals outside [0, 1] can only come from a bug; the score still stays in range.
		SdiWeights heavy = new SdiWeights(0.251, 0.25, 0.25, 0.25);
		assertThat(SdiEngine.score(signals(1, 1, 1, 1), heavy)).isEqualTo(100);
		assertThat(SdiEngine.score(signals(2, 2, 2, 2), WEIGHTS)).isEqualTo(100);
		assertThat(SdiEngine.score(signals(-1, -1, -1, -1), WEIGHTS)).isZero();
	}

	@Test
	void computeScoresTheSignalsOfTheRun() {
		Instant t0 = Instant.parse("2026-11-03T02:00:00Z");
		SdiEvent edit = new SdiEvent(1, EventType.EDIT, t0, null, null);
		SdiEvent run = new SdiEvent(2, EventType.RUN, t0.plusSeconds(30), 0, null);
		SignalTuning tuning = new SignalTuning(10, Duration.ofSeconds(60), 5);

		int sdi = SdiEngine.compute(List.of(edit, run), run, Duration.ofMinutes(5), tuning, WEIGHTS);

		// n1 = 0.1, n2 = 1 − 30/60 = 0.5 → 100 × (0.02 + 0.10) = 12
		assertThat(sdi).isEqualTo(12);
	}

	@Test
	void weightsMustEachBeWithinZeroAndOne() {
		assertThatIllegalArgumentException().isThrownBy(() -> new SdiWeights(-0.1, 0.4, 0.35, 0.35));
		assertThatIllegalArgumentException().isThrownBy(() -> new SdiWeights(1.1, -0.1, 0, 0));
		assertThatIllegalArgumentException().isThrownBy(() -> new SdiWeights(Double.NaN, 0.4, 0.3, 0.3));
	}

	@Test
	void weightsMustSumToOneWithinATolerance() {
		new SdiWeights(0.2, 0.2, 0.25, 0.3505);
		new SdiWeights(0.2, 0.2, 0.25, 0.3495);
		assertThatIllegalArgumentException().isThrownBy(() -> new SdiWeights(0.2, 0.2, 0.25, 0.352));
		assertThatIllegalArgumentException().isThrownBy(() -> new SdiWeights(0.3, 0.3, 0.3, 0.3));
	}

	@ParameterizedTest
	@CsvSource({ "0, LOW", "39, LOW", "40, MEDIUM", "69, MEDIUM", "70, HIGH", "100, HIGH" })
	void levelsUseMediumFromAndTheThreshold(int sdi, StruggleLevel level) {
		assertThat(StruggleLevels.of(sdi, 40, 70)).isEqualTo(level);
	}

	@Test
	void theThresholdWinsWhenItIsBelowMediumFrom() {
		assertThat(StruggleLevels.of(35, 40, 30)).isEqualTo(StruggleLevel.HIGH);
		assertThat(StruggleLevels.of(25, 40, 30)).isEqualTo(StruggleLevel.LOW);
	}

}
