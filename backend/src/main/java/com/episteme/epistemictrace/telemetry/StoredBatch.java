package com.episteme.epistemictrace.telemetry;

import java.util.List;

import com.episteme.epistemictrace.sdi.StruggleLevel;

/**
 * Result of storing a batch (spec 18 R6, R7; spec 21 R4). {@code runs} holds the newly stored RUN events in
 * {@code occurredAt} order; {@code struggleLevel} is the level of the latest of them, or {@code null} when the batch had
 * no new RUN.
 */
public record StoredBatch(int accepted, int duplicates, List<TelemetryEvent> runs, StruggleLevel struggleLevel) {

	public StoredBatch {
		runs = List.copyOf(runs);
	}

}
