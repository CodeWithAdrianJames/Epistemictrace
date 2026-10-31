package com.episteme.epistemictrace.sdi;

import java.time.Duration;
import java.util.Objects;

/**
 * Caps that normalize the raw signals (spec 19 R3, Q1). Values come from configuration ({@code epistemictrace.sdi.caps},
 * spec 20); every cap must be greater than zero.
 */
public record SignalTuning(int runCap, Duration gapCap, int repeatCap) {

	public SignalTuning {
		Objects.requireNonNull(gapCap, "gapCap");
		if (runCap <= 0) {
			throw new IllegalArgumentException("runCap must be greater than 0, was " + runCap);
		}
		if (gapCap.isNegative() || gapCap.isZero()) {
			throw new IllegalArgumentException("gapCap must be greater than 0, was " + gapCap);
		}
		if (repeatCap <= 0) {
			throw new IllegalArgumentException("repeatCap must be greater than 0, was " + repeatCap);
		}
	}

}
