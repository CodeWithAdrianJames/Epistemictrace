package com.episteme.epistemictrace.analytics;

import java.time.Instant;

/** One coding session as read for analytics (spec 29 R2), as read by {@link AnalyticsRepository}. */
public record AnalyticsSessionRow(Long sessionId, Long activityId, Long studentId, Instant startedAt, Instant endedAt,
		Integer peakSdi, Boolean runnerLocked) {
}
