package com.episteme.epistemictrace.sdi;

/**
 * Weights of the four signals (spec 20 R1). Each is in {@code [0, 1]} and together they sum to {@code 1 ± 0.001}.
 * Values come from configuration ({@code epistemictrace.sdi.weights}); nothing in code fixes them (invariant 7).
 */
public record SdiWeights(double runFrequency, double editToRun, double repeatedErrors, double noProgress) {

	static final double SUM_TOLERANCE = 0.001;

	public SdiWeights {
		requireUnit("runFrequency", runFrequency);
		requireUnit("editToRun", editToRun);
		requireUnit("repeatedErrors", repeatedErrors);
		requireUnit("noProgress", noProgress);
		double sum = runFrequency + editToRun + repeatedErrors + noProgress;
		if (Math.abs(sum - 1.0) > SUM_TOLERANCE) {
			throw new IllegalArgumentException("SDI weights must sum to 1 (± " + SUM_TOLERANCE + "), was " + sum);
		}
	}

	private static void requireUnit(String name, double value) {
		if (!(value >= 0.0 && value <= 1.0)) {
			throw new IllegalArgumentException("SDI weight " + name + " must be between 0 and 1, was " + value);
		}
	}

}
