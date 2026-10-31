package com.episteme.epistemictrace.history;

import java.time.Instant;

/** A session joined with its activity title (spec 26 R1), as read by {@link HistoryRepository}. */
public record SessionRow(Long sessionId, Long activityId, String activityTitle, Instant startedAt, Instant endedAt) {

}
