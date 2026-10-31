package com.episteme.epistemictrace.telemetry;

/** Answer to a stored batch (spec 18 R6): events newly stored and events skipped as already stored. */
public record TelemetryBatchResponse(int accepted, int duplicates) {

	static TelemetryBatchResponse from(StoredBatch batch) {
		return new TelemetryBatchResponse(batch.accepted(), batch.duplicates());
	}

}
