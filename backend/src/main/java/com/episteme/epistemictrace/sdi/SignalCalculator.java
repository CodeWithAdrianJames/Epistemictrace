package com.episteme.epistemictrace.sdi;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

import com.episteme.epistemictrace.telemetry.EventType;

/**
 * The four struggle signals for one RUN over a sliding window (spec 19 R4, R5; Q1 accepted 2026-10-31). Plain Java:
 * no Spring, JPA or clock; the same inputs always give the same result.
 */
public final class SignalCalculator {

	/** Session order (R4): {@code occurredAt}, then EDIT before ERROR before RUN, then id. */
	public static final Comparator<SdiEvent> ORDER = Comparator.comparing(SdiEvent::occurredAt)
		.thenComparingInt(event -> typeRank(event.type()))
		.thenComparingLong(SdiEvent::id);

	private SignalCalculator() {
	}

	/**
	 * Signals for {@code run}, using the session's events up to and including it. Events ordered after {@code run}
	 * are ignored; the window is {@code [run.occurredAt − window, run.occurredAt]}, both ends inclusive.
	 * @throws IllegalArgumentException if {@code run} is not a RUN event or is not one of {@code sessionEvents}
	 */
	public static Signals calculate(List<SdiEvent> sessionEvents, SdiEvent run, Duration window, SignalTuning tuning) {
		Objects.requireNonNull(sessionEvents, "sessionEvents");
		Objects.requireNonNull(run, "run");
		Objects.requireNonNull(window, "window");
		Objects.requireNonNull(tuning, "tuning");
		if (run.type() != EventType.RUN) {
			throw new IllegalArgumentException("Event " + run.id() + " is a " + run.type() + ", not a RUN");
		}
		List<SdiEvent> ordered = new ArrayList<>(sessionEvents);
		ordered.sort(ORDER);
		int runIndex = ordered.indexOf(run);
		if (runIndex < 0) {
			throw new IllegalArgumentException("Event " + run.id() + " is not one of the session's events");
		}
		List<SdiEvent> history = ordered.subList(0, runIndex + 1);
		Instant windowStart = run.occurredAt().minus(window);

		List<Integer> windowRuns = new ArrayList<>();
		List<SdiEvent> windowErrors = new ArrayList<>();
		for (int i = 0; i < history.size(); i++) {
			SdiEvent event = history.get(i);
			if (event.occurredAt().isBefore(windowStart)) {
				continue;
			}
			if (event.type() == EventType.RUN) {
				windowRuns.add(i);
			}
			else if (event.type() == EventType.ERROR) {
				windowErrors.add(event);
			}
		}

		int runs = windowRuns.size();
		double runFrequency = Math.min((double) runs / tuning.runCap(), 1.0);

		List<Duration> gaps = new ArrayList<>(runs);
		for (int index : windowRuns) {
			gaps.add(gapBefore(history, index, tuning.gapCap()));
		}
		Duration medianGap = median(gaps);
		double editToRun = 1.0 - Math.min(ratio(medianGap, tuning.gapCap()), 1.0);

		Set<String> signatures = new HashSet<>();
		for (SdiEvent error : windowErrors) {
			signatures.add(error.errorSignature());
		}
		int repeats = windowErrors.size() - signatures.size();
		double repeatedErrors = Math.min((double) repeats / tuning.repeatCap(), 1.0);

		boolean[] noProgress = noProgressRuns(history);
		int noProgressRuns = 0;
		for (int index : windowRuns) {
			if (noProgress[index]) {
				noProgressRuns++;
			}
		}
		double noProgressShare = (double) noProgressRuns / runs;

		return new Signals(runs, medianGap, repeats, noProgressRuns, runFrequency, editToRun, repeatedErrors,
				noProgressShare);
	}

	/**
	 * R5 signal 2 for the RUN at {@code index}: time since the latest EDIT after the previous RUN, else since the
	 * previous RUN, else {@code gapCap}.
	 */
	private static Duration gapBefore(List<SdiEvent> history, int index, Duration gapCap) {
		Instant runAt = history.get(index).occurredAt();
		for (int i = index - 1; i >= 0; i--) {
			SdiEvent earlier = history.get(i);
			if (earlier.type() == EventType.EDIT || earlier.type() == EventType.RUN) {
				return Duration.between(earlier.occurredAt(), runAt);
			}
		}
		return gapCap;
	}

	/** Mean of the two middle values for an even count; exact, since {@link Duration} keeps nanoseconds. */
	private static Duration median(List<Duration> values) {
		List<Duration> sorted = new ArrayList<>(values);
		sorted.sort(Comparator.naturalOrder());
		int middle = sorted.size() / 2;
		if (sorted.size() % 2 == 1) {
			return sorted.get(middle);
		}
		return sorted.get(middle - 1).plus(sorted.get(middle)).dividedBy(2);
	}

	/** For each position, whether it is a RUN that did not beat the best passed count of the RUNs before it. */
	private static boolean[] noProgressRuns(List<SdiEvent> history) {
		boolean[] noProgress = new boolean[history.size()];
		Integer best = null;
		for (int i = 0; i < history.size(); i++) {
			SdiEvent event = history.get(i);
			if (event.type() != EventType.RUN) {
				continue;
			}
			int passed = (event.passedCount() != null) ? event.passedCount() : 0;
			noProgress[i] = best != null && passed <= best;
			best = (best == null) ? passed : Math.max(best, passed);
		}
		return noProgress;
	}

	private static double ratio(Duration value, Duration cap) {
		return (double) value.toNanos() / cap.toNanos();
	}

	private static int typeRank(EventType type) {
		return switch (type) {
			case EDIT -> 0;
			case ERROR -> 1;
			case RUN -> 2;
		};
	}

}
