package com.episteme.epistemictrace.breaker;

import java.time.Instant;

/**
 * Circuit-breaker state of a session (spec 22 R1); mirrors {@code coding_sessions.runner_locked}, {@code sdi_at_lock}
 * and {@code cooldown_ends_at}.
 */
public record BreakerState(boolean locked, Integer sdiAtLock, Instant cooldownEndsAt) {

	public static final BreakerState UNLOCKED = new BreakerState(false, null, null);

}
