package com.episteme.epistemictrace.history;

import java.time.Duration;
import java.time.Instant;

/**
 * One row of {@code GET /api/me/sessions} (spec 26 R1). {@code durationSeconds} is {@code null} while the session has
 * no end. Never carries an SDI value (R3).
 */
public record HistoryItem(long sessionId, long activityId, String activityTitle, Instant startedAt, Instant endedAt,
		Long durationSeconds, long runCount, long reflectionCount) {

	static HistoryItem of(SessionRow row, SessionCounts counts) {
		return new HistoryItem(row.sessionId(), row.activityId(), row.activityTitle(), row.startedAt(), row.endedAt(),
				durationSeconds(row), (counts != null) ? counts.runCount() : 0,
				(counts != null) ? counts.reflectionCount() : 0);
	}

	private static Long durationSeconds(SessionRow row) {
		return (row.endedAt() != null) ? Duration.between(row.startedAt(), row.endedAt()).getSeconds() : null;
	}

}
