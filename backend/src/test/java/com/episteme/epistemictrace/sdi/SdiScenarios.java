package com.episteme.epistemictrace.sdi;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import com.episteme.epistemictrace.telemetry.EventType;

/**
 * Seeded event sequences with fixed instants (spec 20 R7), shared by the engine tests and the scoring tests of spec
 * 21. Each scenario ends with the RUN that is scored.
 */
public final class SdiScenarios {

	public static final Instant T0 = Instant.parse("2026-11-03T02:00:00Z");

	public static final Duration WINDOW = Duration.ofMinutes(5);

	private SdiScenarios() {
	}

	/**
	 * Wheel-spinning: 10 runs in 5 minutes, each 10 s after an edit, the same error signature on 8 runs and
	 * {@code passedCount} never above 1.
	 */
	public static Scenario wheelSpinning() {
		Builder builder = new Builder();
		for (int i = 0; i < 10; i++) {
			long runAt = 25L + i * 30;
			builder.edit(runAt - 10);
			if (i >= 2) {
				builder.error(runAt, "NameError@3");
			}
			builder.run(runAt, (i == 0) ? 0 : 1);
		}
		return builder.build("wheel-spinning");
	}

	/** Steady progress: 4 runs in 5 minutes, each 60–90 s after an edit, no repeated errors, passed 1, 2, 3, 4. */
	public static Scenario steadyProgress() {
		Builder builder = new Builder();
		long[] gaps = { 60, 75, 90, 70 };
		long at = 0;
		for (int i = 0; i < gaps.length; i++) {
			// Each edit comes 5 s after the previous run, so the next run is gaps[i] after it.
			long editAt = (i == 0) ? 0 : at + 5;
			builder.edit(editAt);
			at = editAt + gaps[i];
			builder.run(at, i + 1);
		}
		return builder.build("steady progress");
	}

	/** The session's very first run, with no edit before it. */
	public static Scenario singleFirstRun() {
		return new Builder().run(0, 0).build("single first run");
	}

	/** 30 runs, 10 s apart, with no edits at all. */
	public static Scenario thirtyRunsWithoutEdits() {
		Builder builder = new Builder();
		for (int i = 0; i < 30; i++) {
			builder.run(i * 10L, 0);
		}
		return builder.build("30 runs without edits");
	}

	/** Runs that alternate between 0 and 2 passing tests, each 20 s after an edit. */
	public static Scenario alternatingPasses() {
		Builder builder = new Builder();
		for (int i = 0; i < 8; i++) {
			long runAt = 20L + i * 35;
			builder.edit(runAt - 20);
			builder.run(runAt, (i % 2 == 0) ? 0 : 2);
		}
		return builder.build("alternating passes");
	}

	/** A named event list and the RUN to score. */
	public record Scenario(String name, List<SdiEvent> events, SdiEvent run) {

	}

	private static final class Builder {

		private final List<SdiEvent> events = new ArrayList<>();

		private SdiEvent lastRun;

		Builder edit(long seconds) {
			add(EventType.EDIT, seconds, null, null);
			return this;
		}

		Builder error(long seconds, String signature) {
			add(EventType.ERROR, seconds, null, signature);
			return this;
		}

		Builder run(long seconds, int passed) {
			this.lastRun = add(EventType.RUN, seconds, passed, null);
			return this;
		}

		Scenario build(String name) {
			return new Scenario(name, List.copyOf(this.events), this.lastRun);
		}

		private SdiEvent add(EventType type, long seconds, Integer passed, String signature) {
			SdiEvent event = new SdiEvent(this.events.size() + 1, type, T0.plusSeconds(seconds), passed, signature);
			this.events.add(event);
			return event;
		}

	}

}
