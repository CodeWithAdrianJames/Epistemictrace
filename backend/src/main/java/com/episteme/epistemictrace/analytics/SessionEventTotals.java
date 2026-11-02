package com.episteme.epistemictrace.analytics;

import java.time.Instant;

/** RUN event count and latest event time of one session (spec 29 R2); sessions without events have no row. */
public record SessionEventTotals(Long sessionId, Long runCount, Instant lastEventAt) {
}
