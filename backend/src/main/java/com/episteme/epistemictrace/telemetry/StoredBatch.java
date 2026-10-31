package com.episteme.epistemictrace.telemetry;

import java.util.List;

/**
 * Result of storing a batch (spec 18 R6, R7). {@code runs} holds the newly stored RUN events in {@code occurredAt}
 * order, so scoring (spec 21) needs no second query.
 */
public record StoredBatch(int accepted, int duplicates, List<TelemetryEvent> runs) {

	public StoredBatch {
		runs = List.copyOf(runs);
	}

}
