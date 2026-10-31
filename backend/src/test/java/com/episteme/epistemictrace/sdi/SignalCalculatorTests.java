package com.episteme.epistemictrace.sdi;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;
import static org.assertj.core.api.Assertions.within;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import com.episteme.epistemictrace.telemetry.EventType;

/** Spec 19: signal definitions, ordering and window selection, with fixed instants. */
class SignalCalculatorTests {

	private static final Instant T0 = Instant.parse("2026-11-03T02:00:00Z");

	private static final Duration WINDOW = Duration.ofMinutes(5);

	private static final SignalTuning TUNING = new SignalTuning(10, Duration.ofSeconds(60), 5);

	private long nextId = 1;

	private SdiEvent edit(long seconds) {
		return new SdiEvent(this.nextId++, EventType.EDIT, T0.plusSeconds(seconds), null, null);
	}

	private SdiEvent error(long seconds, String signature) {
		return new SdiEvent(this.nextId++, EventType.ERROR, T0.plusSeconds(seconds), null, signature);
	}

	private SdiEvent run(long seconds, int passed) {
		return new SdiEvent(this.nextId++, EventType.RUN, T0.plusSeconds(seconds), passed, null);
	}

	private static Signals calculate(List<SdiEvent> events, SdiEvent run) {
		return SignalCalculator.calculate(events, run, WINDOW, TUNING);
	}

	@Nested
	class Records {

		@Test
		void tuningRejectsCapsOfZeroOrLess() {
			assertThatIllegalArgumentException().isThrownBy(() -> new SignalTuning(0, Duration.ofSeconds(60), 5));
			assertThatIllegalArgumentException().isThrownBy(() -> new SignalTuning(10, Duration.ZERO, 5));
			assertThatIllegalArgumentException().isThrownBy(() -> new SignalTuning(10, Duration.ofSeconds(-1), 5));
			assertThatIllegalArgumentException().isThrownBy(() -> new SignalTuning(10, Duration.ofSeconds(60), 0));
		}

		@Test
		void aNonRunEventCannotBeScored() {
			SdiEvent edit = edit(0);
			assertThatIllegalArgumentException().isThrownBy(() -> calculate(List.of(edit), edit));
		}

		@Test
		void aRunThatIsNotInTheSessionCannotBeScored() {
			SdiEvent run = run(0, 0);
			assertThatIllegalArgumentException().isThrownBy(() -> calculate(List.of(edit(0)), run));
		}

	}

	@Nested
	class OrderingAndWindow {

		@Test
		void editErrorAndRunAtTheSameInstantAreOrderedEditErrorRun() {
			SdiEvent run = new SdiEvent(1, EventType.RUN, T0, 0, null);
			SdiEvent error = new SdiEvent(2, EventType.ERROR, T0, null, "A@1");
			SdiEvent edit = new SdiEvent(3, EventType.EDIT, T0, null, null);
			List<SdiEvent> sorted = new ArrayList<>(List.of(run, error, edit));
			sorted.sort(SignalCalculator.ORDER);
			assertThat(sorted).containsExactly(edit, error, run);

			// The edit at the same instant counts as "before" the run: gap 0, so signal 2 is at its maximum.
			Signals signals = calculate(List.of(run, error, edit), run);
			assertThat(signals.medianGap()).isZero();
			assertThat(signals.editToRun()).isEqualTo(1.0);
		}

		@Test
		void sameInstantAndTypeIsOrderedById() {
			SdiEvent later = new SdiEvent(9, EventType.RUN, T0, 1, null);
			SdiEvent earlier = new SdiEvent(4, EventType.RUN, T0, 0, null);
			List<SdiEvent> sorted = new ArrayList<>(List.of(later, earlier));
			sorted.sort(SignalCalculator.ORDER);
			assertThat(sorted).containsExactly(earlier, later);
		}

		@Test
		void eventsAtTheWindowStartAreIncludedAndOneMillisecondEarlierExcluded() {
			SdiEvent atStart = new SdiEvent(1, EventType.ERROR, T0, null, "A@1");
			SdiEvent tooEarly = new SdiEvent(2, EventType.ERROR, T0.minusMillis(1), null, "A@1");
			SdiEvent sameError = new SdiEvent(3, EventType.ERROR, T0.plusSeconds(100), null, "A@1");
			SdiEvent run = new SdiEvent(4, EventType.RUN, T0.plus(WINDOW), 0, null);

			assertThat(calculate(List.of(atStart, sameError, run), run).repeats()).isEqualTo(1);
			assertThat(calculate(List.of(tooEarly, sameError, run), run).repeats()).isZero();
		}

		@Test
		void eventsAfterTheRunNeverAffectTheResult() {
			SdiEvent first = run(0, 0);
			SdiEvent scored = run(30, 0);
			List<SdiEvent> upToRun = List.of(first, edit(20), scored);
			List<SdiEvent> withLater = new ArrayList<>(upToRun);
			withLater.addAll(List.of(run(30, 5), edit(31), error(32, "A@1"), error(33, "A@1"), run(40, 0)));
			// Same instant as the scored run but a higher id: ordered after it.
			withLater.add(new SdiEvent(1000, EventType.RUN, T0.plusSeconds(30), 9, null));

			assertThat(calculate(withLater, scored)).isEqualTo(calculate(upToRun, scored));
		}

		@Test
		void theInputListIsNotChanged() {
			SdiEvent run = run(10, 0);
			List<SdiEvent> events = new ArrayList<>(List.of(run, edit(5)));
			calculate(events, run);
			assertThat(events).containsExactly(run, events.get(1));
		}

	}

	@Nested
	class RunFrequency {

		@Test
		void threeRunsWithCapTenIsPointThree() {
			List<SdiEvent> events = List.of(run(0, 0), run(60, 0), run(120, 0));
			Signals signals = calculate(events, events.get(2));
			assertThat(signals.runs()).isEqualTo(3);
			assertThat(signals.runFrequency()).isCloseTo(0.3, within(1e-12));
		}

		@Test
		void twelveRunsIsCappedAtOne() {
			List<SdiEvent> events = new ArrayList<>();
			for (int i = 0; i < 12; i++) {
				events.add(run(i * 10L, 0));
			}
			Signals signals = calculate(events, events.get(11));
			assertThat(signals.runs()).isEqualTo(12);
			assertThat(signals.runFrequency()).isEqualTo(1.0);
		}

		@Test
		void runsBeforeTheWindowAreNotCounted() {
			List<SdiEvent> events = List.of(run(0, 0), run(400, 0));
			assertThat(calculate(events, events.get(1)).runs()).isEqualTo(1);
		}

	}

	@Nested
	class EditToRunTime {

		@Test
		void anEditTenSecondsBeforeTheRunIsAGapOfTenSeconds() {
			List<SdiEvent> events = List.of(edit(0), run(10, 0));
			Signals signals = calculate(events, events.get(1));
			assertThat(signals.medianGap()).isEqualTo(Duration.ofSeconds(10));
			assertThat(signals.editToRun()).isCloseTo(1 - 10.0 / 60, within(1e-12));
		}

		@Test
		void aRerunWithoutAnEditUsesTheTimeSinceThePreviousRun() {
			List<SdiEvent> events = List.of(edit(0), run(10, 0), run(30, 0));
			Signals signals = calculate(events, events.get(2));
			// Gaps 10 s (edit → first run) and 20 s (previous run → re-run): median of two is 15 s.
			assertThat(signals.medianGap()).isEqualTo(Duration.ofSeconds(15));
		}

		@Test
		void onlyTheLatestEditAfterThePreviousRunCounts() {
			List<SdiEvent> events = List.of(run(0, 0), edit(5), edit(25), error(28, "A@1"), run(30, 0));
			SdiEvent scored = events.get(4);
			List<SdiEvent> onlyScoredInWindow = events;
			Signals signals = SignalCalculator.calculate(onlyScoredInWindow, scored, Duration.ofSeconds(10), TUNING);
			assertThat(signals.runs()).isEqualTo(1);
			assertThat(signals.medianGap()).isEqualTo(Duration.ofSeconds(5));
		}

		@Test
		void theFirstRunWithNoEditUsesGapCapSoTheSignalIsZero() {
			List<SdiEvent> events = List.of(run(0, 0));
			Signals signals = calculate(events, events.get(0));
			assertThat(signals.medianGap()).isEqualTo(Duration.ofSeconds(60));
			assertThat(signals.editToRun()).isZero();
		}

		@Test
		void thePreviousRunMayLieOutsideTheWindow() {
			List<SdiEvent> events = List.of(run(0, 0), run(310, 0));
			Signals signals = calculate(events, events.get(1));
			assertThat(signals.runs()).isEqualTo(1);
			assertThat(signals.medianGap()).isEqualTo(Duration.ofSeconds(310));
			assertThat(signals.editToRun()).isZero();
		}

		@Test
		void anEvenCountTakesTheMeanOfTheTwoMiddleGaps() {
			// Gaps: 60 (cap, first run), 3, 7, 1 → sorted 1, 3, 7, 60 → median (3 + 7) / 2 = 5 s.
			List<SdiEvent> events = List.of(run(0, 0), edit(10), run(13, 0), edit(15), run(22, 0), edit(30), run(31, 0));
			Signals signals = calculate(events, events.get(6));
			assertThat(signals.medianGap()).isEqualTo(Duration.ofSeconds(5));
		}

		@Test
		void theMedianKeepsHalfMilliseconds() {
			List<SdiEvent> events = List.of(new SdiEvent(1, EventType.EDIT, T0, null, null),
					new SdiEvent(2, EventType.RUN, T0.plusMillis(1), 0, null),
					new SdiEvent(3, EventType.RUN, T0.plusMillis(3), 0, null));
			Signals signals = calculate(events, events.get(2));
			assertThat(signals.medianGap()).isEqualTo(Duration.ofNanos(1_500_000));
		}

	}

	@Nested
	class RepeatedErrors {

		@Test
		void signaturesAAABAreTwoRepeats() {
			List<SdiEvent> events = List.of(error(1, "A@1"), error(2, "A@1"), error(3, "A@1"), error(4, "B@2"),
					run(5, 0));
			Signals signals = calculate(events, events.get(4));
			assertThat(signals.repeats()).isEqualTo(2);
			assertThat(signals.repeatedErrors()).isCloseTo(0.4, within(1e-12));
		}

		@Test
		void repeatsAreCappedAtOne() {
			List<SdiEvent> events = new ArrayList<>();
			for (int i = 0; i < 9; i++) {
				events.add(error(i, "A@1"));
			}
			events.add(run(20, 0));
			Signals signals = calculate(events, events.get(9));
			assertThat(signals.repeats()).isEqualTo(8);
			assertThat(signals.repeatedErrors()).isEqualTo(1.0);
		}

		@Test
		void distinctErrorsAreNoRepeats() {
			List<SdiEvent> events = List.of(error(1, "A@1"), error(2, "B@1"), error(3, "A@2"), run(4, 0));
			assertThat(calculate(events, events.get(3)).repeatedErrors()).isZero();
		}

	}

	@Nested
	class NoProgressRuns {

		@Test
		void passed01120MakesTheThirdAndFifthRunsNoProgress() {
			List<SdiEvent> events = List.of(run(0, 0), run(30, 1), run(60, 1), run(90, 2), run(120, 0));
			Signals signals = calculate(events, events.get(4));
			assertThat(signals.noProgressRuns()).isEqualTo(2);
			assertThat(signals.noProgress()).isCloseTo(2.0 / 5, within(1e-12));

			assertThat(calculate(events, events.get(2)).noProgressRuns()).isEqualTo(1);
			assertThat(calculate(events, events.get(3)).noProgressRuns()).isEqualTo(1);
		}

		@Test
		void theFirstRunIsNeverNoProgress() {
			List<SdiEvent> events = List.of(run(0, 0));
			assertThat(calculate(events, events.get(0)).noProgress()).isZero();
		}

		@Test
		void runsBeforeTheWindowSetTheBestButAreNotCounted() {
			List<SdiEvent> events = List.of(run(0, 3), run(400, 3));
			Signals signals = calculate(events, events.get(1));
			assertThat(signals.runs()).isEqualTo(1);
			assertThat(signals.noProgressRuns()).isEqualTo(1);
			assertThat(signals.noProgress()).isEqualTo(1.0);
		}

	}

	@Nested
	class Bounds {

		@Test
		void aSingleFirstRunWithNoEditsHasOnlyItsOwnRunCounted() {
			List<SdiEvent> events = List.of(run(0, 0));
			Signals signals = calculate(events, events.get(0));
			// R5: the window always holds the scored run, so signal 1 is 1 / runCap; the other three stay at 0.
			assertThat(signals.runFrequency()).isCloseTo(0.1, within(1e-12));
			assertThat(signals.editToRun()).isZero();
			assertThat(signals.repeatedErrors()).isZero();
			assertThat(signals.noProgress()).isZero();
		}

		@Test
		void everyNormalizedSignalStaysWithinZeroAndOne() {
			Random random = new Random(19);
			EventType[] types = EventType.values();
			for (int sequence = 0; sequence < 500; sequence++) {
				List<SdiEvent> events = new ArrayList<>();
				long millis = 0;
				int count = 1 + random.nextInt(60);
				for (int i = 0; i < count; i++) {
					millis += random.nextInt(30_000);
					EventType type = types[random.nextInt(types.length)];
					events.add(new SdiEvent(i + 1, type, T0.plusMillis(millis),
							(type == EventType.RUN) ? random.nextInt(5) : null,
							(type == EventType.ERROR) ? "E@" + random.nextInt(3) : null));
				}
				SdiEvent run = new SdiEvent(count + 1, EventType.RUN, T0.plusMillis(millis), random.nextInt(5), null);
				events.add(run);
				Signals signals = calculate(events, run);
				assertThat(List.of(signals.runFrequency(), signals.editToRun(), signals.repeatedErrors(),
						signals.noProgress()))
					.allSatisfy(value -> assertThat(value).isBetween(0.0, 1.0));
			}
		}

	}

}
