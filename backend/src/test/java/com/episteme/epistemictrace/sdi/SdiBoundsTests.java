package com.episteme.epistemictrace.sdi;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

import org.junit.jupiter.api.Test;

import com.episteme.epistemictrace.telemetry.EventType;

/** Spec 20 (TEL-03 AC 1): the SDI is always between 0 and 100, for 1 000 sequences from a fixed seed. */
class SdiBoundsTests {

	@Test
	void everyGeneratedSequenceScoresBetweenZeroAndOneHundred() {
		Random random = new Random(42);
		EventType[] types = EventType.values();
		for (int sequence = 0; sequence < 1000; sequence++) {
			List<SdiEvent> events = new ArrayList<>();
			long millis = 0;
			int count = random.nextInt(80);
			for (int i = 0; i < count; i++) {
				millis += random.nextInt(45_000);
				EventType type = types[random.nextInt(types.length)];
				events.add(new SdiEvent(i + 1, type, SdiScenarios.T0.plusMillis(millis),
						(type == EventType.RUN) ? random.nextInt(6) : null,
						(type == EventType.ERROR) ? "E@" + random.nextInt(4) : null));
			}
			SdiEvent run = new SdiEvent(count + 1, EventType.RUN, SdiScenarios.T0.plusMillis(millis + random.nextInt(5000)),
					random.nextInt(6), null);
			events.add(run);
			Duration window = Duration.ofMinutes(1 + random.nextInt(10));

			int sdi = SdiEngine.compute(events, run, window, SdiScenarioTests.TUNING, SdiScenarioTests.WEIGHTS);

			assertThat(sdi).as("sequence %d", sequence).isBetween(SdiEngine.MIN_SDI, SdiEngine.MAX_SDI);
		}
	}

}
