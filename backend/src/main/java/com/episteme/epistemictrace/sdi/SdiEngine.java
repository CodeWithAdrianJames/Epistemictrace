package com.episteme.epistemictrace.sdi;

import java.time.Duration;
import java.util.List;

/**
 * The Struggle Dynamics Index (spec 20 R2, R3): {@code round(100 × Σ wᵢ·nᵢ)}, clamped to {@code [0, 100]}
 * (invariant 4). Plain Java; the same inputs always give the same score.
 */
public final class SdiEngine {

	public static final int MIN_SDI = 0;

	public static final int MAX_SDI = 100;

	private SdiEngine() {
	}

	public static int score(Signals signals, SdiWeights weights) {
		double sum = weights.runFrequency() * signals.runFrequency() + weights.editToRun() * signals.editToRun()
				+ weights.repeatedErrors() * signals.repeatedErrors() + weights.noProgress() * signals.noProgress();
		long rounded = Math.round(MAX_SDI * sum);
		return (int) Math.max(MIN_SDI, Math.min(MAX_SDI, rounded));
	}

	/** Signals of {@code run} over the window ({@link SignalCalculator}), then {@link #score}. */
	public static int compute(List<SdiEvent> sessionEvents, SdiEvent run, Duration window, SignalTuning tuning,
			SdiWeights weights) {
		return score(SignalCalculator.calculate(sessionEvents, run, window, tuning), weights);
	}

}
