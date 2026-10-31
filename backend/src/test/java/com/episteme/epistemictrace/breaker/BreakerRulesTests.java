package com.episteme.epistemictrace.breaker;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalStateException;

import java.time.Duration;
import java.time.Instant;

import org.junit.jupiter.api.Test;

import com.episteme.epistemictrace.breaker.BreakerView.Status;

/** Spec 22 Part A: every branch of R2–R4 with fixed instants. */
class BreakerRulesTests {

	private static final Instant NOW = Instant.parse("2026-11-03T02:00:00Z");

	private static final Duration COOLDOWN = Duration.ofMinutes(10);

	private static final int THRESHOLD = 70;

	// R2 onRunScored

	@Test
	void anUnlockedRunAtTheThresholdLocksAndKeepsTheScore() {
		BreakerState locked = BreakerRules.onRunScored(BreakerState.UNLOCKED, 70, THRESHOLD, NOW);
		assertThat(locked).isEqualTo(new BreakerState(true, 70, null));
	}

	@Test
	void anUnlockedRunAboveTheThresholdLocks() {
		assertThat(BreakerRules.onRunScored(BreakerState.UNLOCKED, 95, THRESHOLD, NOW).locked()).isTrue();
	}

	@Test
	void aRunBelowTheThresholdChangesNothing() {
		assertThat(BreakerRules.onRunScored(BreakerState.UNLOCKED, 69, THRESHOLD, NOW)).isSameAs(BreakerState.UNLOCKED);
	}

	@Test
	void anAlreadyLockedSessionIsUnchanged() {
		BreakerState locked = new BreakerState(true, 75, null);
		assertThat(BreakerRules.onRunScored(locked, 99, THRESHOLD, NOW)).isSameAs(locked);
		assertThat(BreakerRules.onRunScored(locked, 10, THRESHOLD, NOW)).isSameAs(locked);
	}

	@Test
	void aRunDuringTheCooldownDoesNotLock() {
		BreakerState cooling = new BreakerState(false, null, NOW.plusSeconds(1));
		assertThat(BreakerRules.onRunScored(cooling, 95, THRESHOLD, NOW)).isSameAs(cooling);
	}

	@Test
	void aRunExactlyAtTheCooldownEndCanLockAgain() {
		BreakerState cooled = new BreakerState(false, null, NOW);
		assertThat(BreakerRules.onRunScored(cooled, 95, THRESHOLD, NOW)).isEqualTo(new BreakerState(true, 95, NOW));
	}

	@Test
	void aRunAfterTheCooldownLocksAgain() {
		BreakerState cooled = new BreakerState(false, null, NOW.minusSeconds(1));
		assertThat(BreakerRules.onRunScored(cooled, 80, THRESHOLD, NOW).locked()).isTrue();
	}

	// R3 onReflection

	@Test
	void aReflectionUnlocksAndStartsTheCooldown() {
		BreakerState after = BreakerRules.onReflection(new BreakerState(true, 82, null), COOLDOWN, NOW);
		assertThat(after).isEqualTo(new BreakerState(false, null, NOW.plus(COOLDOWN)));
	}

	@Test
	void aReflectionWhileNotLockedIsRejected() {
		assertThatIllegalStateException()
			.isThrownBy(() -> BreakerRules.onReflection(BreakerState.UNLOCKED, COOLDOWN, NOW));
		assertThatIllegalStateException().isThrownBy(
				() -> BreakerRules.onReflection(new BreakerState(false, null, NOW.plusSeconds(60)), COOLDOWN, NOW));
	}

	@Test
	void aZeroCooldownUnlocksStraightAway() {
		BreakerState after = BreakerRules.onReflection(new BreakerState(true, 82, null), Duration.ZERO, NOW);
		assertThat(BreakerRules.view(after, NOW).status()).isEqualTo(Status.UNLOCKED);
	}

	// R4 view

	@Test
	void aLockedStateViewsAsLocked() {
		assertThat(BreakerRules.view(new BreakerState(true, 80, null), NOW)).isEqualTo(new BreakerView(Status.LOCKED, null));
	}

	@Test
	void aRunningCooldownViewsAsCooldownWithItsEnd() {
		Instant end = NOW.plusSeconds(1);
		assertThat(BreakerRules.view(new BreakerState(false, null, end), NOW))
			.isEqualTo(new BreakerView(Status.COOLDOWN, end));
	}

	@Test
	void aCooldownEndingExactlyNowViewsAsUnlocked() {
		assertThat(BreakerRules.view(new BreakerState(false, null, NOW), NOW))
			.isEqualTo(new BreakerView(Status.UNLOCKED, null));
	}

	@Test
	void noStateViewsAsUnlocked() {
		assertThat(BreakerRules.view(BreakerState.UNLOCKED, NOW)).isEqualTo(new BreakerView(Status.UNLOCKED, null));
	}

	@Test
	void theFullCycleLocksCoolsDownAndLocksAgain() {
		BreakerState state = BreakerRules.onRunScored(BreakerState.UNLOCKED, 90, THRESHOLD, NOW);
		assertThat(BreakerRules.view(state, NOW).status()).isEqualTo(Status.LOCKED);

		Instant reflectedAt = NOW.plusSeconds(60);
		state = BreakerRules.onReflection(state, COOLDOWN, reflectedAt);
		assertThat(BreakerRules.view(state, reflectedAt).status()).isEqualTo(Status.COOLDOWN);

		Instant duringCooldown = reflectedAt.plusSeconds(30);
		state = BreakerRules.onRunScored(state, 95, THRESHOLD, duringCooldown);
		assertThat(BreakerRules.view(state, duringCooldown).status()).isEqualTo(Status.COOLDOWN);

		Instant afterCooldown = reflectedAt.plus(COOLDOWN);
		assertThat(BreakerRules.view(state, afterCooldown).status()).isEqualTo(Status.UNLOCKED);
		state = BreakerRules.onRunScored(state, 75, THRESHOLD, afterCooldown);
		assertThat(BreakerRules.view(state, afterCooldown).status()).isEqualTo(Status.LOCKED);
	}

}
