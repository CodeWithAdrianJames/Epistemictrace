package com.episteme.epistemictrace.telemetry;

import com.episteme.epistemictrace.sdi.StruggleLevel;

/**
 * Answer to a stored batch (spec 18 R6, spec 21 R4): events newly stored, events skipped as already stored, and the
 * struggle level of the latest new RUN ({@code null} without one). Never a raw SDI (spec 21 R5, invariant 5).
 */
public record TelemetryBatchResponse(int accepted, int duplicates, StruggleLevel struggleLevel) {

	static TelemetryBatchResponse from(StoredBatch batch) {
		return new TelemetryBatchResponse(batch.accepted(), batch.duplicates(), batch.struggleLevel());
	}

}
