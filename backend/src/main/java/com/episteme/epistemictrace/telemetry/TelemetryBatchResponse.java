package com.episteme.epistemictrace.telemetry;

import com.episteme.epistemictrace.breaker.BreakerPayload;
import com.episteme.epistemictrace.sdi.StruggleLevel;

/**
 * Answer to a stored batch (spec 18 R6, spec 21 R4): events newly stored, events skipped as already stored, and the
 * struggle level of the latest new RUN ({@code null} without one) and the breaker state, always present (spec 22 R9).
 * Never a raw SDI (spec 21 R5, spec 22 R10, invariant 5).
 */
public record TelemetryBatchResponse(int accepted, int duplicates, StruggleLevel struggleLevel, BreakerPayload breaker) {

	static TelemetryBatchResponse from(StoredBatch batch) {
		return new TelemetryBatchResponse(batch.accepted(), batch.duplicates(), batch.struggleLevel(), batch.breaker());
	}

}
