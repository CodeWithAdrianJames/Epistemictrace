package com.episteme.epistemictrace.breaker;

import java.time.Duration;
import java.time.Instant;
import java.util.Objects;

import com.episteme.epistemictrace.breaker.BreakerView.Status;

/**
 * Circuit-breaker transitions (spec 22 R2–R4; Q1, Q2 accepted 2026-10-31). Plain Java: threshold, cooldown and
 * {@code now} are passed in, so the rules are deterministic and hold no configuration (invariant 7).
 *
 * <pre>
 * Unlocked ──(scored RUN with SDI ≥ threshold, not in cooldown)──► Locked
 * Locked ──(valid reflection)──► Cooldown (cooldownEndsAt = now + cooldown)
 * Cooldown ──(now ≥ cooldownEndsAt)──► Unlocked
 * </pre>
 */
public final class BreakerRules {

	private BreakerRules() {
	}

	/** R2: a scored RUN locks an unlocked session at or above the threshold, unless a cooldown is running. */
	public static BreakerState onRunScored(BreakerState state, int sdi, int threshold, Instant now) {
		Objects.requireNonNull(state, "state");
		Objects.requireNonNull(now, "now");
		if (inCooldown(state, now)) {
			return state;
		}
		if (!state.locked() && sdi >= threshold) {
			return new BreakerState(true, sdi, state.cooldownEndsAt());
		}
		return state;
	}

	/**
	 * R3: a valid reflection unlocks the session and starts the cooldown.
	 * @throws IllegalStateException if the session is not locked
	 */
	public static BreakerState onReflection(BreakerState state, Duration cooldown, Instant now) {
		Objects.requireNonNull(state, "state");
		Objects.requireNonNull(cooldown, "cooldown");
		Objects.requireNonNull(now, "now");
		if (!state.locked()) {
			throw new IllegalStateException("The runner is not locked");
		}
		return new BreakerState(false, null, now.plus(cooldown));
	}

	/** R4: {@code LOCKED} if locked; {@code COOLDOWN} while {@code now} is before the cooldown end; else {@code UNLOCKED}. */
	public static BreakerView view(BreakerState state, Instant now) {
		Objects.requireNonNull(state, "state");
		Objects.requireNonNull(now, "now");
		if (state.locked()) {
			return new BreakerView(Status.LOCKED, null);
		}
		if (inCooldown(state, now)) {
			return new BreakerView(Status.COOLDOWN, state.cooldownEndsAt());
		}
		return new BreakerView(Status.UNLOCKED, null);
	}

	private static boolean inCooldown(BreakerState state, Instant now) {
		return state.cooldownEndsAt() != null && now.isBefore(state.cooldownEndsAt());
	}

}
