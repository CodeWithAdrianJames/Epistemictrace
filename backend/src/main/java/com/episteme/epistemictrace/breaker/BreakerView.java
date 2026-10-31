package com.episteme.epistemictrace.breaker;

import java.time.Instant;

/**
 * What the breaker means at a moment (spec 22 R4). {@code cooldownEndsAt} is set only for {@link Status#COOLDOWN}.
 * Never carries the SDI at lock (R10, invariant 5).
 */
public record BreakerView(Status status, Instant cooldownEndsAt) {

	public enum Status {

		UNLOCKED,

		LOCKED,

		COOLDOWN

	}

}
