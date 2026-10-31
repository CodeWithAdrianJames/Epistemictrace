package com.episteme.epistemictrace.telemetry;

import java.util.List;

import com.episteme.epistemictrace.breaker.BreakerPayload;
import com.episteme.epistemictrace.sdi.StruggleLevel;

/**
 * Result of storing a batch (spec 18 R6, R7; spec 21 R4). {@code runs} holds the newly stored RUN events in
 * {@code occurredAt} order; {@code struggleLevel} is the level of the latest of them, or {@code null} when the batch had
 * no new RUN; {@code breaker} is the session's breaker state after the batch (spec 22 R9).
 */
public record StoredBatch(int accepted, int duplicates, List<TelemetryEvent> runs, StruggleLevel struggleLevel,
		BreakerPayload breaker) {

	public StoredBatch {
		runs = List.copyOf(runs);
	}

}
